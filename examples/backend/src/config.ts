/**
 * Backend configuration — all token expiry values are configurable here
 * (or via environment variables so ops can tune without a redeploy).
 *
 * Design choice: centralise every tunable in one object so the server has a
 * single source of truth and the values are visible at a glance.
 */

export interface TokenConfig {
  /** JWT access-token lifetime (jsonwebtoken expiresIn format) */
  accessTokenExpiresIn: string;
  /** JWT refresh-token lifetime */
  refreshTokenExpiresIn: string;
  /** Signing secret — rotate via env in production */
  jwtSecret: string;
  /**
   * Artificial delay added to every protected API response (ms).
   * Makes concurrent requests visually distinct in the Network tab.
   * Default: 100ms
   */
  apiDelayMs: number;
  /**
   * Artificial delay added to the /auth/refresh response (ms).
   * Longer than apiDelayMs so the single-flight guard is easy to observe —
   * all queued requests visibly wait while refresh is in flight.
   * Default: 2000ms
   */
  refreshDelayMs: number;
}

const config: TokenConfig = {
  // ── Token lifetimes ───────────────────────────────────────────────────
  // Short values (e.g. "15s") make the race-condition demo easy to trigger.
  // Production typically uses "15m" for access and "7d" for refresh.
  accessTokenExpiresIn:  process.env.ACCESS_TOKEN_TTL   ?? "30s",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_TTL  ?? "1d",
  jwtSecret:             process.env.JWT_SECRET          ?? "super-secret-dev-key-change-in-prod",

  // ── Artificial delays — tune to make the demo more visible ────────────
  apiDelayMs:     Number(process.env.API_DELAY_MS     ?? 500),   // 500 ms per API call
  refreshDelayMs: Number(process.env.REFRESH_DELAY_MS ?? 4000),  // 4 s for refresh
};

export default config;
