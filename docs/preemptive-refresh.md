# Pre-emptive Refresh

## What it is

Instead of waiting for a request to fail with 401, api-kit can refresh the token *before* it expires — eliminating the user-visible round trip of `request → 401 → refresh → retry`.

## How it works

Before each outgoing request, the request interceptor decodes the JWT payload locally (no network call — just base64 decode) and reads the `exp` claim. If the token expires within `preemptiveRefreshSeconds`, a refresh is triggered immediately and the request is held until the new token is ready.

```
Without pre-emptive refresh:
  send request → server returns 401 → refresh → replay request   (2 round trips)

With pre-emptive refresh:
  detect near-expiry → refresh → send request with fresh token   (1 round trip)
```

## Configuration

```ts
ApiClient.getInstance({
  baseURL: "...",
  storage,
  preemptiveRefreshSeconds: 60,  // refresh 60 s before expiry — default
  // preemptiveRefreshSeconds: 0 // disable entirely
});
```

## Requirements

The server must return `accessTokenExpiresAt` (Unix timestamp in seconds) alongside the tokens so the storage can record it. The built-in storage implementations pass this through automatically when it is present.

```ts
// Server login / refresh response shape
{
  accessToken:          "eyJ...",
  refreshToken:         "eyJ...",
  accessTokenExpiresAt: 1712345678  // ← required for pre-emptive refresh
}
```

api-kit also decodes the `exp` claim from the JWT itself as a fallback, so pre-emptive refresh works even if `accessTokenExpiresAt` is not stored — as long as the JWT contains a standard `exp` claim.

## Failure behaviour

If the pre-emptive refresh fails (e.g. network blip), the original request is still sent with the current (still-valid-for-a-moment) token. If the server then rejects it with 401, the normal reactive refresh flow takes over. The feature is strictly an optimisation — it cannot make things worse.

## JWT decoder

api-kit ships a minimal JWT decoder in [src/jwt.ts](../src/jwt.ts) used only to read `exp`. It does **not** verify the signature — that is the server's responsibility.

```ts
import { decodeJwt, isTokenExpiringSoon } from "@devraj-labs/api-kit";

const payload = decodeJwt(accessToken);
// { sub: "u1", exp: 1712345678, iat: 1712342078, ... }

const aboutToExpire = isTokenExpiringSoon(accessToken, 60); // true if exp ≤ now + 60s
```

---

Next: [Example Usage](./examples.md)
