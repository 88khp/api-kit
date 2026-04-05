# Configuration Reference

All options are passed to `ApiClient.getInstance(config)` on the first call.

```ts
ApiClient.getInstance({
  // ── Required ──────────────────────────────────────────────────────────────

  baseURL: "https://api.example.com",
  storage: myStorage,

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Endpoint called to exchange a refresh token for a new token pair.
   *  Default: "/auth/refresh" */
  refreshEndpoint: "/auth/refresh",

  /** Refresh the access token this many seconds before it actually expires.
   *  Reads the JWT exp claim locally — no network call.
   *  Set to 0 to disable. Default: 60 */
  preemptiveRefreshSeconds: 60,

  // ── Retry ─────────────────────────────────────────────────────────────────

  retry: {
    maxRetries: 3,                                    // default: 3
    baseDelayMs: 300,                                 // default: 300
    maxDelayMs: 10_000,                               // default: 10 000
    retryableStatuses: [408, 429, 500, 502, 503, 504] // default: same
  },

  // ── Hooks ─────────────────────────────────────────────────────────────────

  hooks: {
    /** Called after every successful silent token refresh. */
    onTokenRefreshed(tokens) {},

    /** Called when refresh fails and the session cannot be recovered.
     *  Use this to redirect to login. */
    onAuthFailure(error) {},

    /** Called after logout() clears the stored tokens. */
    onLogout() {},
  },

  // ── Logger ────────────────────────────────────────────────────────────────

  /** Any object with debug / info / warn / error methods.
   *  Structurally compatible with @devraj-labs/logger out of the box.
   *  Omit to suppress all internal logs. */
  logger: myLogger,

  // ── Advanced ──────────────────────────────────────────────────────────────

  /** Extra options forwarded to axios.create(). */
  axiosConfig: {
    timeout: 10_000,
    headers: { "X-App-Version": "1.0.0" },
  },
});
```

## ApiKitLogger interface

api-kit does not depend on any logger package. It accepts any object that satisfies:

```ts
interface ApiKitLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info (message: string, meta?: Record<string, unknown>): void;
  warn (message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

This is structurally identical to `Logger` and `ChildLogger` from `@devraj-labs/logger`, so you can pass either directly — see [Logger Integration](./logger.md).

## TokenPair shape

The refresh endpoint must return (and the login endpoint should return) this shape:

```ts
interface TokenPair {
  accessToken:          string;
  refreshToken:         string;
  accessTokenExpiresAt?: number; // Unix timestamp (seconds) — enables pre-emptive refresh
}
```

---

Next: [Token Storage](./storage.md)
