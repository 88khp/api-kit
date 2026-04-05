/**
 * Core type definitions for api-kit.
 */

import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// ─────────────────────────────────────────────
//  Token storage — platform-agnostic interface
// ─────────────────────────────────────────────

/**
 * Pluggable token storage. Implement this to target any platform:
 *   • Browser      → localStorage / sessionStorage / cookies
 *   • Node.js      → in-memory map / Redis / file
 *   • React Native → AsyncStorage / SecureStore
 *
 * All methods may return a Promise so async storage (e.g. AsyncStorage) works
 * without any special handling in the client.
 */
export interface TokenStorage {
  getAccessToken(): string | null | Promise<string | null>;
  getRefreshToken(): string | null | Promise<string | null>;
  setTokens(tokens: TokenPair): void | Promise<void>;
  clearTokens(): void | Promise<void>;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp (seconds) when the access token expires — optional */
  accessTokenExpiresAt?: number;
}

// ─────────────────────────────────────────────
//  Logger interface
// ─────────────────────────────────────────────

/**
 * Minimal logger interface accepted by api-kit.
 *
 * Structurally compatible with @devraj-labs/logger's Logger and ChildLogger
 * out of the box — just pass your instance directly:
 *
 *   import { createLogger } from "@devraj-labs/logger";
 *   const logger = createLogger({ level: "debug" });
 *
 *   new ApiClient({ ..., logger });           // works — same shape
 *   new ApiClient({ ..., logger: logger.child({ module: "api-kit" }) }); // scoped
 *
 * Any object with these four methods works — no package install required.
 */
export interface ApiKitLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string,  meta?: Record<string, unknown>): void;
  warn(message: string,  meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ─────────────────────────────────────────────
//  Auth event hooks
// ─────────────────────────────────────────────

export interface AuthEventHooks {
  /** Called after a successful token refresh */
  onTokenRefreshed?(tokens: TokenPair): void;
  /** Called when refresh fails and the user should be logged out */
  onAuthFailure?(error: unknown): void;
  /** Called when logout() is invoked */
  onLogout?(): void;
}

// ─────────────────────────────────────────────
//  Retry config
// ─────────────────────────────────────────────

export interface RetryConfig {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential back-off (default: 300) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 10 000) */
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
}

// ─────────────────────────────────────────────
//  Client config
// ─────────────────────────────────────────────

export interface ApiClientConfig {
  /** Base URL for all requests */
  baseURL: string;
  /** Endpoint to call when refreshing tokens (default: "/auth/refresh") */
  refreshEndpoint?: string;
  /** Token storage implementation */
  storage: TokenStorage;
  /** Auth event hooks */
  hooks?: AuthEventHooks;
  /** Retry configuration */
  retry?: RetryConfig;
  /**
   * Logger instance. Accepts @devraj-labs/logger (Logger or ChildLogger),
   * or any object with debug/info/warn/error methods.
   * If omitted, logging is silently suppressed.
   */
  logger?: ApiKitLogger;
  /**
   * Pre-emptive refresh: refresh the token this many seconds *before* it
   * actually expires. Requires the storage to populate `accessTokenExpiresAt`.
   * Set to 0 to disable (default: 60).
   */
  preemptiveRefreshSeconds?: number;
  /** Additional Axios config passed to every request */
  axiosConfig?: AxiosRequestConfig;
}

// ─────────────────────────────────────────────
//  Internal
// ─────────────────────────────────────────────

export interface QueuedRequest {
  resolve(token: string): void;
  reject(error: unknown): void;
}

export interface RetryMetadata {
  _retryCount?: number;
  _isRetry?: boolean;
}

export type ExtendedAxiosConfig = InternalAxiosRequestConfig & RetryMetadata;
export type ExtendedAxiosResponse<T = unknown> = AxiosResponse<T> & {
  config: ExtendedAxiosConfig;
};
