/**
 * useAuth — central auth state hook
 *
 * Manages login / logout and exposes the current user.
 * Listens to custom DOM events fired by the api-kit hooks so any part of the
 * app can react to auth events without prop-drilling.
 */

import { useCallback, useEffect, useState } from "react";
import { apiClient, tokenStorage } from "../apiClient";

export interface User {
  sub: string;
  username: string;
}

export interface LoginPayload {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: number;
  tokenConfig?: {
    accessTokenExpiresIn: string;
    refreshTokenExpiresIn: string;
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenConfig, setTokenConfig] = useState<{ accessTokenExpiresIn: string; refreshTokenExpiresIn: string } | null>(null);

  // On mount, try to restore session from storage
  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      // Fetch current user to validate the stored token
      apiClient
        .get<{ user: User }>("/api/me")
        .then((res) => setUser(res.data.user))
        .catch(() => tokenStorage.clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for auth-failure events (e.g. refresh failed)
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setTokenConfig(null);
    };
    window.addEventListener("auth-failure", handler);
    return () => window.removeEventListener("auth-failure", handler);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post<LoginPayload>("/auth/login", { username, password });
    const data = res.data;

    await tokenStorage.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
    });

    if (data.tokenConfig) setTokenConfig(data.tokenConfig);

    // Fetch the user profile immediately after login
    const meRes = await apiClient.get<{ user: User }>("/api/me");
    setUser(meRes.data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      await apiClient.post("/auth/logout", { refreshToken });
    } catch {
      // Best-effort — clear locally regardless
    }
    await apiClient.logout();
    setUser(null);
    setTokenConfig(null);
  }, []);

  return { user, loading, tokenConfig, login, logout };
}
