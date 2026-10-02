# ADR 0006 — OAuth sign-in is deferred

Status: accepted · 2026-10-02

## Decision
Credentials (email + password, bcrypt) are the only sign-in method in this release. `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
are reserved in the environment schema but not wired. Reasons: it needs a registered OAuth application and consent
screen owned by the operator, extra privacy text, and account-linking rules that must be decided with the owner.

## Consequences
Nothing in the data model blocks it: `Account` (Auth.js) already exists. Enabling it is a provider entry in `src/auth.ts`
plus a privacy-policy paragraph.
