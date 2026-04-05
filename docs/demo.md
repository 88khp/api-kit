# Running the Demo

The demo is a self-contained app that shows api-kit in action — token refresh, race-condition guard, and live expiry countdown. It is not part of the library.

## Start

From the repo root:

```bash
npm run demo
```

Installs dependencies on first run, then starts both servers:

| Server | URL |
|--------|-----|
| Backend API | http://localhost:4000 |
| Web app | http://localhost:5173 |

Login with `alice / password123`.

## Configure token TTL

Edit `examples/backend/src/config.ts` or pass env vars:

```bash
ACCESS_TOKEN_TTL=10s npm run demo   # short — refresh triggers quickly
ACCESS_TOKEN_TTL=15m npm run demo   # production-like
REFRESH_TOKEN_TTL=7d npm run demo
```

Default is `30s` access / `1d` refresh — short enough to observe refresh without waiting long.

## Configure artificial delays

The backend adds intentional latency so concurrent behaviour is visible in DevTools.

| Env var | Default | What it controls |
|---|---|---|
| `API_DELAY_MS` | `500` | Every `/api/*` response |
| `REFRESH_DELAY_MS` | `4000` | The `/auth/refresh` response |

```bash
# Slower API calls — requests queue up longer
API_DELAY_MS=500 npm run demo

# Faster refresh — less wait between retries
REFRESH_DELAY_MS=500 npm run demo

# Combine
API_DELAY_MS=200 REFRESH_DELAY_MS=3000 ACCESS_TOKEN_TTL=15s npm run demo
```

The 2 s refresh delay is the key one: when you fire 5 concurrent requests and the token is expired, you will see all 5 `/api/data` calls pending in DevTools for ~2 s while exactly one `/auth/refresh` runs, then all 5 complete together.

## What to look at

**Token Status bar** — live countdown to expiry. Turns amber when pre-emptive refresh is about to fire (≤ 10 s remaining).

**Race Condition Demo** — set concurrency to 5–10 and click Fire Requests after the token expires. Open DevTools → Network: you will see N `/api/data` requests but exactly **one** `/auth/refresh` call.

**Silent refresh counter** — increments each time the client refreshes without a 401, demonstrating pre-emptive refresh.

## Structure

```
demo/
├── package.json   # owns concurrently — isolated from library deps
└── run.js         # installs backend + web then starts both

examples/
├── backend/       # Express server — the only backend used by the demo
│   └── src/
│       ├── config.ts   # token TTL (env-driven)
│       └── server.ts   # /auth/login · /auth/refresh · /api/data · /api/me
└── web/           # Vite + React + Tailwind demo app
```
