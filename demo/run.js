#!/usr/bin/env node
/**
 * api-kit demo launcher
 *
 * Installs dependencies for both the backend and the web app (if needed),
 * then starts both servers concurrently.
 *
 * Usage:
 *   cd demo && npm install && npm start
 *   — or via the repo-root alias —
 *   npm run demo          (see root package.json)
 *
 * This file is completely separate from the library (src/) and is never
 * published to npm. It only coordinates the two demo processes.
 */

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs   = require("fs");

const root    = path.resolve(__dirname, "..");
const backend = path.join(root, "examples", "backend");
const web     = path.join(root, "examples", "web");

// ── Install dependencies if node_modules is missing ──────────────────────────

function installIfNeeded(dir) {
  const nm = path.join(dir, "node_modules");
  if (!fs.existsSync(nm)) {
    console.log(`\n→ Installing dependencies in ${path.relative(root, dir)}…`);
    execSync("npm install", { cwd: dir, stdio: "inherit" });
  }
}

installIfNeeded(backend);
installIfNeeded(web);

// ── Launch both with concurrently ────────────────────────────────────────────

const { concurrently } = require("concurrently");

console.log(`
┌────────────────────────────────────────────┐
│  api-kit demo                              │
│                                            │
│  Backend  →  http://localhost:4000         │
│  Web app  →  http://localhost:5173         │
│                                            │
│  Demo account: alice / password123         │
└────────────────────────────────────────────┘
`);

concurrently(
  [
    {
      command: "npm run dev",
      cwd: backend,
      name: "backend",
      prefixColor: "cyan",
    },
    {
      command: "npm run dev",
      cwd: web,
      name: "web",
      prefixColor: "magenta",
    },
  ],
  {
    killOthers: ["failure", "success"],
    restartTries: 0,
    prefix: "[{name}]",
    timestampFormat: "HH:mm:ss",
  }
).result.catch(() => process.exit(1));
