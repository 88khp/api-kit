/**
 * Turso database client using the Hrana HTTP API directly via fetch.
 *
 * Avoids @libsql/client's native dependencies which don't bundle
 * cleanly on Vercel serverless.
 *
 * Requires:
 *   TURSO_URL    — libsql://... or https://... URL
 *   TURSO_TOKEN  — auth token
 */

const rawUrl = process.env.TURSO_URL ?? "";
// Convert libsql:// → https://
const baseUrl = rawUrl.replace(/^libsql:\/\//, "https://");
const authToken = process.env.TURSO_TOKEN ?? "";

async function sql(query: string, args: (string | number | null)[] = []): Promise<{ rows: Record<string, string | number | null>[] }> {
  const res = await fetch(`${baseUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: query,
            args: args.map((v) =>
              v === null
                ? { type: "null" }
                : typeof v === "number"
                ? { type: "integer", value: String(v) }
                : { type: "text", value: v }
            ),
          },
        },
        { type: "close" },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso HTTP error ${res.status}: ${text}`);
  }

  const data = await res.json() as any;
  const result = data.results?.[0];
  if (result?.type === "error") throw new Error(result.error?.message ?? "Unknown DB error");

  const cols: string[] = result?.response?.result?.cols?.map((c: any) => c.name) ?? [];
  const rawRows: any[][] = result?.response?.result?.rows ?? [];
  const rows = rawRows.map((row) => {
    const obj: Record<string, string | number | null> = {};
    cols.forEach((col, i) => {
      const cell = row[i];
      obj[col] = cell?.type === "null" ? null : cell?.value ?? null;
    });
    return obj;
  });

  return { rows };
}

// ─────────────────────────────────────────────
//  Schema + seed
// ─────────────────────────────────────────────

export async function initDb(): Promise<void> {
  await sql(`CREATE TABLE IF NOT EXISTS users (
    id       TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )`);

  await sql(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Seed demo users (idempotent)
  await sql("INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)", ["u1", "alice", "password123"]);
  await sql("INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)", ["u2", "bob", "password123"]);
  await sql("INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)", ["u3", "carol", "letmein"]);
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
  const { rows } = await sql("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
  return rows[0] as unknown as User | undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const { rows } = await sql("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] as unknown as User | undefined;
}

// ─────────────────────────────────────────────
//  Refresh token queries
// ─────────────────────────────────────────────

export async function addRefreshToken(token: string, userId: string): Promise<void> {
  await sql("INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)", [token, userId]);
}

export async function hasRefreshToken(token: string): Promise<boolean> {
  const { rows } = await sql("SELECT token FROM refresh_tokens WHERE token = ?", [token]);
  return rows.length > 0;
}

export async function removeRefreshToken(token: string): Promise<void> {
  await sql("DELETE FROM refresh_tokens WHERE token = ?", [token]);
}
