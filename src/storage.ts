/**
 * Built-in TokenStorage implementations for common platforms.
 *
 * Import only the one you need — tree-shaking removes the rest.
 */

import type { TokenPair, TokenStorage } from "./types";

// ─────────────────────────────────────────────
//  1. In-memory (Node.js / tests / SSR)
// ─────────────────────────────────────────────

/**
 * Simple in-memory store. Tokens are lost on page reload or process restart.
 * Useful for: unit tests, server-side rendering, quick prototypes.
 */
export class MemoryTokenStorage implements TokenStorage {
  private tokens: TokenPair | null = null;

  getAccessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  getRefreshToken(): string | null {
    return this.tokens?.refreshToken ?? null;
  }

  setTokens(tokens: TokenPair): void {
    this.tokens = tokens;
  }

  clearTokens(): void {
    this.tokens = null;
  }
}

// ─────────────────────────────────────────────
//  2. localStorage (Browser)
// ─────────────────────────────────────────────

const LS_ACCESS_KEY  = "api_kit_access_token";
const LS_REFRESH_KEY = "api_kit_refresh_token";
const LS_EXPIRY_KEY  = "api_kit_access_token_expires_at";

/**
 * Persists tokens in `localStorage`.
 * Tokens survive page reloads but are scoped to the origin.
 *
 * Security note: localStorage is readable by any JavaScript running on the
 * page. A single XSS vulnerability exposes both the access token AND the
 * refresh token — the refresh token is long-lived and can be used to silently
 * mint new access tokens even after the access token expires.
 * For high-security applications, store tokens in HttpOnly cookies instead so
 * they are never accessible to JavaScript at all.
 */
export class LocalStorageTokenStorage implements TokenStorage {
  getAccessToken(): string | null {
    return localStorage.getItem(LS_ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(LS_REFRESH_KEY);
  }

  setTokens(tokens: TokenPair): void {
    localStorage.setItem(LS_ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(LS_REFRESH_KEY, tokens.refreshToken);
    if (tokens.accessTokenExpiresAt !== undefined) {
      localStorage.setItem(LS_EXPIRY_KEY, String(tokens.accessTokenExpiresAt));
    }
  }

  clearTokens(): void {
    localStorage.removeItem(LS_ACCESS_KEY);
    localStorage.removeItem(LS_REFRESH_KEY);
    localStorage.removeItem(LS_EXPIRY_KEY);
  }
}

// ─────────────────────────────────────────────
//  3. React Native AsyncStorage adapter
// ─────────────────────────────────────────────

/**
 * Adapter for React Native's `@react-native-async-storage/async-storage`.
 *
 * Usage:
 *   import AsyncStorage from "@react-native-async-storage/async-storage";
 *   const storage = new AsyncStorageTokenStorage(AsyncStorage);
 *
 * Design choice: we accept the AsyncStorage instance as a constructor argument
 * rather than importing it directly, which keeps this package free of a React
 * Native peer dependency.
 */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiSet(pairs: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

const AS_ACCESS_KEY  = "api_kit_access_token";
const AS_REFRESH_KEY = "api_kit_refresh_token";
const AS_EXPIRY_KEY  = "api_kit_access_token_expires_at";

export class AsyncStorageTokenStorage implements TokenStorage {
  constructor(private readonly store: AsyncStorageLike) {}

  getAccessToken(): Promise<string | null> {
    return this.store.getItem(AS_ACCESS_KEY);
  }

  getRefreshToken(): Promise<string | null> {
    return this.store.getItem(AS_REFRESH_KEY);
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    const pairs: [string, string][] = [
      [AS_ACCESS_KEY,  tokens.accessToken],
      [AS_REFRESH_KEY, tokens.refreshToken],
    ];
    if (tokens.accessTokenExpiresAt !== undefined) {
      pairs.push([AS_EXPIRY_KEY, String(tokens.accessTokenExpiresAt)]);
    }
    await this.store.multiSet(pairs);
  }

  async clearTokens(): Promise<void> {
    await this.store.multiRemove([AS_ACCESS_KEY, AS_REFRESH_KEY, AS_EXPIRY_KEY]);
  }
}
