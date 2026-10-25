let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const AUTH_SESSION_EXPIRED_EVENT = "charity-admin-session-expired";
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://ensigo-server.onrender.com/api";

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/admin/refresh`, {
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

        const data: unknown = await response.json();
        const token =
          data &&
          typeof data === "object" &&
          "token" in data &&
          typeof data.token === "string"
            ? data.token
            : null;
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
