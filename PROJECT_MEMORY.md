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
