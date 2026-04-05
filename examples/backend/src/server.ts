/**
 * Demo Express server for api-kit
 *
 * Endpoints:
 *   POST /auth/login         — exchange credentials for tokens
 *   POST /auth/refresh       — exchange refresh token for a new token pair
 *   POST /auth/logout        — invalidate the refresh token
 *   GET  /api/me             — protected: returns current user
 *   GET  /api/data           — protected: returns dummy data
 *   GET  /health             — unprotected health check
 *
 * Token expiry is controlled entirely via src/config.ts (or env vars).
 * This makes it trivial to test pre-emptive refresh by setting
 * ACCESS_TOKEN_TTL=15s before starting the server.
 */

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import config from "./config";

const app = express();
app.use(express.json());
app.use(
  cors({
    // Allow the Vite dev server origin
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

// ─────────────────────────────────────────────
//  In-memory "database"
// ─────────────────────────────────────────────

interface User {
  id: string;
  username: string;
  password: string; // plaintext — demo only, never do this in prod!
}

const USERS: User[] = [
  { id: "u1", username: "alice", password: "password123" },
];

/**
 * Active refresh tokens stored in memory.
 * Production would persist these in Redis / a DB with TTL support.
 */
const activeRefreshTokens = new Set<string>();

// ─────────────────────────────────────────────
//  JWT helpers
// ─────────────────────────────────────────────

interface AccessTokenPayload {
  sub: string;
  username: string;
}

function signAccessToken(user: User): string {
  return jwt.sign(
    { sub: user.id, username: user.username } satisfies AccessTokenPayload,
    config.jwtSecret,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: config.accessTokenExpiresIn as any }
  );
}

function signRefreshToken(userId: string): string {
  const jti = uuidv4(); // unique token ID — allows per-device revocation
  const token = jwt.sign(
    { sub: userId, jti },
    config.jwtSecret,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: config.refreshTokenExpiresIn as any }
  );
  activeRefreshTokens.add(token);
  return token;
}

function issueTokenPair(user: User) {
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);

  // Decode the access token to get the absolute expiry timestamp so the
  // client can schedule a pre-emptive refresh without re-decoding.
  const decoded = jwt.decode(accessToken) as { exp: number };

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: decoded.exp, // Unix timestamp (seconds)
    tokenConfig: {
      accessTokenExpiresIn:  config.accessTokenExpiresIn,
      refreshTokenExpiresIn: config.refreshTokenExpiresIn,
    },
  };
}

// ─────────────────────────────────────────────
//  Auth middleware
// ─────────────────────────────────────────────

interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, config.jwtSecret) as AccessTokenPayload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────

/** Health check */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    tokenConfig: {
      accessTokenExpiresIn:  config.accessTokenExpiresIn,
      refreshTokenExpiresIn: config.refreshTokenExpiresIn,
    },
  });
});

/** Login */
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const user = USERS.find((u) => u.username === username && u.password === password);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  console.log(`[auth] Login: ${username}`);
  res.json(issueTokenPair(user));
});

/** Token refresh */
app.post("/auth/refresh", (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  // Check if the token is in our allowlist (prevents reuse after logout)
  if (!activeRefreshTokens.has(refreshToken)) {
    res.status(401).json({ error: "Refresh token not recognised or already revoked" });
    return;
  }

  let payload: { sub: string };
  try {
    payload = jwt.verify(refreshToken, config.jwtSecret) as { sub: string };
  } catch {
    activeRefreshTokens.delete(refreshToken);
    res.status(401).json({ error: "Refresh token expired or invalid" });
    return;
  }

  const user = USERS.find((u) => u.id === payload.sub);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  // Rotate refresh token — old one is revoked immediately
  activeRefreshTokens.delete(refreshToken);

  console.log(`[auth] Token refreshed for user: ${user.username} (delay: ${config.refreshDelayMs}ms)`);

  // Intentional delay — long enough to make the single-flight guard visible:
  // all concurrent requests queue up and drain together after this resolves.
  setTimeout(() => res.json(issueTokenPair(user)), config.refreshDelayMs);
});

/** Logout */
app.post("/auth/logout", (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    activeRefreshTokens.delete(refreshToken);
  }
  res.json({ message: "Logged out" });
});

/** Protected: current user */
app.get("/api/me", requireAuth, (req: AuthRequest, res) => {
  setTimeout(() => res.json({ user: req.user }), config.apiDelayMs);
});

/** Protected: dummy data endpoint (useful for race-condition demo) */
app.get("/api/data", requireAuth, (req: AuthRequest, res) => {
  setTimeout(
    () =>
      res.json({
        message: "Here is your protected data!",
        timestamp: new Date().toISOString(),
        user: req.user?.username,
        items: Array.from({ length: 5 }, (_, i) => ({
          id: i + 1,
          value: `item-${uuidv4().slice(0, 8)}`,
        })),
      }),
    config.apiDelayMs
  );
});

// ─────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`\n🚀 api-kit demo backend running on http://localhost:${PORT}`);
  console.log(`   Access token TTL  : ${config.accessTokenExpiresIn}`);
  console.log(`   Refresh token TTL : ${config.refreshTokenExpiresIn}`);
  console.log(`   API delay         : ${config.apiDelayMs}ms`);
  console.log(`   Refresh delay     : ${config.refreshDelayMs}ms`);
  console.log(`\n   Demo account: alice / password123\n`);
});

export default app;
