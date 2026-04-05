/**
 * Example: using api-kit in React Native with AsyncStorage.
 *
 * This file is for illustration — it uses placeholder imports that match the
 * real React Native package names. Copy the relevant sections into your RN app.
 */

// In a real RN project:
//   import AsyncStorage from "@react-native-async-storage/async-storage";
// For this example we create a stub that matches the interface:
const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    console.log(`[stub] AsyncStorage.getItem(${key})`);
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    console.log(`[stub] AsyncStorage.setItem(${key}, ${value.slice(0, 20)}…)`);
  },
  async multiSet(pairs: [string, string][]): Promise<void> {
    console.log(`[stub] AsyncStorage.multiSet(${pairs.map(([k]) => k).join(", ")})`);
  },
  async multiRemove(keys: string[]): Promise<void> {
    console.log(`[stub] AsyncStorage.multiRemove(${keys.join(", ")})`);
  },
};

import { ApiClient, AsyncStorageTokenStorage } from "../src/index";

// ─────────────────────────────────────────────
//  Storage — wraps AsyncStorage so api-kit can await it
// ─────────────────────────────────────────────

const storage = new AsyncStorageTokenStorage(AsyncStorage);

// ─────────────────────────────────────────────
//  Client
// ─────────────────────────────────────────────

export const apiClient = new ApiClient({
  baseURL: "https://api.yourapp.com",
  refreshEndpoint: "/auth/refresh",
  storage,
  preemptiveRefreshSeconds: 60,
  retry: { maxRetries: 3, baseDelayMs: 500 },
  hooks: {
    onAuthFailure() {
      // In a real app: navigate to the login screen via your navigation library
      // e.g. navigationRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
      console.warn("Session expired — navigate to Login");
    },
    onTokenRefreshed(tokens) {
      console.info("Tokens refreshed", tokens.accessTokenExpiresAt);
    },
  },
});

// ─────────────────────────────────────────────
//  Usage in a screen / hook
// ─────────────────────────────────────────────

async function exampleUsage() {
  // Login
  const res = await apiClient.post<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
  }>("/auth/login", { username: "alice", password: "password123" });

  await storage.setTokens({
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    accessTokenExpiresAt: res.data.accessTokenExpiresAt,
  });

  // Make typed API calls — access token is attached automatically
  const profile = await apiClient.get<{ id: string; name: string }>("/api/profile");
  console.log("Profile:", profile.data);

  // Logout — clears AsyncStorage and fires the onLogout hook
  await apiClient.logout();
}

exampleUsage().catch(console.error);
