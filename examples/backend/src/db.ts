/**
 * Turso (libSQL) database for the api-kit demo backend.
 *
 * Requires two env vars:
 *   TURSO_URL    — libsql://api-kit-demo-rishav-jha-mech.aws-ap-south-1.turso.io
 *   TURSO_TOKEN  — auth token from `turso db tokens create api-kit-demo`
 *
 * For local dev without Turso, set TURSO_URL=file:./data/demo.db and omit TURSO_TOKEN.
 */

import { createClient } from "@libsql/client";

const url   = process.env.TURSO_URL   ?? "file:./data/demo.db";
const authToken = process.env.TURSO_TOKEN;

export const db = createClient({ url, authToken });

// ─────────────────────────────────────────────
//  Schema + seed
// ─────────────────────────────────────────────

export async function initDb(): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id       TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Seed demo users (idempotent)
  await db.executeMultiple(`
    INSERT OR IGNORE INTO users (id, username, password) VALUES ('u1', 'alice', 'password123');
    INSERT OR IGNORE INTO users (id, username, password) VALUES ('u2', 'bob',   'password123');
    INSERT OR IGNORE INTO users (id, username, password) VALUES ('u3', 'carol', 'letmein');
  `);
}

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  password: string;
}

// ─────────────────────────────────────────────
//  User queries
// ─────────────────────────────────────────────

export async function findUserByCredentials(username: string, password: string): Promise<User | undefined> {
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE username = ? AND password = ?",
    args: [username, password],
  });
  return result.rows[0] as unknown as User | undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as unknown as User | undefined;
}

// ─────────────────────────────────────────────
//  Refresh token queries
// ─────────────────────────────────────────────

export async function addRefreshToken(token: string, userId: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)",
    args: [token, userId],
  });
}

export async function hasRefreshToken(token: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT token FROM refresh_tokens WHERE token = ?",
    args: [token],
  });
  return result.rows.length > 0;
}

export async function removeRefreshToken(token: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM refresh_tokens WHERE token = ?",
    args: [token],
  });
}
