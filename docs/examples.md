# Example Usage

Full runnable examples live in [`examples/`](../examples/). This page walks through the key patterns.

---

## Node.js script

Source: [`examples/node-usage.ts`](../examples/node-usage.ts)

```ts
import { ApiClient, MemoryTokenStorage } from "@devraj-labs/api-kit";
import type { ApiKitLogger }             from "@devraj-labs/api-kit";

// 1. Storage — in-memory is fine for scripts; use Redis for long-running servers
const storage = new MemoryTokenStorage();

// 2. Logger — any object with debug/info/warn/error
//    Swap for: createLogger({ level: "debug" }).child({ module: "api-kit" })
const logger: ApiKitLogger = {
  debug: (msg, meta) => console.debug("[api-kit]", msg, meta),
  info:  (msg, meta) => console.info ("[api-kit]", msg, meta),
  warn:  (msg, meta) => console.warn ("[api-kit]", msg, meta),
  error: (msg, meta) => console.error("[api-kit]", msg, meta),
};

// 3. Initialise the singleton once
const client = ApiClient.getInstance({
  baseURL:                  "http://localhost:4000",
  storage,
  logger,
  preemptiveRefreshSeconds: 15,
  retry: { maxRetries: 3, baseDelayMs: 300 },
  hooks: {
    onAuthFailure: (err) => console.error("Auth failed", err),
    onLogout:      ()    => console.log("Logged out"),
  },
});

// 4. Login — store the tokens returned by the server
const { data } = await client.post<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}>("/auth/login", { username: "alice", password: "password123" });

await storage.setTokens(data);

// 5. Make authenticated requests — token attached automatically
const me = await client.get<{ sub: string; username: string }>("/api/me");
console.log(me.data.username); // "alice"

// 6. Concurrent requests — only one refresh fires regardless of how many 401s
await Promise.all(Array.from({ length: 5 }, () => client.get("/api/data")));

// 7. Logout
await client.logout();
```

---

## Browser — React / Vite (recommended: HttpOnly cookies)

The safest browser storage is HttpOnly cookies set by the server — tokens never touch JavaScript.
See [storage.md → Browser](./storage.md#browser) for the full `CookieTokenStorage` implementation.

```ts
// apiClient.ts — initialise once at app entry point
import { ApiClient }         from "@devraj-labs/api-kit";
import { CookieTokenStorage } from "./cookieTokenStorage"; // your implementation

ApiClient.getInstance({
  baseURL: "",
  storage: new CookieTokenStorage(),
  hooks: {
    onTokenRefreshed() {
      window.dispatchEvent(new CustomEvent("token-refreshed"));
    },
    onAuthFailure() {
      window.location.href = "/login";
    },
  },
});
```

```ts
// Anywhere else in the app — no config needed on subsequent calls
const client = ApiClient.getInstance();

export async function fetchUser() {
  const { data } = await client.get<User>("/api/me");
  return data;
}
```

---

## React Native — `@devraj-labs/rn-storage-kit` (recommended)

Tokens stored in the iOS Keychain / Android Keystore via [`SecureStorageAdapter`](https://github.com/devraj-labs/rn-storage-kit).
See [storage.md → React Native](./storage.md#react-native--devraj-labsrn-storage-kit-recommended) for setup and the full bridge adapter.

```ts
// tokenStorage.ts — bridge rn-storage-kit → api-kit TokenStorage
import { SecureStorageAdapter } from "@devraj-labs/rn-storage-kit";
import type { TokenStorage, TokenPair } from "@devraj-labs/api-kit";

interface TokenSchema {
  access_token:  string;
  refresh_token: string;
  token_expiry:  string;
}

const secure = new SecureStorageAdapter<TokenSchema>();

export const rnSecureTokenStorage: TokenStorage = {
  getAccessToken:  () => secure.get("access_token"),
  getRefreshToken: () => secure.get("refresh_token"),
  async setTokens(tokens: TokenPair) {
    await secure.set("access_token",  tokens.accessToken);
    await secure.set("refresh_token", tokens.refreshToken);
    if (tokens.accessTokenExpiresAt)
      await secure.set("token_expiry", String(tokens.accessTokenExpiresAt));
  },
  async clearTokens() {
    await secure.remove("access_token");
    await secure.remove("refresh_token");
    await secure.remove("token_expiry");
  },
};
```

```ts
// apiClient.ts
import { ApiClient }              from "@devraj-labs/api-kit";
import { createLogger }           from "@devraj-labs/logger";
import { rnSecureTokenStorage }   from "./tokenStorage";

const logger = createLogger({ level: "info" }).child({ module: "api-kit" });

ApiClient.getInstance({
  baseURL:                  "https://api.yourapp.com",
  storage:                  rnSecureTokenStorage,  // ← hardware-encrypted
  logger,
  preemptiveRefreshSeconds: 60,
  retry: { maxRetries: 3, baseDelayMs: 500 },
  hooks: {
    onAuthFailure() {
      navigationRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
    },
  },
});
```

```ts
// In any screen or hook
const client = ApiClient.getInstance();

export function useProfile() {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    client.get("/api/profile").then(r => setProfile(r.data));
  }, []);
  return profile;
}
```

---

## Using `@devraj-labs/logger`

```ts
import { createLogger, ConsoleTransport } from "@devraj-labs/logger";
import { ApiClient }                      from "@devraj-labs/api-kit";

const logger = createLogger({
  level: "debug",
  transports: [new ConsoleTransport({ format: "pretty" })],
});

ApiClient.getInstance({
  baseURL: "https://api.example.com",
  storage,
  // Child logger tags every api-kit entry with module: "api-kit"
  logger: logger.child({ module: "api-kit" }),
});
```

All api-kit log entries flow through your configured transports as structured `LogEntry` objects — filterable, routable to any sink (console, remote, batch).
