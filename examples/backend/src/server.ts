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
 * Refresh tokens are persisted in Turso (libSQL) so sessions survive
 * cold starts. Multiple users and concurrent sessions are fully supported.
 */

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import config from "./config";
import {
  initDb,
  findUserByCredentials,
  findUserById,
  addRefreshToken,
  hasRefreshToken,
  removeRefreshToken,
  type User,
} from "./db";

const app = express();
app.use(express.json());

// In production (Vercel), set ALLOWED_ORIGINS to a comma-separated list of
// allowed frontend URLs, e.g. "https://your-web.vercel.app".
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

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

async function signRefreshToken(userId: string): Promise<string> {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: userId, jti },
    config.jwtSecret,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: config.refreshTokenExpiresIn as any }
  );
  await addRefreshToken(token, userId);
  return token;
}

async function issueTokenPair(user: User) {
  const accessToken  = signAccessToken(user);
  const refreshToken = await signRefreshToken(user.id);
  const decoded = jwt.decode(accessToken) as { exp: number };

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: decoded.exp,
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
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    tokenConfig: {
      accessTokenExpiresIn:  config.accessTokenExpiresIn,
      refreshTokenExpiresIn: config.refreshTokenExpiresIn,
    },
  });
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const user = await findUserByCredentials(username, password);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  console.log(`[auth] Login: ${username}`);
  res.json(await issueTokenPair(user));
});

app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  if (!(await hasRefreshToken(refreshToken))) {
    res.status(401).json({ error: "Refresh token not recognised or already revoked" });
    return;
  }

  let payload: { sub: string };
  try {
    payload = jwt.verify(refreshToken, config.jwtSecret) as { sub: string };
  } catch {
    await removeRefreshToken(refreshToken);
    res.status(401).json({ error: "Refresh token expired or invalid" });
    return;
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  await removeRefreshToken(refreshToken);

  console.log(`[auth] Token refreshed for user: ${user.username} (delay: ${config.refreshDelayMs}ms)`);

  setTimeout(async () => res.json(await issueTokenPair(user)), config.refreshDelayMs);
});

app.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await removeRefreshToken(refreshToken);
  }
  res.json({ message: "Logged out" });
});

app.get("/api/me", requireAuth, (req: AuthRequest, res) => {
  setTimeout(() => res.json({ user: req.user }), config.apiDelayMs);
});

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

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 api-kit demo backend running on http://localhost:${PORT}`);
    console.log(`   Access token TTL  : ${config.accessTokenExpiresIn}`);
    console.log(`   Refresh token TTL : ${config.refreshTokenExpiresIn}`);
    console.log(`   API delay         : ${config.apiDelayMs}ms`);
    console.log(`   Refresh delay     : ${config.refreshDelayMs}ms`);
    console.log(`\n   Demo accounts:`);
    console.log(`     alice / password123`);
    console.log(`     bob   / password123`);
    console.log(`     carol / letmein\n`);
  });
}).catch((err) => {
  console.error("Failed to initialise database:", err);
  process.exit(1);
});

export default app;
