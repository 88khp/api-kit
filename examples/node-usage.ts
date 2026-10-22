/**
 * Example: using api-kit in a Node.js script with in-memory token storage.
 *
 * Run with:
 *   npx ts-node examples/node-usage.ts
 *
 * Prerequisites: the demo backend must be running:
 *   cd examples/backend && npm run dev
 *
 * ── Logger ───────────────────────────────────────────────────────────────────
 * To use @88khp/logger, install it and pass the instance:
 *
 *   import { createLogger } from "@88khp/logger";
 *   const logger = createLogger({ level: "debug" });
 *   // or scoped: logger.child({ module: "api-kit" })
 *   ApiClient.getInstance({ ..., logger });
 *
 * Without the package, any object with debug/info/warn/error works:
 *   ApiClient.getInstance({ ..., logger: console });
 */

import { ApiClient, MemoryTokenStorage } from "../src/index";
import type { ApiKitLogger } from "../src/index";

// ── Storage ───────────────────────────────────────────────────────────────────

const storage = new MemoryTokenStorage();

// ── Logger (plain console — swap for @88khp/logger in production) ───────

const logger: ApiKitLogger = {
  debug: (msg, meta) => console.debug("[api-kit]", msg, meta ?? ""),
  info:  (msg, meta) => console.info ("[api-kit]", msg, meta ?? ""),
  warn:  (msg, meta) => console.warn ("[api-kit]", msg, meta ?? ""),
  error: (msg, meta) => console.error("[api-kit]", msg, meta ?? ""),
};

// ── Initialise the singleton ──────────────────────────────────────────────────

const client = ApiClient.getInstance({
  baseURL: "http://localhost:4000",
  refreshEndpoint: "/auth/refresh",
  storage,
  logger,
  preemptiveRefreshSeconds: 15,
  retry: {
    maxRetries: 3,
    baseDelayMs: 300,
    maxDelayMs: 5_000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    onTokenRefreshed(tokens) {
      console.log("✅ Tokens silently refreshed", {
        expiresAt: tokens.accessTokenExpiresAt
          ? new Date(tokens.accessTokenExpiresAt * 1000).toISOString()
          : "unknown",
      });
    },
    onAuthFailure(error) {
      console.error("🚨 Auth failed — redirect to login", error);
    },
    onLogout() {
      console.log("👋 Logged out");
    },
  },
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

interface User {
  sub: string;
  username: string;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n── Step 1: Login ───────────────────────────────────────\n");

  const loginRes = await client.post<LoginResponse>("/auth/login", {
    username: "alice",
    password: "password123",
  });

  await storage.setTokens({
    accessToken:          loginRes.data.accessToken,
    refreshToken:         loginRes.data.refreshToken,
    accessTokenExpiresAt: loginRes.data.accessTokenExpiresAt,
  });

  console.log("Logged in!", {
    expiresAt: new Date(loginRes.data.accessTokenExpiresAt * 1000).toISOString(),
  });

  console.log("\n── Step 2: Fetch protected data ────────────────────────\n");

  const dataRes = await client.get<{ message: string; items: unknown[] }>("/api/data");
  console.log("Data:", dataRes.data.message, `(${dataRes.data.items.length} items)`);

  console.log("\n── Step 3: Concurrent requests (race-condition test) ───\n");
  console.log("Firing 5 requests simultaneously…");

  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      client.get<{ message: string }>(`/api/data?req=${i + 1}`)
    )
  );

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      console.log(`  Request ${i + 1}: ✅ ${result.value.data.message}`);
    } else {
      console.log(`  Request ${i + 1}: ❌`, result.reason);
    }
  });

  console.log("\n── Step 4: Logout ──────────────────────────────────────\n");
  await client.logout();
  console.log("Done.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
