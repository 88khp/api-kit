/**
 * api-kit — production-grade, platform-agnostic Axios API client
 *
 * Key design decisions:
 *
 * 1. SINGLETON     — ApiClient.getInstance(config) returns one shared instance.
 *                    Config is only applied on the first call; subsequent calls
 *                    return the same object so interceptors are never duplicated.
 *
 * 2. TOKEN QUEUE   — a single `isRefreshing` flag and a `pendingQueue` array
 *                    guarantee that concurrent 401 responses trigger exactly ONE
 *                    refresh. All queued requests are settled together once the
 *                    refresh completes.
 *
 * 3. INTERCEPTORS  — Axios request/response interceptors are used instead of
 *                    wrapping every method, keeping the surface area small.
 *
 * 4. ASYNC STORAGE — every storage call is `await`-ed so the client works with
 *                    both sync (localStorage) and async (AsyncStorage) stores.
 *
 * 5. PRE-EMPTIVE REFRESH — decodes the JWT locally before each request and
 *                    refreshes early if expiry is within the configured window.
 *
 * 6. EXPONENTIAL BACK-OFF — transient server errors are retried with jitter.
 *
 * 7. LOGGER        — accepts any object with debug/info/warn/error methods.
 *                    Structurally compatible with @88khp/logger (Logger /
 *                    ChildLogger) so you can pass your logger instance directly,
 *                    or a scoped child: logger.child({ module: "api-kit" }).
 *                    If omitted, all internal log calls are no-ops.
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

import type {
  ApiClientConfig,
  ApiKitLogger,
  ExtendedAxiosConfig,
  QueuedRequest,
  RetryConfig,
  TokenPair,
} from "./types";
import { isTokenExpiringSoon } from "./jwt";

// ─────────────────────────────────────────────
//  Defaults
// ─────────────────────────────────────────────

const DEFAULT_REFRESH_ENDPOINT   = "/auth/refresh";
const DEFAULT_PREEMPTIVE_SECONDS = 60;
const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 300,
  maxDelayMs: 10_000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/** No-op logger used when the caller does not provide one. */
const NOOP_LOGGER: ApiKitLogger = {
  debug: () => undefined,
  info:  () => undefined,
  warn:  () => undefined,
  error: () => undefined,
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function backoffDelay(attempt: number, base: number, cap: number): number {
  const exponential = base * Math.pow(2, attempt);
  return Math.min(cap, Math.random() * exponential);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse a Retry-After header value into milliseconds. Handles both delta-seconds and HTTP-date. */
function parseRetryAfter(value: string): number | null {
  const seconds = Number(value);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return null;
}

// ─────────────────────────────────────────────
//  ApiClient (singleton)
// ─────────────────────────────────────────────

export class ApiClient {
  /** Singleton instance — created once, reused everywhere. */
  private static _instance: ApiClient | null = null;

  /**
   * Return the shared ApiClient instance.
   *
   * The first call initialises the client with `config`.
   * Every subsequent call returns the same object — `config` is ignored.
   *
   *   // App bootstrap (e.g. index.ts or App.tsx)
   *   ApiClient.getInstance({ baseURL, storage, logger });
   *
   *   // Anywhere else
   *   const client = ApiClient.getInstance(); // same instance, no config needed
   */
  static getInstance(config?: ApiClientConfig): ApiClient {
    if (!ApiClient._instance) {
      if (!config) throw new Error("ApiClient must be initialised with config on first call.");
      ApiClient._instance = new ApiClient(config);
    }
    return ApiClient._instance;
  }

  /**
   * Destroy the singleton — useful in tests to get a fresh instance.
   * Must only be called in test environments; throws in production.
   * @internal
   */
  static _reset(): void {
    if (typeof process !== "undefined" && process.env["NODE_ENV"] === "production") {
      throw new Error("ApiClient._reset() must not be called in production");
    }
    ApiClient._instance = null;
  }

  /** The underlying Axios instance — exposed for advanced use-cases. */
  public readonly axios: AxiosInstance;

  private readonly cfg: {
    baseURL: string;
    refreshEndpoint: string;
    storage: ApiClientConfig["storage"];
    hooks: ApiClientConfig["hooks"];
    retry: Required<RetryConfig>;
    logger: ApiKitLogger;
    preemptiveRefreshSeconds: number;
  };

  private isRefreshing        = false;
  private pendingQueue: QueuedRequest[] = [];
  /**
   * Promise that resolves to the new access token when a refresh is in flight.
   * Pre-emptive callers await this instead of firing their own refresh.
   */
  private refreshingPromise: Promise<string> | null = null;

  // ── Constructor (private — use getInstance) ──────────────────────────────

  private constructor(config: ApiClientConfig) {
    this.cfg = {
      baseURL:                  config.baseURL,
      refreshEndpoint:          config.refreshEndpoint ?? DEFAULT_REFRESH_ENDPOINT,
      storage:                  config.storage,
      hooks:                    config.hooks,
      retry:                    { ...DEFAULT_RETRY, ...(config.retry ?? {}) },
      logger:                   config.logger ?? NOOP_LOGGER,
      preemptiveRefreshSeconds: config.preemptiveRefreshSeconds ?? DEFAULT_PREEMPTIVE_SECONDS,
    };

    this.axios = axios.create({ baseURL: config.baseURL, ...config.axiosConfig });

    this.setupRequestInterceptor();
    this.setupResponseInterceptor();

    this.cfg.logger.info("ApiClient initialised", { baseURL: config.baseURL });
  }

  // ─────────────────────────────────────────────
  //  Request interceptor — attach token + pre-emptive refresh
  // ─────────────────────────────────────────────

  private setupRequestInterceptor(): void {
    this.axios.interceptors.request.use(
      async (config: ExtendedAxiosConfig) => {
        if (config.url?.includes(this.cfg.refreshEndpoint)) return config;

        let accessToken = await this.cfg.storage.getAccessToken();

        if (
          accessToken &&
          this.cfg.preemptiveRefreshSeconds > 0 &&
          isTokenExpiringSoon(accessToken, this.cfg.preemptiveRefreshSeconds)
        ) {
          // ── Pre-emptive refresh — RACE-CONDITION SAFE ──────────────────
          // If another concurrent request already started a refresh, reuse
          // that same promise instead of firing a second network call.
          // This is the same single-flight guard used in handle401().
          if (!this.refreshingPromise) {
            this.cfg.logger.info("Pre-emptive token refresh triggered — starting refresh");
            this.isRefreshing = true;
            this.refreshingPromise = this.refreshTokens()
              .then((token) => {
                this.cfg.logger.info("Pre-emptive refresh succeeded — draining queue", {
                  queued: this.pendingQueue.length,
                });
                this.drainQueue(token);
                return token;
              })
              .catch((err) => {
                this.cfg.logger.warn("Pre-emptive refresh failed — draining queue with error", {
                  queued: this.pendingQueue.length,
                  err,
                });
                this.drainQueue(null, err);
                // Don't rethrow — let the request proceed with the old token;
                // if it's already expired the 401 handler will deal with it.
                return accessToken as string;
              })
              .finally(() => {
                this.isRefreshing = false;
                this.refreshingPromise = null;
              });
          } else {
            this.cfg.logger.debug("Pre-emptive refresh already in flight — awaiting shared promise");
          }

          try {
            accessToken = await this.refreshingPromise;
          } catch {
            // refreshingPromise never rejects (caught above) — belt-and-suspenders
          }
        }

        if (accessToken) {
          config.headers = config.headers ?? {};
          config.headers["Authorization"] = `Bearer ${accessToken}`;
          this.cfg.logger.debug("Access token attached", { url: config.url });
        }

        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );
  }

  // ─────────────────────────────────────────────
  //  Response interceptor — 401 handling + retry
  // ─────────────────────────────────────────────

  private setupResponseInterceptor(): void {
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalConfig = error.config as ExtendedAxiosConfig | undefined;
        if (!originalConfig) return Promise.reject(error);

        const status = error.response?.status;

        if (status === 401 && !originalConfig._isRetry) {
          return this.handle401(originalConfig);
        }

        if (this.isRetryable(status, originalConfig)) {
          return this.retryRequest(originalConfig, error);
        }

        return Promise.reject(error);
      }
    );
  }

  // ─────────────────────────────────────────────
  //  401 handler with request queuing
  // ─────────────────────────────────────────────

  private handle401(originalConfig: ExtendedAxiosConfig): Promise<AxiosResponse> {
    /**
     * RACE-CONDITION PREVENTION
     *
     * If a refresh is already in flight (either from a concurrent 401 or from
     * a pre-emptive refresh in the request interceptor), push this request
     * onto the queue. It will be replayed with the new token once the refresh
     * settles — without triggering another refresh call.
     */
    if (this.isRefreshing) {
      this.cfg.logger.debug("Refresh already in flight — queuing 401 request", { url: originalConfig.url });

      return new Promise<AxiosResponse>((resolve, reject) => {
        this.pendingQueue.push({
          resolve: (token) => {
            originalConfig.headers = originalConfig.headers ?? {};
            originalConfig.headers["Authorization"] = `Bearer ${token}`;
            originalConfig._isRetry = true;
            resolve(this.axios(originalConfig));
          },
          reject,
        });
      });
    }

    originalConfig._isRetry = true;
    this.isRefreshing = true;

    this.cfg.logger.info("401 received — starting token refresh", { url: originalConfig.url });

    this.refreshingPromise = this.refreshTokens();

    return new Promise<AxiosResponse>(async (resolve, reject) => {
      try {
        const newAccessToken = await this.refreshingPromise!;

        this.cfg.logger.info("Token refreshed — replaying queued requests", {
          queued: this.pendingQueue.length,
        });

        this.drainQueue(newAccessToken);

        originalConfig.headers = originalConfig.headers ?? {};
        originalConfig.headers["Authorization"] = `Bearer ${newAccessToken}`;
        resolve(this.axios(originalConfig));
      } catch (refreshError) {
        this.cfg.logger.error("Token refresh failed — rejecting all queued requests", {
          queued: this.pendingQueue.length,
          err: refreshError,
        });
        this.drainQueue(null, refreshError);
        this.cfg.hooks?.onAuthFailure?.(refreshError);
        reject(refreshError);
      } finally {
        this.isRefreshing = false;
        this.refreshingPromise = null;
      }
    });
  }

  // ─────────────────────────────────────────────
  //  Token refresh network call
  // ─────────────────────────────────────────────

  private async refreshTokens(): Promise<string> {
    const refreshToken = await this.cfg.storage.getRefreshToken();

    if (!refreshToken) throw new Error("No refresh token available");

    this.cfg.logger.debug("Calling refresh endpoint", { endpoint: this.cfg.refreshEndpoint });

    const response = await axios.post<TokenPair>(
      `${this.cfg.baseURL}${this.cfg.refreshEndpoint}`,
      { refreshToken }
    );

    const tokens = response.data;
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error("Invalid token response from server: missing accessToken or refreshToken");
    }
    await this.cfg.storage.setTokens(tokens);
    this.cfg.hooks?.onTokenRefreshed?.(tokens);

    return tokens.accessToken;
  }

  // ─────────────────────────────────────────────
  //  Queue helpers
  // ─────────────────────────────────────────────

  private drainQueue(newToken: string | null, error?: unknown): void {
    for (const queued of this.pendingQueue) {
      if (newToken) queued.resolve(newToken);
      else          queued.reject(error);
    }
    this.pendingQueue = [];
  }

  // ─────────────────────────────────────────────
  //  Exponential back-off retry
  // ─────────────────────────────────────────────

  private isRetryable(status: number | undefined, config: ExtendedAxiosConfig): boolean {
    if (!status) return false;
    const retryCount = config._retryCount ?? 0;
    if (retryCount >= this.cfg.retry.maxRetries) return false;
    return this.cfg.retry.retryableStatuses.includes(status);
  }

  private async retryRequest(
    config: ExtendedAxiosConfig,
    originalError: AxiosError
  ): Promise<AxiosResponse> {
    config._retryCount = (config._retryCount ?? 0) + 1;

    const retryAfterHeader = originalError.response?.headers?.["retry-after"];
    const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : null;

    const delay = retryAfterMs ?? backoffDelay(
      config._retryCount,
      this.cfg.retry.baseDelayMs,
      this.cfg.retry.maxDelayMs
    );

    this.cfg.logger.warn("Retrying request", {
      attempt: config._retryCount,
      max:     this.cfg.retry.maxRetries,
      delayMs: Math.round(delay),
      url:     config.url,
      status:  originalError.response?.status,
    });

    await sleep(delay);
    return this.axios(config);
  }

  // ─────────────────────────────────────────────
  //  Public API — typed convenience methods
  // ─────────────────────────────────────────────

  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.get<T>(url, config);
  }

  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.post<T>(url, data, config);
  }

  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.put<T>(url, data, config);
  }

  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.patch<T>(url, data, config);
  }

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.delete<T>(url, config);
  }

  async logout(): Promise<void> {
    await this.cfg.storage.clearTokens();
    this.cfg.hooks?.onLogout?.();
    this.cfg.logger.info("User logged out — tokens cleared");
  }
}
