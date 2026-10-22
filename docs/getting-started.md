# Getting Started

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

## Install

```bash
npm install @88khp/api-kit
```

---

## Setup — 3 steps

### 1 — Pick a storage

api-kit does not store tokens itself. You pass a `TokenStorage` implementation that fits your platform.

| Platform | Recommended |
|----------|-------------|
| Browser | HttpOnly cookies via your server — see [storage.md](./storage.md#browser) |
| React Native | `@88khp/rn-storage-kit` → `SecureStorageAdapter` — see [storage.md](./storage.md#react-native) |
| Node.js script | `MemoryTokenStorage` (built-in) |

### 2 — Initialise the singleton once

Call `ApiClient.getInstance(config)` **once**, at your app's entry point. Every subsequent call returns the same instance with no config required.

**Browser**
```ts
import { ApiClient }          from "@88khp/api-kit";
import { CookieTokenStorage }  from "./storage/cookieTokenStorage";

ApiClient.getInstance({
  baseURL: "https://api.example.com",
  storage: new CookieTokenStorage(),
  hooks: {
    onAuthFailure() { window.location.href = "/login"; },
  },
});
```

**React Native**
```ts
import { ApiClient }            from "@88khp/api-kit";
import { rnSecureTokenStorage } from "./storage/tokenStorage"; // SecureStorageAdapter bridge

ApiClient.getInstance({
  baseURL: "https://api.example.com",
  storage: rnSecureTokenStorage,
  hooks: {
    onAuthFailure() {
      navigationRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
    },
  },
});
```

**Node.js**
```ts
import { ApiClient, MemoryTokenStorage } from "@88khp/api-kit";

ApiClient.getInstance({
  baseURL: "http://localhost:4000",
  storage: new MemoryTokenStorage(),
});
```

### 3 — Use it anywhere

```ts
import { ApiClient } from "@88khp/api-kit";

const client = ApiClient.getInstance(); // no config — returns the existing instance

const { data } = await client.get<User>("/api/me");
await client.post("/api/orders", { itemId: 42 });
```

---

## After login — store the tokens

api-kit doesn't intercept your login call. After your login request resolves, pass the tokens to storage:

```ts
const { data } = await client.post<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}>("/auth/login", { username, password });

await storage.setTokens(data);
// All subsequent requests are now authenticated automatically
```

---

Next: [Configuration Reference](./configuration.md)
