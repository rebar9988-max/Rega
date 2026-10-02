# ADR 0005 — Email is optional; verification adapts

Status: accepted · 2026-10-02

## Context
Registration, email verification and password reset need to send email, but the project may run without a provider
(development, first deployment).

## Decision
`src/lib/email` has one interface with two implementations: Resend (`EMAIL_PROVIDER=resend` with `RESEND_API_KEY`; sender `EMAIL_FROM`) and
none (the default). Without a provider, a new address cannot be verified, so it is marked verified at registration (documented in
`features/auth/actions.ts`) and password reset says that email is unavailable instead of pretending to send. With a
provider, accounts must verify before submitting listings or reviews. Tokens are random 256-bit values; only the SHA-256
hash and the purpose are stored; each is single-use (deleted by count) and expires (`src/config/site.ts`).

## Consequences
Configure a provider before production traffic; the owner details check (`LEGAL_*`, `EMAIL_*`) reports what is missing.
Resetting a password does not revoke existing JWT sessions (they expire on their own).
