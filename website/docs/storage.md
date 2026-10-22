---
sidebar_position: 4
---

# Token Storage

## How api-kit uses storage

api-kit does **not** ship a storage implementation. It defines a contract — `TokenStorage` — and you provide the backing store. This keeps the library platform-agnostic: the same client code runs in a browser, Node.js, or React Native with no changes.

### The contract

```ts
interface TokenStorage {
  getAccessToken():  string | null | Promise<string | null>;
  getRefreshToken(): string | null | Promise<string | null>;
  setTokens(tokens: TokenPair): void | Promise<void>;
  clearTokens():     void | Promise<void>;
}
```

All methods can be synchronous or async — api-kit `await`s them either way. That's the entire contract. Everything else is up to you.

### What goes through it

| Call | When |
|------|------|
| `getAccessToken()` | Before every outgoing request |
| `setTokens(pair)` | After every successful token refresh or login |
| `getRefreshToken()` | When a 401 triggers a refresh |
| `clearTokens()` | When `client.logout()` is called |

---

## Storage options by platform

### Browser

| Option | Security | Notes |
|--------|----------|-------|
| **HttpOnly cookies** (recommended) | High | Tokens never touch JS — server sets/clears via `Set-Cookie`. Immune to XSS. |
| `localStorage` | Low | Readable by any JS on the page. Fine for non-sensitive apps, not for tokens. |
| `sessionStorage` | Low | Same as localStorage but cleared on tab close. |

**Recommended: HttpOnly cookies** — the browser attaches them automatically. Your `TokenStorage` just needs to make the right API calls; it never reads the token values directly.

```ts
import type { TokenStorage, TokenPair } from "@88khp/api-kit";

// Tokens live in HttpOnly cookies set by the server.
// The client never reads them — the browser attaches them automatically.
class CookieTokenStorage implements TokenStorage {
  // Return null: the browser handles the Authorization header via cookie
  getAccessToken()        { return null; }
  getRefreshToken()       { return null; }

  // On login / refresh: server already set the cookies in the response.
  // Nothing to do client-side.
  setTokens(_: TokenPair) {}

  // On logout: tell the server to clear the cookies
  async clearTokens() {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
  }
}
```

> **Note:** When using HttpOnly cookies you won't have `accessTokenExpiresAt` on the client, so pre-emptive refresh won't trigger. The reactive 401 → refresh flow still works perfectly.

---

### React Native — `@88khp/rn-storage-kit` (recommended)

[`@88khp/rn-storage-kit`](https://github.com/88khp/rn-storage-kit) provides two adapters:

- **`SecureStorageAdapter`** — backed by `react-native-keychain` (iOS Keychain / Android Keystore). Values are hardware-encrypted and never logged in plain text.
- **`MMKVStorageAdapter`** — backed by `react-native-mmkv`. Fast encrypted MMKV storage for non-secret data.

Neither is the same shape as `TokenStorage`, but bridging them is a one-time 15-line adapter shown below.

#### Install

```bash
# The storage kit
npm install @88khp/rn-storage-kit

# Its peer dependencies
npm install react-native-keychain react-native-mmkv
npx pod-install
```

#### Adapter — bridge rn-storage-kit → api-kit TokenStorage

```ts
// tokenStorage.ts
import { SecureStorageAdapter } from "@88khp/rn-storage-kit";
import type { TokenStorage, TokenPair } from "@88khp/api-kit";

// Type the schema so get() is fully typed
interface TokenSchema {
  access_token:  string;
  refresh_token: string;
  token_expiry:  string; // stored as ISO / unix string
}

const secure = new SecureStorageAdapter<TokenSchema>();

export const rnSecureTokenStorage: TokenStorage = {
  getAccessToken:  () => secure.get("access_token"),
  getRefreshToken: () => secure.get("refresh_token"),

  async setTokens(tokens: TokenPair) {
    await secure.set("access_token",  tokens.accessToken);
    await secure.set("refresh_token", tokens.refreshToken);
    if (tokens.accessTokenExpiresAt) {
      await secure.set("token_expiry", String(tokens.accessTokenExpiresAt));
    }
  },

  async clearTokens() {
    await secure.remove("access_token");
    await secure.remove("refresh_token");
    await secure.remove("token_expiry");
  },
};
```

#### Use with api-kit

```ts
import { ApiClient }          from "@88khp/api-kit";
import { rnSecureTokenStorage } from "./tokenStorage";

ApiClient.getInstance({
  baseURL: "https://api.yourapp.com",
  storage: rnSecureTokenStorage,   // ← hardware-encrypted
  preemptiveRefreshSeconds: 60,
  hooks: {
    onAuthFailure() {
      navigationRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
    },
  },
});
```

Tokens are stored in the iOS Keychain / Android Keystore and **never appear in plain text in logs or MMKV**.

---

### React Native — `react-native-keychain` directly

If you are not using rn-storage-kit, you can bridge `react-native-keychain` yourself:

```ts
import * as Keychain from "react-native-keychain";
import type { TokenStorage, TokenPair } from "@88khp/api-kit";

const ACCESS_SERVICE  = "com.yourapp.access_token";
const REFRESH_SERVICE = "com.yourapp.refresh_token";

export const keychainTokenStorage: TokenStorage = {
  async getAccessToken() {
    const creds = await Keychain.getGenericPassword({ service: ACCESS_SERVICE });
    return creds ? creds.password : null;
  },

  async getRefreshToken() {
    const creds = await Keychain.getGenericPassword({ service: REFRESH_SERVICE });
    return creds ? creds.password : null;
  },

  async setTokens(tokens: TokenPair) {
    await Keychain.setGenericPassword("token", tokens.accessToken,
      { service: ACCESS_SERVICE });
    await Keychain.setGenericPassword("token", tokens.refreshToken,
      { service: REFRESH_SERVICE });
  },

  async clearTokens() {
    await Keychain.resetGenericPassword({ service: ACCESS_SERVICE });
    await Keychain.resetGenericPassword({ service: REFRESH_SERVICE });
  },
};
```

---

### Node.js

For scripts and servers use `MemoryTokenStorage` (ships with api-kit). In long-running services, back it with Redis or a database:

```ts
import type { TokenStorage, TokenPair } from "@88khp/api-kit";
import { createClient } from "redis";

const redis = createClient();
await redis.connect();

export const redisTokenStorage: TokenStorage = {
  async getAccessToken()  { return redis.get("api_kit:access_token"); },
  async getRefreshToken() { return redis.get("api_kit:refresh_token"); },

  async setTokens(tokens: TokenPair) {
    await redis.set("api_kit:access_token",  tokens.accessToken);
    await redis.set("api_kit:refresh_token", tokens.refreshToken);
  },

  async clearTokens() {
    await redis.del("api_kit:access_token", "api_kit:refresh_token");
  },
};
```

---

## Built-in adapters

api-kit ships three adapters for convenience. They are intentionally simple — for production, prefer the secure options above.

### `MemoryTokenStorage`

```ts
import { MemoryTokenStorage } from "@88khp/api-kit";
const storage = new MemoryTokenStorage();
```

In-memory. Tokens lost on reload/restart. Good for: Node.js scripts, unit tests, SSR.

### `LocalStorageTokenStorage`

```ts
import { LocalStorageTokenStorage } from "@88khp/api-kit";
const storage = new LocalStorageTokenStorage();
```

> **Not recommended for tokens.** `localStorage` is readable by any JS on the page. Prefer HttpOnly cookies for browser auth.

### `AsyncStorageTokenStorage`

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AsyncStorageTokenStorage } from "@88khp/api-kit";
const storage = new AsyncStorageTokenStorage(AsyncStorage);
```

> **Not recommended for tokens.** AsyncStorage is unencrypted plaintext on disk. Use `@88khp/rn-storage-kit` with `SecureStorageAdapter` instead.

---

## Summary — what to use

| Platform | Recommended | Why |
|----------|-------------|-----|
| Browser | HttpOnly cookies | Immune to XSS; tokens never in JS |
| React Native | `rn-storage-kit` → `SecureStorageAdapter` | iOS Keychain / Android Keystore; hardware encrypted |
| React Native (direct) | `react-native-keychain` | Same backing store, manual bridging |
| Node.js script | `MemoryTokenStorage` (built-in) | Sufficient; process lifetime = session lifetime |
| Node.js server | Redis / DB adapter | Survives restarts; enables revocation |
