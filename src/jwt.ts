/**
 * Minimal JWT decoder — no signature verification, used only to read the
 * `exp` claim for pre-emptive refresh decisions.
 *
 * Design choice: we deliberately avoid any crypto library to keep the bundle
 * small and platform-agnostic. Signature verification is the *server's*
 * responsibility; we only need the expiry timestamp on the client.
 */

export interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

/**
 * Decode the payload portion of a JWT without verifying the signature.
 * Returns null on any malformed input so callers can safely ignore errors.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // Pad to a multiple of 4
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    // atob works in browsers and modern Node (≥ 16); Buffer fallback for older Node
    const json =
      typeof atob !== "undefined"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token's `exp` claim is within `thresholdSeconds` of now.
 * Returns false if the token cannot be decoded (fail-open — let the server decide).
 */
export function isTokenExpiringSoon(token: string, thresholdSeconds: number): boolean {
  if (thresholdSeconds <= 0) return false;
  const payload = decodeJwt(token);
  if (!payload?.exp || typeof payload.exp !== "number") return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds <= thresholdSeconds;
}
