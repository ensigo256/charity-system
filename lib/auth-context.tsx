"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  hasPermission,
  normalizeRole,
  Permission,
  UserRole,
} from "@/lib/permissions";
import {
  AUTH_SESSION_EXPIRED_EVENT,
  getAccessToken,
  setAccessToken,
} from "@/lib/session-token";
import { queryClient } from "@/lib/query-client";

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5454/api";
}

function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function refreshSession() {
  const response = await fetch(`${getApiBaseUrl()}/auth/admin/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) return null;
  return response.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleExpiredSession = () => {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
      setIsLoading(false);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);
    };
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const data = await refreshSession();
        if (!data?.token) {
          setAccessToken(null);
          queryClient.clear();
          return;
        }
        setAccessToken(data.token);

        const response = await fetch(`${getApiBaseUrl()}/auth/admin/me`, {
          headers: getAuthHeaders(data.token),
          credentials: "include",
        });
        if (!response.ok) {
          setAccessToken(null);
          queryClient.clear();
          return;
        }

        const currentAdmin = await response.json();
        const restoredUser: User = {
          id: String(currentAdmin.id),
          email: currentAdmin.username,
          name: currentAdmin.username,
          role: normalizeRole(currentAdmin.role) as UserRole,
        };
        setUser(restoredUser);
      } catch {
        setAccessToken(null);
        setUser(null);
        queryClient.clear();
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${getApiBaseUrl()}/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Invalid credentials");

    const role = normalizeRole(data.role);
    if (!role) throw new Error("This account has an unsupported role");

    const authenticatedUser: User = {
      id: String(data.id),
      email,
      name: data.username,
      role,
    };
    queryClient.clear();
    setAccessToken(data.token);
    setUser(authenticatedUser);
  };

  const logout = () => {
    setUser(null);
    queryClient.clear();
    const token = getAccessToken();
    setAccessToken(null);
    void (async () => {
      const refreshedSession = await refreshSession();
      const activeToken = refreshedSession?.token || token;
      if (!activeToken) return;

      await fetch(`${getApiBaseUrl()}/auth/admin/logout`, {
        method: "POST",
        headers: getAuthHeaders(activeToken),
        credentials: "include",
      });
    })();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
        can: (permission) => hasPermission(user?.role, permission),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
