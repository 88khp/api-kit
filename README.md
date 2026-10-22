<div align="center">

# 88khp · API Kit

**The API client that handles auth so you don't have to.**

Token attachment. Silent refresh. Race-condition safety. Works everywhere.

[![npm](https://img.shields.io/npm/v/@88khp/api-kit?color=0ea5e9&label=npm)](https://www.npmjs.com/package/@88khp/api-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-web%20%7C%20React%20Native%20%7C%20Node.js-a855f7)](https://github.com/88khp/api-kit)

</div>

---

You've written the interceptor. You've debugged the race condition where five requests all tried to refresh at once. You've added the retry logic, the logger, the storage adapter. You've done it on every project.

**API Kit does all of it — once, correctly.**

---

## What it does

```ts
ApiClient.getInstance({
  baseURL: "https://api.example.com",
  storage: myStorage,
  hooks: {
    onAuthFailure: () => router.push("/login"),
  },
});

// That's it. Every request from here automatically:
// - attaches Bearer token
// - refreshes silently when it expires
// - retries if the server hiccups
// - routes exactly ONE refresh call even if 10 requests fire at once
const { data } = await client.get<User>("/api/me");
```

---

## Is it for you?

### Why use it

- Your app authenticates with a Bearer token and you want refresh handled for you.
- You want retries and token handling in one client instead of repeated in every screen.

### The problem it solves

Token refresh is harder than it looks. When several requests fail with an expired token at once, each one tries to refresh, and the app ends up with races and duplicate refreshes. API Kit routes all of them through one refresh call and then retries the originals.

### Who it's not for

- Apps that authenticate with cookies or sessions instead of tokens.
- Teams that want a full query cache or data-fetching layer. Use a library such as TanStack Query on top of it.

### What it doesn't do

- It doesn't verify JWT signatures. It only decodes the token to read its expiry, and the server does the verification.
- It doesn't cache responses.
- It doesn't generate types from an API schema.

---

## Features

**Token lifecycle — fully automatic**
- Attaches `Authorization: Bearer <token>` to every request
- Detects 401s and transparently refreshes + replays the failed request
- Pre-emptive refresh — renews the token before it expires, configurable via `preemptiveRefreshSeconds`

**Race-condition safe**
- Concurrent 401s collapse into exactly **one** refresh call
- All queued requests drain together the moment refresh completes
- Pre-emptive refresh shares the same single-flight promise — no double-refresh under load

**Platform agnostic**
- Works in browser, React Native, and Node.js
- Bring your own storage — any object implementing `getAccessToken / setTokens / clearTokens`
- Ships with `MemoryTokenStorage`, `LocalStorageTokenStorage`, and `AsyncStorageTokenStorage`
- First-class support for [`@88khp/rn-storage-kit`](https://github.com/88khp/rn-storage-kit) (encrypted keychain on mobile)

**Production grade**
- Exponential backoff with full jitter on transient errors (408, 429, 5xx)
- Auth event hooks — `onTokenRefreshed` · `onAuthFailure` · `onLogout`
- Bring-your-own logger — any `{ debug, info, warn, error }` object (`console`, `@88khp/logger`, etc.)
- Singleton pattern — initialise once, use everywhere, no prop drilling

**TypeScript first**
- Full generics on every method: `client.get<User>("/api/me")`
- Exported interfaces for every extension point

---

## Install

```bash
npm install @88khp/api-kit axios
```

---

## Quick start

```ts
// bootstrap.ts — run this once at app entry (index.ts / App.tsx)
import { ApiClient, LocalStorageTokenStorage } from "@88khp/api-kit";

ApiClient.getInstance({
  baseURL: "https://api.example.com",
  storage: new LocalStorageTokenStorage(),
  hooks: {
    onAuthFailure() {
      window.location.href = "/login";
    },
  },
});
```

```ts
// anywhere in your app — no config needed
import { ApiClient } from "@88khp/api-kit";

const client = ApiClient.getInstance();

const { data: user }    = await client.get<User>("/api/me");
const { data: post }    = await client.post<Post>("/api/posts", { title });
const { data: updated } = await client.patch<Post>("/api/posts/1", { title });
```

After login, store the tokens and every subsequent request is handled:

```ts
import { ApiClient } from "@88khp/api-kit";

async function login(username: string, password: string) {
  const res = await fetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const tokens = await res.json();

  // hand tokens to api-kit — it takes it from here
  const client = ApiClient.getInstance();
  await client.storage.setTokens(tokens);
}
```

---

## Storage

| Adapter | Environment | Security |
|---|---|---|
| `MemoryTokenStorage` | Any | Cleared on page reload |
| `LocalStorageTokenStorage` | Browser | Vulnerable to XSS — dev/demo only |
| `AsyncStorageTokenStorage` | React Native | Unencrypted — dev/demo only |
| `@88khp/rn-storage-kit` | React Native | Encrypted keychain — **recommended for prod** |

Implement your own with three methods:

```ts
import type { TokenStorage } from "@88khp/api-kit";

const myStorage: TokenStorage = {
  getAccessToken:  () => secureGet("access_token"),
  getRefreshToken: () => secureGet("refresh_token"),
  setTokens:       (t) => secureSet(t),
  clearTokens:     ()  => secureClear(),
};
```

Full guide → [docs/storage.md](docs/storage.md)

---

## Logger

Pass any object with `debug / info / warn / error` — no adapter needed:

```ts
// console
ApiClient.getInstance({ ..., logger: console });

// @88khp/logger
import { logger } from "@88khp/logger";
ApiClient.getInstance({ ..., logger: logger.child({ module: "api-kit" }) });

// silent (default)
ApiClient.getInstance({ ...config }); // omit logger entirely
```

Full guide → [docs/logger.md](docs/logger.md)

---

## Documentation

| | |
|---|---|
| [Getting Started](docs/getting-started.md) | Install, minimal setup, platform examples |
| [Configuration](docs/configuration.md) | All config options, types, and defaults |
| [Token Storage](docs/storage.md) | Built-in adapters, custom storage, rn-storage-kit |
| [Logger Integration](docs/logger.md) | Using @88khp/logger or any compatible logger |
| [Race Condition Guard](docs/race-condition.md) | How concurrent 401s are handled |
| [Pre-emptive Refresh](docs/preemptive-refresh.md) | Proactive token renewal before expiry |
| [Examples](docs/examples.md) | Node.js · Browser · React Native · custom storage |
| [Demo](docs/demo.md) | Running the interactive demo app locally |

---

## Run the demo

**Hosted demo** — no setup needed:
[https://web-self-delta-77.vercel.app/](https://web-self-delta-77.vercel.app/)

See token refresh, race-condition guard, and live expiry countdown in action.
Login with `alice / password123`.

Or run it locally:

```bash
npm run demo
```

Opens a Vite + React app at `http://localhost:5173` backed by a local Express server.
Full guide → [docs/demo.md](docs/demo.md)

---

## License

MIT © [88khp](https://github.com/88khp)
