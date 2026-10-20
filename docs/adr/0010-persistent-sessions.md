# ADR 0010 — Persistent sign-in (90 days, rolling) and ending sessions

Date: 2026-10-20. Status: accepted. Scope: authentication and session persistence only.

## Context
Sign-in is Auth.js (credentials + optional social providers) with a JWT session in a secure, HttpOnly cookie. The session lasted
14 days from sign-in and was never renewed. Verified from the installed Auth.js (`@auth/core` 0.41.3, `next-auth` 5.0.0-beta.32):
the cookie is written with `expires = now + maxAge` at sign-in, and re-issued (new JWT, new cookie expiry) only when the session
endpoint, a middleware wrapper or a route handler answers the request; `auth()` in a server component discards the cookie it
would set. REGA only calls `auth()` in server components and actions, uses no `SessionProvider`/`useSession` and no auth
middleware, so nothing ever renewed the cookie: every account had to sign in again exactly 14 days after its last sign-in,
however active it was.

## Decision
- `maxAge` is 90 days (`SESSION_MAX_AGE_SECONDS`). Cookie defaults stay Auth.js's: HttpOnly, SameSite=Lax, path `/`, Secure on
  https, host-only (the apex redirects to `www`, so there is one cookie host). No token is ever stored in browser storage.
- Rolling renewal: the signed-in shell header and the dashboard layout render `SessionRenewal`, which asks Auth.js's own
  `/api/auth/session` endpoint once per page load and when a tab that stayed open becomes visible again after 6 hours. The
  response re-issues the cookie (server-side expiry and cookie expiry). Anonymous pages render nothing extra, so the edge
  cache is unaffected. A failed request never signs anybody out.
- A session ends only by: explicit logout (`signOut`, which clears the cookie and keeps the account and its data); 90 days
  without use; account deleted or not active; a password change or reset (a one-way marker of the password hash is part of the
  encrypted token and compared at each re-check); cleared cookies / private browsing. All of these lead to the sign-in page.
- Accounts are never created at sign-in for an existing identity: `User.email` is unique and `Account` is keyed by
  (provider, providerAccountId); linking a social identity to an existing account still requires a provider-verified and
  confirmed REGA address (ADR 0009).

## Consequences
- Tokens issued before this change have no password marker and a 14-day expiry: they stay valid and are upgraded to 90 days by
  the next renewal; a deployment signs nobody out.
- A stolen cookie stays valid while it is used and until the password changes; there is no per-device session list or
  "sign out everywhere" button (would need a schema change).
- `AUTH_SECRET` must stay the same across deployments (it already must: it encrypts the token). Changing it signs everyone out.
