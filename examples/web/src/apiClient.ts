/**
 * Singleton api-kit client for the web demo app.
 *
 * ApiClient.getInstance(config) is called once here at app startup.
 * Every other file calls ApiClient.getInstance() (no args) to get the same instance.
 *
 * Logger: pass any object with debug/info/warn/error — including a
 * @devraj-labs/logger instance or child logger.  Here we use a plain
 * console-backed object so the demo has zero extra dependencies.
 */

import { ApiClient, LocalStorageTokenStorage } from "../../../src/index";
import type { ApiKitLogger } from "../../../src/index";

export const tokenStorage = new LocalStorageTokenStorage();

// Minimal console logger — swap this for your @devraj-labs/logger instance
// e.g. createLogger({ level: "debug" }).child({ module: "api-kit" })
const logger: ApiKitLogger = {
  debug: (msg, meta) => console.debug("[api-kit]", msg, meta ?? ""),
  info:  (msg, meta) => console.info ("[api-kit]", msg, meta ?? ""),
  warn:  (msg, meta) => console.warn ("[api-kit]", msg, meta ?? ""),
  error: (msg, meta) => console.error("[api-kit]", msg, meta ?? ""),
};

export const apiClient = ApiClient.getInstance({
  baseURL: "",              // Vite proxies /auth and /api to localhost:4000
  refreshEndpoint: "/auth/refresh",
  storage: tokenStorage,
  logger,
  preemptiveRefreshSeconds: 10,
  retry: {
    maxRetries: 3,
    baseDelayMs: 300,
    maxDelayMs: 5_000,
  },
  hooks: {
    onTokenRefreshed(tokens) {
      window.dispatchEvent(new CustomEvent("token-refreshed", { detail: tokens }));
    },
    onAuthFailure() {
      window.dispatchEvent(new CustomEvent("auth-failure"));
    },
  },
});
