# api-kit

Production-grade, platform-agnostic Axios API client with automatic token management.

## Features

| # | Feature |
|---|---------|
| 1 | **Pluggable token storage** — you own the storage; api-kit just calls it |
| 2 | **Secure-first** — works with HttpOnly cookies (browser) and `@devraj-labs/rn-storage-kit` / `react-native-keychain` (React Native) |
| 3 | **Auto token attach** — every request gets `Authorization: Bearer <token>` |
| 4 | **Auto 401 refresh** — transparently refreshes and replays the failed request |
| 5 | **Race-condition guard** — only ONE refresh fires regardless of concurrent 401s |
| 6 | **Auth event hooks** — `onTokenRefreshed` · `onAuthFailure` · `onLogout` |
| 7 | **Pre-emptive refresh** — configurable `preemptiveRefreshSeconds`; set to `0` to disable |
| 8 | **Exponential back-off** — retries transient errors with jitter |
| 9 | **Bring-your-own logger** — any object with `debug/info/warn/error` (`console`, `@devraj-labs/logger`, etc.) |
| 10 | **Singleton** — one shared instance, initialised once, used everywhere |

## Quick start

```bash
npm install @devraj-labs/api-kit
```

```ts
// 1. Initialise once at app entry point
import { ApiClient } from "@devraj-labs/api-kit";
import { myStorage } from "./storage"; // bring your own — see docs/storage.md

ApiClient.getInstance({
  baseURL: "https://api.example.com",
  storage: myStorage,
  hooks: {
    onAuthFailure() { window.location.href = "/login"; },
  },
});

// 2. Use anywhere — no config needed on subsequent calls
const client = ApiClient.getInstance();
const { data } = await client.get<User>("/api/me");
```

## Documentation

| Doc | Description |
|-----|-------------|
| [Getting Started](docs/getting-started.md) | Install, minimal setup, platform examples |
| [Configuration](docs/configuration.md) | All config options with types and defaults |
| [Token Storage](docs/storage.md) | Built-in adapters and custom storage |
| [Logger Integration](docs/logger.md) | Using @devraj-labs/logger or any compatible logger |
| [Race Condition Guard](docs/race-condition.md) | How concurrent 401s are handled |
| [Pre-emptive Refresh](docs/preemptive-refresh.md) | Proactive token renewal before expiry |
| [Examples](docs/examples.md) | Node.js · Browser · React Native · custom storage |
| [Demo](docs/demo.md) | Running the interactive demo app |

## License

MIT
