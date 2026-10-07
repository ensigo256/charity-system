import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from "axios";
import {
  AUTH_SESSION_EXPIRED_EVENT,
  getAccessToken,
  setAccessToken,
} from "@/lib/session-token";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://ensigo-server.onrender.com/api";

function getAuthHeaders() {
  if (typeof window === "undefined") return {};

  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/admin/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401 && typeof window !== "undefined") {
            window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
          }
          return null;
        }
        const data = await response.json();
        const token = typeof data.token === "string" ? data.token : null;
        setAccessToken(token);
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

// simple in-memory rate limit tracker (requests per window)
const REQUEST_THRESHOLD = parseInt(
  process.env.NEXT_PUBLIC_VITE_API_THRESHOLD || "60",
  10,
); // max requests per window
const THROTTLE_WINDOW = parseInt(
  process.env.NEXT_PUBLIC_VITE_THROTTLE_WINDOW || "60000",
  10,
); // 1 minute by default
let requestTimestamps: number[] = [];

function checkRateLimit() {
  const now = Date.now();
  // drop old timestamps
  requestTimestamps = requestTimestamps.filter(
    (ts) => now - ts < THROTTLE_WINDOW,
  );
  if (requestTimestamps.length >= REQUEST_THRESHOLD) {
    throw new Error("API request limit exceeded, please try again later");
  }
  requestTimestamps.push(now);
}

// ✅ Axios instance for GET only
const axiosClient = axios.create({
  baseURL: BASE_URL,
});

// attach rate limit check to every request
axiosClient.interceptors.request.use((config) => {
  checkRateLimit();
  return config;
});

const MAX_SERVER_ERROR_LENGTH = 300;

function getServerErrorMessage(payload: unknown, fallback: string) {
  const messages: string[] = [];

  if (typeof payload === "string" && payload.trim()) {
    messages.push(payload.trim());
  } else if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;

    if (typeof data.message === "string" && data.message.trim()) {
      messages.push(data.message.trim());
    } else if (typeof data.error === "string" && data.error.trim()) {
      messages.push(data.error.trim());
    } else if (Array.isArray(data.errors)) {
      messages.push(
        ...data.errors
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
              const message = (item as Record<string, unknown>).message;
              return typeof message === "string" ? message.trim() : "";
            }
            return "";
          })
          .filter(Boolean),
      );
    }
  }

  const message = messages.join(", ");
  if (!message || /<[^>]*>/.test(message)) {
    return fallback || "Something went wrong. Please try again.";
  }

  return message.slice(0, MAX_SERVER_ERROR_LENGTH);
}

// Throws a safe, user-facing message if the response is not OK.
async function throwIfResNotOk(res: Response) {
  if (res.ok) return;

  const contentType = res.headers.get("content-type") || "";
  let payload: unknown = null;

  if (contentType.includes("application/json")) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  } else {
    payload = await res.text().catch(() => "");
  }

  throw new Error(getServerErrorMessage(payload, res.statusText));
}

// ✅ Handles POST / PUT / PATCH / DELETE
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  checkRateLimit();

  // prepare headers/body properly; support FormData by letting the browser set multipart boundary
  const headers: Record<string, string> = {};
  Object.assign(headers, getAuthHeaders());
  let body: BodyInit | undefined;

  if (data instanceof FormData) {
    // leave headers empty, fetch will add appropriate content-type including boundary
    body = data;
  } else if (data !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  let res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body,
    credentials: "include",
  });

  if (res.status === 401) {
    const token = await refreshAccessToken();
    if (token) {
      res = await fetch(`${BASE_URL}${url}`, {
        method,
        headers: { ...headers, Authorization: `Bearer ${token}` },
        body,
        credentials: "include",
      });
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  timeout?: number; // optional timeout in ms
}) => QueryFunction<T> =
  ({ on401, timeout = 5000 }) =>
  async ({ queryKey, signal }) => {
    // React Query passes its own abort signal
    const controller = new AbortController();

    // If React Query aborts, abort axios request too
    signal?.addEventListener("abort", () => controller.abort());

    // Custom timeout abort
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `/${queryKey.join("/")}`;

      const request = () =>
        axiosClient.get(url, {
          signal: controller.signal,
          withCredentials: true,
          headers: getAuthHeaders(),
        });
      let response;
      try {
        response = await request();
      } catch (error: unknown) {
        if (!axios.isAxiosError(error) || error.response?.status !== 401) {
          throw error;
        }
        const token = await refreshAccessToken();
        if (!token) throw error;
        response = await request();
      }

      return response.data;
    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        throw new Error("Request cancelled");
      }

      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        on401 === "returnNull"
      ) {
        return null;
      }

      if (axios.isAxiosError(error)) {
        throw new Error(
          getServerErrorMessage(error.response?.data, error.message),
        );
      }
      throw new Error(error instanceof Error ? error.message : "Request failed");
    } finally {
      clearTimeout(timer);
    }
  };

// ✅ React Query Global Config - OPTIMIZED for performance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      staleTime: 5 * 60 * 1000, // 5 minutes (was 10 seconds)
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchInterval: false, // No automatic refetching (was 5000ms)
      retry: 1, // Reduce retry attempts (was true = 3 attempts)
    },
    mutations: {
      retry: 1, // Reduce mutation retries
    },
  },
});
