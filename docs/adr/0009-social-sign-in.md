# ADR 0009 — Social sign-in (Google, Facebook, Apple)

Status: accepted · 2026-10-20 · supersedes the "deferred" decision of ADR 0006

## Decision
Visitors can continue with Google, Facebook or Apple on the registration and sign-in pages, and a "log in or create an
account" chooser lives at `/{locale}/auth`. E-mail + password stays exactly as it was.

- **A provider is offered only when both its id and secret are configured** (`AUTH_<PROVIDER>_ID` / `_SECRET`). The
  Auth.js config is built per request (`buildAuthConfig`), so the Worker's runtime secrets decide. With nothing
  configured (CI, production today) no social button exists and both pages render as before.
- **Identity = provider + provider account id** (`Account` table, which already existed; no migration). Provider tokens
  are never stored.
- **Linking to an existing REGA account by e-mail** happens only if all of: the provider vouches the address
  (`email_verified` from Google/Apple; Facebook never does), the REGA account's address is confirmed, the account is a
  public role (never staff), and it is active. Otherwise the visitor is told to sign in with their password.
  This blocks pre-hijacking (someone registering a victim's address first) and takeover through an unverified address.
- **Accounts are created only from the registration page** (intent `register`). A plain sign-in with an unknown identity
  is sent to registration. Role comes from a whitelist (`USER` / `BUSINESS_OWNER`) in a short-lived httpOnly cookie
  (`rega-social`); a forged or missing cookie falls back to "plain sign-in, least-privileged role".
- Deleted and suspended accounts are refused; nothing is ever deleted or merged automatically; existing sessions are untouched.
- Redirect targets are same-site relative paths only.

## Callback URLs (register these with each provider)
`https://www.regaplatform.com/api/auth/callback/google`, `.../facebook`, `.../apple`. Also set `AUTH_URL` to the site origin.

## Owner actions needed before any button appears
Create the Google OAuth client, Facebook app and (paid Apple Developer membership) Apple Services ID with its signed client
secret; add them as GitHub secrets and run the "Sync Worker runtime secrets" workflow.

## Known limits and residual risks
- No live OAuth flow could be exercised in this environment (no credentials); logic is covered by unit tests, wiring by
  source-level guards and CI. Apple (form_post, SameSite=None cookies) is the least verified and must be tested first
  with real credentials. Apple client secrets expire (max 6 months) and must be regenerated.
- Facebook may share no e-mail; that case is refused with a message.
- "By continuing you accept the Terms and Privacy Policy" wording on the registration page needs owner/legal approval.
- Accounts created through a provider have no password; they can set one through "forgot password" if the address is theirs.
