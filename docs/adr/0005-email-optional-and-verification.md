# ADR 0005 — Email is optional; verification adapts

Status: accepted · 2026-10-02

## Context
Registration, email verification and password reset need to send email, but the project may run without a provider
(development, first deployment).

## Decision
`src/lib/email` has one interface with two implementations: Resend (`EMAIL_PROVIDER=resend` with `RESEND_API_KEY`; sender
`EMAIL_FROM`) and none (the default). **An address is never marked verified without a successful confirmation.** Without a
provider the account is still created and can sign in, stays unconfirmed, and the visitor is told that the confirmation
mail cannot be sent right now (account page says the same instead of offering a resend button); password reset says that
email is unavailable. Members of the public (USER, BUSINESS_OWNER) cannot submit listings, jobs/events or reviews until
confirmed, with or without a provider; staff accounts (EMPLOYEE and up) are created by administrators and are exempt.
Tokens are random 256-bit values; only the SHA-256 hash and the purpose are stored; each is single-use (deleted by count)
and expires (`src/config/site.ts`).

## Consequences
Configure a provider before production traffic (without one, new members can never submit); the owner details check (`LEGAL_*`, `EMAIL_*`) reports what is missing.
Resetting a password does not revoke existing JWT sessions (they expire on their own).
