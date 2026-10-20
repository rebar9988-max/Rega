# REGA — Project Memory

Central shared memory document:
https://docs.google.com/open?id=1pp6GW-UM9AQ9TuUJHumziaujxB6ZOza5S3xwA6dmxu4

This repository file is the local entry point for REGA project memory.

## Working method
Every substantial task follows:

READ MEMORY → VERIFY GITHUB → VERIFY CLOUDFLARE → IDENTIFY ROOT CAUSE → FIX ONLY RESPONSIBLE LAYER → TEST → VERIFY LIVE → UPDATE MEMORY

## Source-of-truth priority
1. GitHub — code, branches, PRs, workflows, commits and repository configuration.
2. Cloudflare — live Worker, routes, runtime configuration, builds and deployments.
3. Google Drive / Docs — durable decisions, runbooks, blockers, incident notes and continuation context.

If memory conflicts with verified live state, live state wins and memory must be corrected.

## Project identity
- Project: REGA
- Repository: `rebar9988-max/Rega`
- Production: `https://www.regaplatform.com`
- Cloudflare Worker: `rega-platform`
- Production branch: `main`

## Verified checkpoint — 2026-10-15
- Cloudflare Worker `rega-platform` exists.
- Routes observed: `www.regaplatform.com/*` and `regaplatform.com/*`.
- Active deployment observed serving 100% traffic.
- Active version observed: `bba819a0-901a-424f-9bcf-38d19799cb9d`.
- Deployment source observed: Wrangler.
- Establishing this memory system made no production runtime change.

## Verified GitHub state and open risk — 2026-10-15 (later)
- `main` has no branch protection or required checks (GitHub API `protected: false`). Hosted GitHub Actions run normally.
- Every push to `main` deploys production twice, independently: the `Deploy to Cloudflare Workers` workflow
  (`npx wrangler deploy`, not gated on CI) and Cloudflare Workers Builds (`Workers Builds: rega-platform`). The deploy
  workflow finishes before the `CI` workflow's E2E tests, so a commit can reach production before CI has verified it.
  Example: docs commit `93888c9` — deploy success, Workers Builds version `2baa6e60`, CI still running at that moment.
  Not changed: choosing a single, CI-gated deploy path changes production infrastructure and needs an owner decision.
- The active version above (`bba819a0`) was observed before those two deploys and is probably stale. No Cloudflare
  connector was available in this session to confirm the current active version; the public site loaded normally.
- Agent entry points: `AGENTS.md` (Codex) points to `CLAUDE.md` §6, which now includes the troubleshooting rules.

## Next safe continuation point
Follow `CLAUDE.md` §6 for every task. Re-check the active Cloudflare version before any production work. Open PR:
#10 (read-only Workers Builds log diagnostics). Owner decision pending: one CI-gated production deploy path.

## Safety
- Never store secrets or secret values here.
- Never reset or delete production data.
- Never deploy unverified changes.
- Preserve REGA architecture, routes, branding, i18n and RTL/LTR behavior unless explicitly authorized.

## Update format
After material work append:
- date
- task/problem
- root cause
- change made
- files/systems affected
- tests run
- PR/commit
- Cloudflare verification
- production impact
- blockers
- next safe continuation point


## Deploy-path repair — 2026-10-15
Owner approved removing the duplicate/ungated production deployment risk.

Target architecture:
- CI remains the quality gate on `main`.
- `.github/workflows/deploy.yml` deploys only after a successful `CI` `workflow_run`, and checks out that exact verified SHA.
- `workflow_dispatch` remains a manual fallback.
- Cloudflare Workers Builds production deploy is changed to dry-run only, so it cannot publish a second version.
- Result: one production deployment path, after CI success.

Branch: `chatgpt/ci-gated-single-deploy-20261015`.
No application code, routes, database schema, secrets, or branding are changed by this repair.


## Strict-scope features — 2026-10-20 (branch `claude/three-features-registration-offers-whatsapp`)
Owner-authorised scope, exactly three features: (1) three-step business registration (improving the existing form),
(2) genuine business offers and discounts, (3) WhatsApp contact button on business profiles.

- Root cause / audit: the owner flow was one long single-page form; offers and a public WhatsApp number did not exist.
  Empty public listings were investigated read-only: production has zero businesses, so empty results are correct
  (no code defect; nothing was seeded, approved or published).
- Registration: owners (who submit for review) get a 3-step wizard in the same `BusinessForm` (1 basics, 2 location + hours,
  3 contact/WhatsApp/logo/cover/photos + review). Same action, same validation, same approval workflow; staff who publish
  keep the single-page form. New `draft` intent saves progress without changing status; a repeated create within 10 min
  for the same person and name reuses the first draft (advisory lock), so a double tap cannot create duplicates.
- Offers: `Offer` model + `/dr/offers/*` (permission `business.write` + `assertBusinessAccess` on the business read from
  the database). Discount is none | percent 1-90 | amount with currency; no original price anywhere; text may not claim
  another percentage; dates are calendar days in the business country's time zone; "running" is computed on every read
  and the public list also re-checks the clock in the browser (pages are edge-cached up to 5 min + SWR).
- WhatsApp: `Business.whatsapp` (public business number, E.164, never the account phone); `src/lib/whatsapp.ts`
  normalises/validates; the button only renders for a stored valid number and links to `https://wa.me/<digits>`.
- Database: ADDITIVE migration `20261020090000_business_whatsapp_offers` (2 columns on `Business`, new table `Offer`
  with CHECK constraints). No existing row or column is changed. It is NOT applied to production.
- Blocker for production: the new code reads the new columns on every business page, and `main` deploys after CI, so the
  migration must be applied FIRST through the manual `DB migrate` workflow (needs the owner's `confirm=migrate` and
  `backup_confirmed=backup-verified`). Do not merge before that.
- Environment limitations of the authoring session: no npm registry access (policy-denied), so lint/typecheck/build/e2e
  were verified through GitHub CI, not locally; no Cloudflare connector (live version not verifiable from here).
- Local checks run: 19 unit tests of the pure WhatsApp/offer logic (pass), TypeScript syntax check of all changed files,
  7-locale key parity and placeholder parity for all new texts.
- Next safe continuation point: read CI on the PR; owner runs the DB migration; then merge; then verify the three
  features live (WhatsApp link, offer expiry, wizard) and record the result here and in the central Doc.

## Authentication audit and register/login polish — 2026-10-20
Task: audit the existing registration and login, polish only their UI. Scope locked to authentication.

Audit findings (verified from code, `docs/adr/0005`, `docs/adr/0006`, Resend and the public pages):
- Sign-in is Auth.js Credentials (email + bcrypt password, JWT sessions). There is no OAuth provider and no six-digit OTP.
  Email confirmation and password reset use single-use 256-bit link tokens (SHA-256 hash stored, 48 h / 60 min expiry).
  These were kept: replacing a working mechanism was out of scope.
- Already in place and left unchanged: per-account and per-IP login limits, constant-time login for unknown accounts,
  same-site-only `next` redirects, honeypot + rate-limited forms, no OTP/secret values in logs.
- Resend: sending domain `regaplatform.com` is verified; a REGA verification mail sent 2026-10-06 shows status `delivered`.
  No newer REGA verification mail was visible, so current production delivery is not freshly proven.
- No Facebook/Google/Apple buttons were added: nothing is configured (ADR 0006). Enabling them needs owner-registered OAuth
  apps (Apple also needs a paid developer membership), their credentials in the Worker secrets, and an owner decision on
  account-linking (never link on an unverified email).
- Known gap, unchanged: a password reset does not revoke existing JWT sessions (ADR 0005); fixing it needs a schema change.

Change: Central Kurdish registration heading «ئەکاونت دروست بکە» (new `auth.registerHeading` key in all 7 catalogues; other
languages keep their existing wording), Kurdish "already have an account?" question, larger primary auth buttons, and a
busy/disabled state on the login button. No routes, schema, secrets or other pages touched.

Environment limits in this session: no npm registry access (egress 403), so lint/typecheck/tests/build ran only in GitHub CI.
No Cloudflare connector, and no authorized test inbox, so a live registration/OTP test was not run.

## Auth screen logo — 2026-10-20
Task: same register/login brief (logo on the auth screen). Change: the existing official `LogoMark` (artwork unchanged) is
centred above the auth card on `/[locale]/login` and `/[locale]/register`. Files: `src/app/[locale]/login/page.tsx`,
`src/app/[locale]/register/page.tsx`. PR #25, head `3c23c95`, merge `c53d444`.
Tests: local typecheck, lint, `npm test` 203 pass / 0 fail (3 skipped), OpenNext build and `wrangler deploy --dry-run` pass;
hosted `verify` success. `Workers Builds: rega-platform` failed on this PR and already on #23 (visibility-only dry-run path;
log is dashboard-only, cause not read). Deploy: CI on `main` then `deploy.yml`; the logo was served on
https://www.regaplatform.com/ckb/login about 14 minutes after the merge. Live Chromium checks at 390px and 1366px on
ckb/register, ckb/login, en/login and ar/register: logo present, no page errors, no horizontal overflow. Active version and
allocation not readable (no Cloudflare connector). Unchanged blockers: OAuth providers need owner-registered apps and
secrets (ADR 0006); no six-digit OTP exists; live registration needs an authorized test inbox; the provided reference
screenshot was not the Dalil Iraq auth screen.

## Social sign-in foundation — 2026-10-20 (branch `claude/social-login-foundation-20261020`)
Task (owner, Kurdish, with two reference screenshots): add Facebook / Google / Apple sign-in buttons on register and login
and a "log in or create account" chooser screen, from the foundation. Decision record: `docs/adr/0009-social-sign-in.md`
(supersedes the "deferred" part of ADR 0006).
Change: env-gated Auth.js providers (`src/auth.config.ts` builds the config per request), pure rules in
`src/features/auth/oauth-core.ts` (unit tested), Prisma store + glue in `oauth.ts`, `social-actions.ts` (buttons),
`SocialButtons/SocialSubmit/AuthDivider`, chooser page `/[locale]/auth`, social error messages on login/register, 7-language
strings (owner's exact Kurdish labels), `AUTH_FACEBOOK_*` / `AUTH_APPLE_*` in env schema, `.env.example` and the secrets-sync
workflow allowlist. No schema change (the `Account` table existed). Linking only on provider-verified + confirmed REGA
address, never staff, creation only from the register page.
Production impact: none visible until credentials are configured; no provider is configured today, so no social button shows.
Owner must provide: Google OAuth client, Facebook app, Apple Services ID + client secret (paid membership), callback URLs
`https://www.regaplatform.com/api/auth/callback/{google|facebook|apple}`, `AUTH_URL`; add as GitHub secrets, run "Sync Worker
runtime secrets". Not verified: any live OAuth flow (no credentials), Apple cookie handling. "Continue = accept terms"
wording needs owner/legal approval.
Local checks: oauth-social 24/24, i18n, glossary, workflows, config, rbac, seo pass; zod/next-dependent tests could not run
here (no npm registry) and rely on CI. Release: PR #27, squash merge `44d1360`. Hosted `verify` success on the PR; CI on `main` success; `Deploy to Cloudflare Workers`
success for `44d1360`. `Workers Builds: rega-platform` failed on the PR branch (known, non-main). Live check (public fetch of
https://www.regaplatform.com, ckb): `/ckb/auth` serves the chooser (Login / Create account, no social buttons), `/ckb/register`
and `/ckb/login` still show the e-mail forms with no social buttons, as expected with no credentials configured. Active version
and allocation not readable (no Cloudflare connector). Side effect: `src/lib/env.ts` is in the path filter of `Deploy Python AI
engine`, which ran for this merge and FAILED at its smoke-test step (health check of the separate Python Worker; log not readable
from here, 403). The step precedes enabling the integration, so the main site is unaffected; cause not diagnosed. Next safe
continuation point: owner supplies provider credentials -> sync secrets -> test Google first, then Facebook, then Apple; re-run
`Deploy Python AI engine` manually and read why its smoke test fails.

## Google sign-in fails after consent — diagnosis in progress — 2026-10-20 (branch `claude/google-oauth-error-capture-20261020`)
Report (owner, with screenshots): Google account chooser and consent work; after Continue the sign-in page shows the generic
"sign-in did not work" message (the `socialFailed` text, so NOT one of REGA's own account-rule denials).
Verified: Google button renders (both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are non-empty in the running Worker; correctness of the
pair is unverified); production DB schema matches the Prisma schema for `User`/`Account`, all migrations applied, `Account` has 0 rows
(no social sign-in has ever completed); edge cache and middleware bypass `/api` and the login page; the "Sync Worker runtime secrets"
workflow has never run (secrets were set by hand in the Cloudflare dashboard, Worker modified 2026-10-20 ~09:20 and ~13:03 UTC);
replacing the secret at ~13:03 UTC did not change the symptom.
Not available in this session (environment limits, not code failures): Cloudflare runtime logs, GitHub Actions job logs (403),
Neon log backend (empty), the `?error=` value (the in-app browser hides the address bar).
Change (diagnostic only, NOT the fix): the login page records the Auth.js `?error=` code of a failed return as one `AuditLog` row
(`action auth.oauth.failed`, `entity auth`, `entityId` = code; no PII, no IP, max 5 per client per 15 min, fixed allow-list in
`oauth-core.ts`). No schema change, no UI change, e-mail login untouched. Remove once the cause is fixed.
Next safe continuation point: after the deploy, one failed Google attempt -> read the row (`SELECT entityId, createdAt FROM "AuditLog"
WHERE action='auth.oauth.failed'`) -> fix only the layer it names (OAuthCallbackError = token exchange/secret pair; InvalidCheck =
state/PKCE cookie; CallbackRouteError/social_failed = exception inside the callbacks).
