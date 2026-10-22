---
sidebar_position: 5
---

# Logger Integration

api-kit accepts any logger at initialisation time via the `logger` config option. It does not ship a logger or depend on one — you bring your own.

## Interface

```ts
interface ApiKitLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info (message: string, meta?: Record<string, unknown>): void;
  warn (message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

This is structurally identical to the `Logger` and `ChildLogger` classes exported by `@88khp/logger`, so no adapter is needed.

## Using @88khp/logger

```ts
import { createLogger } from "@88khp/logger";
import { ApiClient }    from "@88khp/api-kit";

// Root logger — configure once at app startup
const logger = createLogger({ level: "debug" });

ApiClient.getInstance({
  baseURL: "https://api.example.com",
  storage,

  // Pass a scoped child so every api-kit log line is tagged with module: "api-kit"
  logger: logger.child({ module: "api-kit" }),
});
```

All api-kit log entries will arrive at your logger's configured transports (ConsoleTransport, BatchTransport, etc.) with the standard `LogEntry` shape — `timestamp`, `levelName`, `message`, `meta`, `context`.

## Using a plain console object

```ts
import type { ApiKitLogger } from "@88khp/api-kit";

const logger: ApiKitLogger = {
  debug: (msg, meta) => console.debug("[api-kit]", msg, meta),
  info:  (msg, meta) => console.info ("[api-kit]", msg, meta),
  warn:  (msg, meta) => console.warn ("[api-kit]", msg, meta),
  error: (msg, meta) => console.error("[api-kit]", msg, meta),
};

ApiClient.getInstance({ baseURL, storage, logger });
```

## Disabling logs entirely

Omit `logger` from the config. All internal log calls become no-ops — zero overhead.

```ts
ApiClient.getInstance({ baseURL, storage }); // no logger key = silent
```

## What api-kit logs

| Level | When |
|-------|------|
| `debug` | Access token attached to a request |
| `debug` | Calling the refresh endpoint |
| `debug` | Request queued behind an in-flight refresh |
| `info`  | Client initialised |
| `info`  | Pre-emptive refresh triggered |
| `info`  | Token refreshed — queued requests replaying |
| `info`  | User logged out |
| `warn`  | Pre-emptive refresh failed (request proceeds anyway) |
| `warn`  | Retrying a request (shows attempt, delay, status) |
| `error` | Token refresh failed — all queued requests rejected |

---

Next: [Race Condition Guard](./race-condition.md)
