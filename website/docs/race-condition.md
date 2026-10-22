---
sidebar_position: 7
---

# Race Condition Guard

## The problem

Modern apps fire multiple API calls simultaneously — on page load, after navigation, or in parallel data-fetching hooks. If the access token is expired at that moment, every one of those requests returns 401. Without a guard, each 401 would independently call the refresh endpoint, producing N refresh calls in parallel — most of which will fail because the first one already rotated the refresh token.

## How api-kit solves it

A single boolean flag (`isRefreshing`) and a queue (`pendingQueue`) coordinate all concurrent 401 responses:

```
Time ──────────────────────────────────────────────────────────────────────►

Request A ──[401]──► isRefreshing = false → set true → POST /auth/refresh ──► new token
                                                                               ↓ drain queue
Request B ──[401]──► isRefreshing = true  → push to queue ──────────────────► replay with new token
Request C ──[401]──► isRefreshing = true  → push to queue ──────────────────► replay with new token
Request D ──[401]──► isRefreshing = true  → push to queue ──────────────────► replay with new token

                      └──────── exactly 1 POST /auth/refresh ────────────┘
```

1. The first 401 sets `isRefreshing = true` and calls the refresh endpoint.
2. Every subsequent 401 while the refresh is in flight is pushed onto `pendingQueue` as a suspended Promise.
3. When the refresh resolves, `drainQueue()` settles every pending Promise with the new access token, and each request is replayed.
4. If the refresh fails, every pending Promise is rejected with the same error, and `onAuthFailure` is called once.

## Observing it in the demo

1. Run `npm run demo` and log in.
2. Wait for the token countdown to reach 0 (or set `ACCESS_TOKEN_TTL=10s`).
3. In the web app, set concurrency to 5–10 and click **Fire Requests**.
4. Open DevTools → Network tab.

You will see 5–10 `/api/data` requests, but exactly **one** `/auth/refresh` call. All data requests complete successfully.

## Implementation

[src/client.ts](https://github.com/88khp/api-kit/blob/main/src/client.ts) — `handle401()` method:

```ts
private handle401(originalConfig: ExtendedAxiosConfig): Promise<AxiosResponse> {
  if (this.isRefreshing) {
    // Suspend this request until the in-flight refresh settles
    return new Promise((resolve, reject) => {
      this.pendingQueue.push({
        resolve: (token) => {
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

  return new Promise(async (resolve, reject) => {
    try {
      const newToken = await this.refreshTokens();
      this.drainQueue(newToken);          // resume all queued requests
      resolve(this.axios(originalConfig));
    } catch (err) {
      this.drainQueue(null, err);         // reject all queued requests
      this.cfg.hooks?.onAuthFailure?.(err);
      reject(err);
    } finally {
      this.isRefreshing = false;
    }
  });
}
```

---

Next: [Pre-emptive Refresh](./preemptive-refresh.md)
