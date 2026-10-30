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
- Production: `https://www.rega24.com` (since 2026-10-23; apex `rega24.com` 301-redirects to it; former host `www.regaplatform.com` is retired)
- Cloudflare Worker: `rega-platform`
- Production branch: `main`

## PERMANENT P0 RULE — REGA / R&L project isolation (owner instruction, 2026-10-22)
**REGA ≠ R&L. Never mix. Never silently switch. Always verify. Stop automatically on mismatch.** Full rule: `CLAUDE.md` section 0.
- PROJECT A — REGA Platform: repository `rebar9988-max/Rega`, production `https://www.rega24.com` (retired hosts `regaplatform.com` and `www.regaplatform.com` still 301 to it), Workers `rega-platform` / `rega-ai-python`. **This repository.**
- PROJECT B — R&L Marketplace & Delivery: repository `rebar9988-max/rega-cargo`, production `https://www.rlgo.net`, Workers `rega-cargo` / `rega-cargo-staging`. A separate repository, database, Worker and domain set.
- Before any edit, migration, commit, PR, merge or deployment verify repository owner/name, git remote, branch, production domain and deployment configuration, and that every referenced PR, commit, CI run and Cloudflare resource belongs to this repository. A PR number or CI run ID alone never identifies a project.
- On any mismatch: STOP (fail closed), change nothing, show the Sorani error from `CLAUDE.md` 0.3, report expected vs detected project, conflicting identifiers and operations already performed, and resume only after explicit owner confirmation.
- Enforced by `scripts/project-identity-guard.mjs` (read-only, no dependencies), run before the production step of `deploy.yml`, `db-migrate.yml`, `worker-secrets-sync.yml` and `ai-python-deploy.yml`, and tested by `tests/project-identity-guard.test.ts`. Not covered: Cloudflare Workers Builds (no Actions/git context) — verify its repository connection in Cloudflare.
- Never mix between the projects: code, database connections/migrations, Cloudflare Workers/bindings, environments, variables/secrets, branches/commits/PRs, CI/CD and run IDs, authentication, domains/routing, project memory/checkpoints, design/branding/assets.

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

### Update 2026-10-20 (later): the first capture returned `Configuration` — a catch-all
First failed Google attempt after PR #30 (deploy `034e182`): one `AuditLog` row, code `Configuration`, 13:56 UTC.
Verified from the shipped `@auth/core` 0.41.3 (`errors.js`, `index.js`, `lib/actions/callback/*`): the redirect carries the real type only for
`CredentialsSignin, OAuthAccountNotLinked, OAuthCallbackError, AccessDenied, Verification, MissingCSRF, AccountNotLinked,
WebAuthnVerificationError`; every other error becomes `Configuration`. So the failure is NOT a provider-reported OAuthCallbackError, NOT
a denied consent and NOT the `signIn` callback (a throw/false there gives `AccessDenied`). Left: `InvalidCheck` (state/PKCE cookie),
`CallbackRouteError` (token exchange error such as `invalid_client`, network/ID-token validation error, or an exception in the jwt callback)
and rarer config errors. The code alone cannot separate them.
Change (diagnostic only): Auth.js `logger.error` now also keeps a safe summary — error type, inner error name, library error code,
the provider's OAuth error code, HTTP status, provider id; never messages — as `AuditLog` action `auth.oauth.error` (max 5 per instance per
15 min; wrong e-mail passwords are skipped; Auth.js's own server log lines are kept). Remove both diagnostics once the cause is fixed.
Next safe continuation point: after deploy, one failed Google attempt -> `SELECT "entityId", after FROM "AuditLog" WHERE action='auth.oauth.error'
ORDER BY "createdAt" DESC` -> fix only the layer it names.

## Persistent sign-in: 90-day rolling session — 2026-10-20 (PR #32, squash `cd44236`)
Task (owner): users must stay signed in after refresh, navigation, closing the tab or restarting the browser; sign-out must never delete the account.
- Proven cause (read from the installed `@auth/core` 0.41.3 / `next-auth` 5.0.0-beta.32): the session cookie is written once at sign-in with
  `expires = now + maxAge` (it was persistent, 14 days) and is re-issued only by the session endpoint, a middleware wrapper or a route handler;
  `auth()` in a server component discards the cookie it would set. REGA only calls `auth()` in server components/actions (no `SessionProvider`,
  no auth middleware), so nothing ever renewed it: every account had to sign in again exactly 14 days after its last sign-in.
  NOT proven: an immediate loss on refresh. The cookie already had a persistent expiry and the apex redirects to `www`; it could not be
  reproduced (no test credentials, no authorized test account on production). The CI e2e now covers refresh / navigation / reopen.
- Final policy (`src/features/auth/session-policy.ts`, ADR 0010): JWT session, 90 days (`SESSION_MAX_AGE_SECONDS`), HttpOnly, SameSite=Lax, path `/`,
  Secure on https, host-only (Auth.js defaults, unchanged), no token in browser storage. Rolling renewal: `SessionRenewal` (signed-in header and
  `/dr` layout only) asks `/api/auth/session` once per page load and when a tab that stayed open becomes visible after 6 h; the response re-issues
  the cookie (JWT expiry and cookie expiry). A session ends only by explicit logout, 90 days unused, account deleted/not active, or a password
  change/reset (one-way marker of the password hash in the token, compared at each re-check; tokens without a marker, issued before, are kept).
  Existing 14-day tokens are upgraded at their next renewal; the deploy signs nobody out. Accounts: `User.email` unique and `Account` keyed by
  (provider, providerAccountId), so no duplicates; logout only clears the cookie.
- Changes: `session-policy.ts`, `SessionRenewal.tsx`, `auth.config.ts` (maxAge, password marker), `Header.tsx` and `dr/layout.tsx` (mount),
  `next-auth.d.ts`, legal texts (7 languages: 90 days, renewed), ADR 0005 updated, ADR 0010 added, `playwright.config.ts` (GitHub reporter in CI,
  failures readable as check annotations), tests `tests/session-policy.test.ts` (7) and `tests/e2e/session.spec.ts` (8). No schema, route,
  provider, secret or design change.
- Bug found and fixed on the way: the first renewal version never read the endpoint's response body, so the browser kept the request open and
  Playwright's `networkidle` never settled on signed-in pages (admin e2e tests timed out). Fixed by consuming the body.
- Tests actually run: unit tests 7/7 locally; on PR #32 head `5598b9b` hosted `verify` success (lint, typecheck, all unit tests, full e2e incl.
  `session.spec.ts`: cookie flags + 90-day expiry, refresh and navigation across locales, reopen with persistent cookies only, renewal by endpoint
  and by page load with later expiry and a new token, legacy 14-day token without marker stays valid and is upgraded to 90 days, anonymous denied,
  logout then login = same account with no duplicate `User`/`Account`, password change ends the session; OpenNext build + `wrangler deploy --dry-run`).
- Deploy: CI on `main` success, `Deploy to Cloudflare Workers` success for `cd44236`; the live privacy page shows the 90-day wording. `Production
  browser check` failed once right after the deploy and passed on a manual re-run (anonymous journeys only; its log is not readable here).
  `Workers Builds: rega-platform` fails on PR branches (known, visibility-only).
- NOT verified: a live sign-in / refresh / renewal on https://www.regaplatform.com (no test credentials; creating an account on production for a test
  was not done); the live `Set-Cookie` of `/api/auth/session` (shell egress to the site is blocked, the fetch tool honours robots.txt); the active
  Cloudflare version and allocation (the Cloudflare connector only returned the Worker name and id).
- Remaining: Google sign-in still fails after consent (`Configuration`, see the diagnosis section above; separate from session persistence, not touched).
  No per-device session list or "sign out everywhere" (needs a schema change). `AUTH_SECRET` must never change between deployments (it would sign
  everyone out).
- Next safe continuation point: owner signs in once on production and checks the cookie expiry (~90 days, `__Secure-authjs.session-token`) and that
  it moves later after a page load; then resume the Google sign-in diagnosis.

## Location filter upgrade — 2026-10-20 (PR #34 squash `74476e5`; verification script PR #36 `c18918c` and follow-up; status: DEPLOYED and VERIFIED live)
Task (owner brief, strictly limited to the existing location filter): hierarchical, searchable selector (country, region, city), shared by home page,
business list and map, saved without an account, mobile bottom sheet, Kurdish RTL, optional nearby detection; Dalil Iraq only as a functional reference.
- Audit: city filter was a native `<select>` of <=80 ranked cities (`listSelectorCities`), single city (`businessInCity`), no memory, separate map choice;
  data has Country/Region/City(+translations, coordinates) and no district model. Reused all of it; no schema change or migration.
- Changes: `src/lib/location-pref.ts` (pure helpers), `src/lib/location-store.ts` (client store, localStorage `rega-location`),
  `src/lib/data/geo.ts` + `src/app/api/v1/geo/route.ts` (bounded search API; name matches ranked by public listings), `CityFilter.tsx` (rewritten panel,
  same export/form contract), `FilterBar.tsx`, `BusinessIndex.tsx` (saved city applied, Reset -> `?city=`), home hero (compact selector),
  `NearbyDiscovery.tsx` (shares saved city), `locationPicker` messages in 7 languages, privacy bullet for `rega-location` in 7 languages, ADR 0011.
- Not implemented on purpose: districts (no data), multi-city (existing filter is single-city). Countries = Germany + countries with public listings.
- CI on PR #34: first run failed 8 new tests (the region `<select>` inside the panel also exposes role=option so the Berlin locator matched twice; "ber"
  listed Berching before Berlin; a page-width assertion). Fixed in `11d4696` / `bf50a5f` (locators scoped to the listbox, ranking by public listings,
  assertion compares width before/after opening). Final `verify` on `bf50a5f`: success, 281 e2e tests passed. `Workers Builds` fails on PR branches (known).
  `Create Neon Branch` returned HTTP 422 once on PR #36 (infrastructure, not part of `verify`).
- Deploy: CI on main success, `Deploy to Cloudflare Workers` success for `74476e5` and again for `c18918c` (script-only change).
- LIVE VERIFICATION (real Chromium against https://www.regaplatform.com, Production browser check run 39494203619, `workflow_dispatch` on the verification
  branch, conclusion success, 42 location checks ok / 0 FAIL, desktop 1366 and Pixel 5): `/api/v1/geo?country=DE` 200, Germany listed, 15 cities / 16
  regions, all German; invalid country -> 422; nearest city to central Berlin = Berlin 0 km with no-store; selector opens; search "ber" finds Berlin;
  choice shown in the field and in the hidden form value; saved place holds only cityId/countryCode/regionId/savedAt/v; home page shows the saved city;
  `/de/businesses` applies `?city=`; `?city=` clears the saved place; "use my location" (granted position near Berlin) selects Berlin; Kurdish `/ckb/businesses`
  selector opens, stays inside the window, no horizontal scroll; privacy page names `rega-location`; the existing checks of that workflow (all public pages,
  dir, directory city options, Germany-only cities, `/dr` requires sign-in) also passed.
- Finding, reported not changed (outside scope, visual): on `/de/businesses` at Pixel 5 (393 px) the page is 4 px wider than the screen (scrollWidth 397) before
  the selector is opened; the elements are the header link (`a.inline-flex.min-h-9`, right edge 397) and the bottom navigation (`ul.grid.h-16`), not the location
  panel. The phone sheet is flush with the bottom and spans the layout viewport (397x618 in 397x735).
- Not verified: the live business list with real businesses (production currently has none published: counts show 0 and the list says no business published yet);
  live sign-in; the active Cloudflare version/allocation (no Cloudflare connector); Safari/iPhone hardware; shell and fetch tools cannot reach the site
  (robots/proxy), so evidence comes from the repository's own read-only browser workflow. Local lint/typecheck/build could not run (npm registry blocked);
  CI covered them.
- Next safe continuation point: owner decides about the 4 px header/bottom-navigation overflow on phones; add a real published business to production to
  exercise the city-filtered list with data.


## Business platform audit checkpoint — 2026-10-21
- User authorized two sequential production phases: (1) publication/category isolation/admin, (2) registration/images/directory UI.
- Audited AGENTS.md, CLAUDE.md, this memory, central Google Doc, architecture, Prisma, write/read paths, CI/deploy and production records.
- Confirmed code defects: verify only toggled a badge; public read required published; service categories leaked businesses into unrelated directories; independent edge HTML cache survived Next revalidation.
- Production read-only evidence: `Sky berlin` (not Sly) is pending, category travel-tickets; `taakline` is draft, category transport-moving. Both have verified=false. Their green screenshot badges are location confirmation, not staff verification. Audit has only create/update, no staff approval. No existing record is eligible for automatic repair; none was changed.
- Local prepared work: publication policy, transactional approval/audit, canonical categories, public query consistency, focused tests; separate registration/image/UI work is preserved pending phase 1 production verification.
- Local combined snapshot: typecheck and Node build passed; unit 273 passed, 3 skipped. Initial focused E2E proved approval/category/search/count/suspension and authorization; failures in old category locators and demo fixtures were diagnosed and corrected. Full checks are still pending for the separated phase 1 diff.
- Cloudflare connector search/execute/whoami returned Internal error on bounded attempts. Public production Chromium fetch worked. GitHub permissions include push/maintain/admin; main c221ef4 has no protection. Existing CI-gated production pipeline is preserved.
- Concurrent PRs #39 (autonomy/checkpoints), #38 (footer), #35, #29, #10 are unrelated and must not be overwritten or merged as part of this task.
- Resume: finish and deploy phase 1 first; keep prepared phase 2 isolated. No production schema migration or data mutation has occurred.
- Prepared phase 2 was preserved remotely as checkpoint/business-platform-prepared-20261021 at 838d0cf. Current phase 1 work is isolated from its image codecs, uploader, registration wizard and directory UI.
- Phase 1 focused regression results so far: all 5 admin-business journeys passed (publish guard, address lookup, map/Nearby, city creation and collocated businesses). Full suite continues; no phase 1 PR or deployment yet.
- Live role audit confirmed one active SUPER_ADMIN and two active BUSINESS_OWNER accounts. No permissions, passwords or roles were changed.
- Phase 1 PR #40, initial commit 4217a0b. Publication tests now also validate active-city/country consistency (6/6 pass). The first full E2E run found one fixture issue: demo published businesses had unconfirmed primary locations; global test setup now gives approved demo fixtures their canonical category and confirmed location. Production data is unaffected.
- Actual release prerequisite found on 2026-10-21: OpenNext's two-year support gate expired Next 15 today; Worker build refuses existing Next 15.5.26. No override/unsupported-version flag is used. An isolated worktree successfully compiled Next 16.4.2 with the existing Webpack alias, routes and middleware. Necessary metadata changes only: Next dependency, Node >=20.9, explicit --webpack in the existing build commands, JSX automatic runtime and dev generated-type include. Full CI/regression checks must pass on this version before merge.
- Read-only Cloudflare diagnostics workflow 39553253098 succeeded despite the connector error. It observed active deployment version 84a4a585-4c15-479b-859d-85d76ae425dc at 100% (created 2026-10-20T21:53:46Z); storage credential NAMES exist. No runtime configuration or secret was changed.
- Initial full local E2E (Next 15 baseline): 283 passed / 2 failed. Failures were (1) a published demo fixture lacked confirmed coordinates (fixed in f58436e), (2) the mobile admin's horizontally wide business table made approval pointer targeting unreliable. The business table now uses the same cells/forms as responsive mobile cards, with desktop table geometry retained. Focused validation and final-head CI are required before release.
- Supported Next 16.4.2 Worker build and `wrangler deploy --dry-run` both passed in the isolated worktree (3499.74 KiB gzip). Main remains c221ef4; nothing has been merged or deployed by this task yet. PR #40 head before the mobile fix is f58436e.
- Hosted CI on e2048c9 completed all 285 E2E tests successfully (8.8 min). A final manual invocation of the read-only repair CLI exposed a tsx/CommonJS top-level-await entry-point error, not an application defect. The CLI now uses an async main, refuses a missing DATABASE_URL, and has a focused loader regression test. Local read-only execution skipped all four explicitly archived test candidates without changing records. The final commit must complete CI again before merge.
- Additional pre-merge workerd runtime smoke caught an adapter incompatibility missed by compilation: OpenNext Cloudflare 1.20.7 does not inline Next 16.4's server/preview-props.json. The same adapter's fixed version 1.20.12 includes this manifest. Upgrade is limited to this required compatibility prerequisite; a real local Worker route smoke is now part of CI. Runtime and final-head CI must pass before merge. No production deployment or data change yet.
- CI 39556737974 passed all 285 browser tests plus lint/typecheck/unit and Node/Worker builds. Its new Worker smoke returned the health report but failed database readiness in the hosted test environment; the exact head's local Worker passed the database/public-query checks. The local smoke now pins only its localhost test connection to IPv4 and reports safe boolean health checks on failure. This is test-environment diagnosis, not a production DB configuration change. Final CI and runtime verification remain mandatory before release.
- Isolated hosted runtime diagnostic 39558957853 passed with the explicit IPv4 test endpoint, including real database/migration readiness and the public business query. Its temporary test workflow exists only on test/business-worker-runtime and will not be merged. Full final-head CI is still required.
- Worker startup smoke waits up to 60 seconds for actual database readiness, rather than treating the first reachable 503 health report as readiness. All final assertions (healthy DB/migrations, approved-only directory and validation) remain required. The hosted endpoint comparison is diagnostic; a localhost DNS cause is not claimed without its result.
- Confirmed hosted build-order root cause in diagnostic 39559658698: after a Node build, the Worker reused Next's cached Node Prisma entry and tried to read `/bundle/node_modules/.prisma/client/query_compiler_bg.wasm`. Fresh Worker-only builds passed both localhost/IPv4, excluding the hostname theory. OpenNext's existing build command now clears only generated `.next` output before compiling the Worker, keeping the Node/Worker Prisma resolutions isolated. Removed the unnecessary hostname override. Required CI 39559542281 was cancelled after this reproduction; verify the corrected build-order diagnostic and final-head CI before merge. No production change has occurred.
- Conservative repair guard: any audit event at or after staff verification other than that verification itself requires fresh staff review, including older status changes recorded as business.update. Current REST schemas already reject direct pending transitions; no additional API transition or state was introduced. Production candidates remain zero; no repair has been applied.
- Full CI 39560221964 on cc9e98c passed, including the built Worker runtime. Added a real repair integration test using an isolated, disposable local PostgreSQL database: dry run changes nothing, later business.update is preserved, eligible verification is repaired and repeated apply writes only one repair audit. This last repair-only change must pass final-head CI before merge. Production read-only refresh found three unverified records (a new pending beauty/barber business), all preserved; no eligible production repair candidates.

## Phase 1 release checkpoint — 2026-10-21 14:47 UTC
- Final PR CI 39562522345 on 8211f396e3c9194eee69f2159c9bd98c05c0e6d4 succeeded: 275 unit/integration tests, 0 skipped; 285 browser tests; lint/typecheck; Node/Worker builds, dry-run and real Worker database/directory smoke. Worker gzip was 3493.24 KiB.
- PR #40 merged with an expected-head guard. Main commit: 3ce672deec309a9350a312112f809a4f796cd7b2. Main CI 39619955621 and production deploy 39621629114 both succeeded.
- Production read-only refresh still shows taakline draft, Sky berlin pending, Karwans HairTuning pending; all verified=false with canonical transport/travel/beauty categories. No production data, schema, role or credentials changed.
- Cloudflare connector still returns Internal error; GitHub's existing deployment/diagnostics workflows and public Chromium checks remain the available verification path. Browser skill is now readable, but its associated connected-browser JavaScript tool is unavailable. Do not claim authenticated live owner/staff actions.
- Phase 2 remains preserved on checkpoint/business-platform-prepared-20261021 at 838d0cf; restore only its phase-2-specific changes after phase 1 production verification, preserving all current publication/build fixes.
- Production verified at 15:06 UTC: Cloudflare version 72611998-7f04-44c0-9cc4-90bf6731717d serves 100% (diagnostics 39622124475). Production browser workflow 39621797819 began after deployment and passed. Local real Chromium checked 12 desktop/mobile pages: all 200, no page errors or main overflow, identical header/footer/brand/dir/h1 baseline signatures. Fresh health returned 200/ok with database, migrations, auth and storage ready. Directory, canonical travel/transport/beauty categories, country DE/IQ and named search all have count/results 0; all three unverified profiles return 404. Invalid country now returns 422, proving the new public query is live.
- No eligible production record required repair; no production migration, role or business-data mutation was performed. Authenticated positive production approval was not exercised because no legitimate connected staff session is available; its full flow passed automated tests. No critical public production defect remains. Resume phase 2 from the prepared checkpoint without changing global public design/branding or replacing phase-1 fixes.

## Phase 2 registration/image checkpoint — 2026-10-21
- Resumed only the phase-2-specific files from preserved 838d0cf on feat/business-registration-images, based on deployed main 3ce672d. No earlier publication/runtime fixes were replaced. Shared homepage BusinessCard and offer MediaField stay unchanged; directory gets its own card.
- Owner form now has information/location, logo/images, review steps; searchable canonical categories, optional detail panels, debounced server draft saving and a transactional guard against stale autosave after submission/moderation. Failed revisions do not retry endlessly.
- New business-only editor uses the same geometry for preview/export, pointer drag, two-touch pinch, slider, keyboard arrows, reset/replace/retry. Browser-native formats normalize to a frozen still; unsupported HEIC/HEIF has explicit JPG/PNG fallback. Source <=20 MiB/64 MP; normalized upload <=6 MiB/1.6 MP. Server validates actual PNG/JPEG, bounded decoding and metadata-free re-encoding before existing S3 storage. New URLs must be normalized assets uploaded by the actor; existing listing URLs are retained.
- Directory category navigation/country filters use canonical IDs; city totals count distinct businesses across branches and geography count responses use no-store. All seven locales retained. No schema/migration/production record/role/secret change.
- Tests so far: 279 unit/integration passed, 0 failed/skipped. Real local workerd PNG/JPEG codec smoke passed (pixels, metadata removal, invalid-file rejection). First focused desktop/mobile browser run: 14 passed, 4 failed, 3 skipped after serial failure. Diagnosed test-only issues: label substring ambiguity after category search added; obsolete onboarding step order; duplicate foreign-media fixture key; test fetch(blob:) denied by existing CSP. Corrections applied without weakening CSP; rerun pending. Actual owner upload/submission/staff approval/public directory/stale-autosave flow already passed on desktop and mobile.
- Next: finish focused browser checks including WebKit/iPhone emulation, full CI, Worker build/runtime, review diff, PR/merge only on green, existing main production pipeline, actual live checks and central-memory release update. No phase-2 deployment yet. Legitimate authenticated production session is unavailable; do not invent production accounts/data or claim live authenticated upload/approval was tested.
- Follow-up validation: owner real logo/gallery upload, removal autosave, replacement, submission, staff publication and stale draft-tab protection passed in WebKit/iPhone emulation over local HTTPS. Seven of eight iPhone cases passed; crop retry test needed test-only SW blocking and browser-side byte capture because WebKit does not expose Blob POST bodies to route.postDataBuffer. Production service worker/CSP remain unchanged.
- Local HTTPS proxy is loopback-only with an ephemeral self-signed certificate; it preserves production upgrade-insecure-requests instead of weakening CSP. Source checks use Modern Web Guidance forms/drag guidance. Unit/integration run in its own local DB: 280 passed/0 failed/0 skipped. A concurrent seed-count run against the browser DB failed from shared test writes; isolated rerun passed with no unrelated code change.
- Real local workerd now also executes the existing S3 helper against dummy local storage: actual PNG bytes/pixels and metadata stripping verified after upload. No external storage, production credentials or paid service used.
- Concurrent main advanced to 59d8df12d61246f6cf1e16b68a6cf1059faad5bd via PR #41 (fresh-account authorization for private management reads). Integrate and preserve it before final-head CI/release; do not overwrite its API, auth, Worker smoke or memory changes.
- WebKit completion: all 8 unique iPhone cases now passed (7 in HTTPS run, corrected crop-retry case 1/1). The retry test alone blocks service workers for interception and captures the actual canvas Blob in-browser, avoiding WebKit's unavailable POST-body API. Actual uploads and publication tests keep the production service worker enabled. Full final-head CI and release are still pending.

## Private Control Center /dr recovery checkpoint — 2026-10-21

- Scope: the owner's new, separate /dr recovery/control-center specification. Public UI/routes/branding are locked.
  Phase 2 must wait until Phase 1 is verified in production with an authorized management session.
- Read AGENTS.md, CLAUDE.md, this file, central Doc, architecture and deployment runbook. Fresh checkout base:
  `3ce672deec309a9350a312112f809a4f796cd7b2` (PR #40 was already merged). Its existing main CI run
  `39619955621` was in progress at this audit; do not duplicate or interfere with that separate release.
- Exact reported 404 root cause: **not established / not reproduced**. At 14:49–14:55 UTC, unauthenticated
  `https://www.regaplatform.com/dr` returned 307 to `/ckb/login?next=%2Fdr`, then login returned 200.
  `/dr/` first returned 308 to `/dr`; `/dr/businesses`, `/dr/users`, `/dr/audit` also redirected to login.
  Redirect targets returned `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`
  and `x-rega-cache: BYPASS`. Firecrawl live fetch independently confirmed the login destination.
  This establishes the anonymous auth path, not authorized dashboard rendering or the cause of a historical 404.
- Routing audit: `src/app/dr/page.tsx` and `layout.tsx` exist; middleware excludes `/dr` from locale rewriting;
  `src/i18n/request.ts` resolves its locale from the cookie/default; the custom edge cache excludes `/dr` and `/api`.
  No `notFound()` exists on the /dr root. Child record pages intentionally use 404 for missing/inaccessible records.
  No speculative route/auth bypass was implemented.
- Cloudflare connector `whoami` and spec search returned Internal error. Existing read-only diagnostics workflow
  `39620570270` succeeded: latest deployment observed at 14:52 UTC uses version
  `84a4a585-4c15-479b-859d-85d76ae425dc` at 100% (created 2026-10-20T21:53:46Z).
  Evidence: https://github.com/rebar9988-max/Rega/actions/runs/39620570270 . No runtime settings were changed.
- Live anonymous mutation probes used empty JSON and a nonexistent sentinel ID; all returned 401/unauthenticated:
  POST businesses, bulk, categories, locations, media/upload-url; PATCH and DELETE businesses/[sentinel].
  No production record, role, account or permission was created/changed.
- Existing server guards re-read active/nondeleted account and role for mutations, fail closed on DB errors,
  and enforce business membership. The business list/detail GET APIs instead use the cached `currentUser()` role
  (`AUTH_SESSION_REVALIDATE_MS` defaults to 5 minutes); fresh authorization for private reads needs review in Phase 2.
- Required workflow gaps found (audit only): persisted roles are SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE/BUSINESS_OWNER/USER,
  with no STAFF role or per-user permission grants. MANAGER can publish; EMPLOYEE cannot and writes require membership.
  `approvalData()` and form/REST/bulk paths currently combine verify + publish, including `verify` actions.
  Separate decisions must be implemented consistently across these existing paths after the Phase 1 gate.
  Reject currently returns pending to draft with an optional reason; correction and suspension are not distinct
  dashboard decisions. Audit stores actor/action/time/status but not an immutable actor-role snapshot.
  Existing search/status filters/pagination/mobile cards/i18n must be preserved. No Phase 2 implementation started.
- Local baseline: `npm ci`, Prisma generation, lint, typecheck and Node production build passed. Unit tests:
  271 passed, 4 skipped, 0 failed (no DATABASE_URL was set for this unit invocation). Isolated local PostgreSQL 16
  and existing migrations were used for 12 auth/security browser tests: all passed, including SUPER_ADMIN/EMPLOYEE
  dashboard access, anonymous API denial, forbidden employee API calls, suspension and public response projection.
  The fixture named ADMIN actually has role SUPER_ADMIN; this is not live ADMIN/STAFF verification.
- Worker production build and `wrangler deploy --dry-run` passed (3498.18 KiB gzip). Existing local workerd smoke
  passed database/migration health, approved-only public query and API validation. These are baseline checks of
  `3ce672d`, not evidence of a new deployment, authorized production access or the requested Phase 2 behavior.
- Files changed by this task: only this existing project-memory file; central Doc also updated with the checkpoint.
  Auto-generated `next-env.d.ts` build drift was reverted. No test/source/config/schema changes were necessary to
  document a nonreproduced failure. Branch `audit/dr-recovery-20261021` preserves the checkpoint without deploying it.
- Blocker: no authorized production management test session is available. Secure session configuration was requested;
  never paste credentials, fabricate a session, promote an account or use local fixture credentials on production.
  Phase 1 authorized access and exact 404 reproduction remain unverified, so Phase 2 and deployment are gated by the
  owner's execution order. No application code, schema, public UI or deployment workflow was changed by this task.
- Continuation: securely attach an existing authorized test session; reproduce the exact URL/role and failed request
  without retaining private content; re-check current main CI/deployment/active Worker version, fix only an evidenced
  failing layer, verify authorized/unauthorized access live, then implement the scoped management improvements.
  Keep unrelated prepared public-site checkpoint `838d0cf` isolated. Evidence logs are in this session's
  `/workspace/scratch/rega-dr-recovery`; this file and the central Doc remain the only shared project-memory layer.

## Resume: workspace loading and private-read authorization — 2026-10-21

- Resumed from verified remote checkpoint `ebb6e93430b9c88fcb9c9f65236d1b9d5fbf2d6b`; working tree was clean.
  Current main is still `3ce672d`. Its CI `39619955621`, deploy `39621629114`, production browser check
  `39621797819` and Cloudflare diagnostics `39622124475` all succeeded. Diagnostics observed version
  `72611998-7f04-44c0-9cc4-90bf6731717d` at 100%. These are the previous release, not this repair's deployment.
- Workspace finding: all required repository files load through execution tools. No malformed Docs path,
  `.code-workspace`, `.codex` or editor workspace configuration was found in repository-owned files.
  The previous chat answer emitted `codex-file-citation` with a Google Docs HTTPS URL. Treating that URL as a
  filesystem path reproduces the exact path shape: `path.resolve('/workspace', 'https://docs.google.com/document/d/example')`
  becomes `/workspace/https:/docs.google.com/document/d/example`. This verifies URL-to-path normalization, but host
  file-loader logs/UI are unavailable, so the source of the reported Codex server error remains unconfirmed.
  Supported Drive fetch of the real central document succeeds. No fake local document or internal service change.
- Safe file-loader continuation: open the actual repository root `/workspace/Rega`; remove/reselect the malformed
  document reference through supported workspace UI; use real local paths for file attachments and ordinary HTTPS
  links or connected Drive tools for Google Docs. Refresh/reopen the workspace, then retry a real repository file.
  If UI loading still fails, retain timestamp/error/request ID for Codex support. Do not manufacture a `https:` folder.
  Use ordinary web links in reports instead of wrapping external URLs in local file-citation directives.
- Production /dr still has no reproduced 404. Fresh 15:25 UTC diagnostic/browser-user-agent requests: /dr 307 to
  `/ckb/login?next=%2Fdr`, login 200, /de and /ckb 200, health 200/ok; management/login responses private/no-store and
  edge BYPASS. Default Python-urllib user agent received Cloudflare 403 on every path; diagnostic and Chromium user
  agents succeeded. This request-dependent edge response is separate from application routing; no WAF change made.
- Confirmed authorization defect: private business list/detail and location GET handlers used `currentUser()`'s
  cached JWT role (default 5 minutes), so demotion/suspension/deletion did not immediately remove private read access.
  Before repair, 9 of 12 new handler tests failed: stale staff role exposed drafts, missing no-store, and no fresh
  account lookup on DB failure. Three anonymous-public projection tests already passed.
- Technical repair: reuse the existing active/nondeleted-account query as optional `currentAccount()`; permission
  guards retain their original 401/403 behavior. The three GET handlers and /dr layout now use the fresh account.
  Staff GET responses explicitly set private/no-store. A cached session whose account is revoked sees the existing
  forbidden screen, avoiding a /dr <-> login loop (login redirects a cached signed-in session back to /dr).
  No markup/styles, public UI, role matrix, session policy, workflow decisions, schema or dependencies changed.
- Regression coverage: 12 handler tests cover current roles, stale roles, inactive/missing accounts, DB failure,
  cache headers and anonymous public projections; existing permission/RBAC tests remain unchanged. Added real local
  E2E coverage retaining a cached JWT while DB roles/status change. Tokens and account changes are isolated test-only;
  no production session is fabricated and no production role/data is changed. Initial browser assertion expected
  German but the fixture had no locale cookie (actual existing forbidden UI was Kurdish); fixture selects German.
- Current validation: lint/typecheck, 283 unit tests (4 skipped), 22 focused authorization/RBAC tests and Node build
  passed. All 31 unique local auth/security/public-navigation cases passed across the initial run and the corrected
  security-fixture rerun (6/6). Worker build and dry-run passed (3503.99 KiB gzip); actual local workerd passed DB,
  /dr 307/login/no-store, anonymous mutation 401, public-query and validation checks. The extra private-route/auth
  assertions are now in the existing `scripts/health/worker-smoke.mjs` CI check.
- Repair implementation commit `656bc61`; PR https://github.com/rebar9988-max/Rega/pull/41 . Its first CI run
  `39625818405` was superseded by the added Worker routing regression check. Existing optional Neon preview workflow
  again failed HTTP 422 (`39625818273`), matching the earlier documented infrastructure failure; it is unchanged.
  The full `verify` job uses disposable local Postgres and remains the release gate. Final-head hosted CI and
  production release are still required; update this checkpoint before handoff.
- Authorized production session remains unavailable: runtime has no configured secret/session bindings and no
  attached state file. Existing `storageState` references are localhost test fixtures, never production sessions.
  Minimum secure attachment requested (path or variable names only). Positive authenticated production verification
  and the historical 404 cause remain blocked. Control-center redesign/workflow expansion remains paused.

- Business-task integration: preserved the complete independent /dr recovery notes and PR #41 implementation while resolving only an append conflict in this memory file. Its separate control-center redesign gate is unchanged; this branch continues the original business registration/image phase after phase-1 public production verification.
- Final review found an empty-country display inconsistency: a shared URL for active IQ could filter correctly while the country dropdown omitted IQ (only Germany/public-listing countries were offered). Directory and geo selectors now retain the explicitly requested active country even at count zero, with a focused country-isolation regression. Existing default country policy is unchanged. Final-head CI must run on this follow-up.
- Integrated-head CI 39670100631 caught a test-harness import whitelist mismatch: PR #41's real GET authorization tests did not know the new write-only business-media import. Added an explicit stub that fails if a GET actually calls it; no guard or assertion was weakened. Focused authorization/image/count tests passed (17/17). Final-head CI must rerun; the earlier 280 count predates PR #41's 12 handler tests.
- Privacy review: normalized public image keys now use only a random UUID, without embedding the uploader's internal user ID. Ownership remains enforced through Media.uploadedById plus the server-only normalized business-images prefix (the generic presigned uploader cannot issue that prefix). Added a public-URL regression. No storage credentials, schema or existing images change. Final-head CI required on this privacy follow-up.
- Current source head 7a0de7e: full isolated unit/integration run passed 292/292, no skips. Superseded CI browser logs exposed failures once real-upload fixtures became public: image URLs used an unreachable example host, and the older geo test still expected the deliberately removed shared cache. PR CI 39672139845 was stopped while fixing this related test environment. The local fake S3 server now retains/serves actual normalized bytes through the loopback HTTPS proxy; test contexts trust only their disposable TLS setup. Production TLS/CSP/header/language switcher are unchanged. Geo-cache assertion now requires no-store. Targeted browser reproduction on a fresh local database is pending before the next CI push.

- 2026-10-22 resumed PR #42 at 7a0de7e; current main59d8df1 and direct Cloudflare read confirm latest deployed version d52f90e9-f1d3-4d74-ad59-f914aed391fc at100%. Separate open PR #43 is untouched. Previous local rerun reused an interrupted database with image fixtures whose ephemeral fake S3 objects had expired; fresh isolated rega_phase2_browser_oct22 avoids that stale test state. Only image businesses created in the current test file are archived/reindexed afterwards, retaining records and preventing broken fixtures on reruns.
- Browser evidence also confirmed a real directory city-picker geometry defect: category navigation moved the field low enough that its fixed popover extended offscreen. Positioning now chooses available space above/below and bounds its height; no style or brand changes. Existing tests still perform actual clicks, and now assert full viewport containment on either side. All 41 focused desktop business/image, language and location browser tests passed, including actual saved512px public logo bytes, RTL city selection and shared homepage/map location behavior. Lint/typecheck/Node build passed. Full exact-head hosted CI and final mobile/WebKit checks are next; phase2 remains undeployed. No production data/schema/permissions/infrastructure changes.

- Final local mobile browser16/16 passed (WebKit/iPhone13 and Chromium/Pixel5); focused total57/57, including real S3 bytes/crop/retry/submission/approval. Hosted CI39736412806 passed Python, lint, typecheck,292/292 unit/integration (zero skipped) and Node build, then failed before any browser cases: `Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.56.1`. The runner's ubuntu-latest moved to26.04; this is a verified OS compatibility failure, not an application regression. Pin only the two browser-running workflows (CI and production-browser) to supported ubuntu-24.04, matching the already passing local Noble browser image. No Playwright upgrade, weakened checks, app change or deployment bypass. New exact-head full CI required before merge; existing production unchanged.

## CI recovery after PR #42 merge — 2026-10-22
- Resumed from Codex checkpoint. The reported "PR #145" does not exist; the business registration/image work is PR #42,
  already merged to `main` as `d25d69c`. Nothing was recreated or reverted. The PR's own CI (`39737361652`, head
  `13edf12`, same tree) passed; push-to-main CI `39739599053` (attempt 2) failed only in E2E, so the CI-gated deploy
  workflow was skipped and #42 was not yet deployed.
- Failure: `[desktop] admin-business.spec.ts` `page.goto('/dr/businesses/new', networkidle)` timed out (304 passed, 2 tests
  affected, always the first navigation straight after `login()`). No `/api/auth/*` HTTP 500 appears in this run's log.
- Root cause (reproduced): a test-harness race, not an app defect. A signed-in `/dr` page fires a second batch of RSC link
  prefetches right after render; navigating away mid-batch leaves requests Chromium cancels without Playwright seeing them
  finish, so `networkidle` never settles. Isolated probe: 1 hang in 40 fresh logins; the server answered every request.
  Full local desktop run also reproduced it once on a different test of the same file.
- Fix (test layer only, `tests/e2e/fixtures.ts`): the shared `goto` wrapper lets the page being left finish its in-flight
  requests (bounded 10 s) before navigating. The strict `networkidle` check on the destination page is unchanged; no retry
  count, timeout or assertion was loosened. Probe with the same pre-wait: 0 hangs in 80 logins.
- Release verification — 2026-10-22: PR #44 merged as `1bee9c3`. Main CI `39757908801` passed (lint, typecheck, unit, Node
  build, full desktop/mobile/iPhone E2E, Worker build + workerd smoke). The CI-gated `Deploy to Cloudflare Workers`
  `39760925614` succeeded for that exact SHA (OpenNext build + `wrangler deploy`, 10:11 UTC); `Beta health` `39760925505`
  and the read-only `Production browser check` `39761148783` (live site, desktop + mobile Chromium) passed afterwards.
  This also ships PR #42 (business registration, safe image crop/upload, category-scoped directory), which main CI had
  blocked since `d25d69c`. `Workers Builds: rega-platform` is red on PR heads (also on #42) and fails in under a second; it
  is not a gate (docs/DEPLOYMENT.md) and its Cloudflare-side reason is unverified.
- Not verified (environment limits, not code failures): this session's network policy returns 403 for
  `www.regaplatform.com`, and there is no Cloudflare dashboard access, so the active version at 100% was not read directly.
  Authenticated live checks (sign-in, business publish, real image upload) were not run: no authorized production
  session exists and those actions write production data. Next safe continuation: attach an authorized test session or
  allow the host, then run those flows; owner may also check Cloudflare Workers Builds settings.

## P0 project-isolation rule and identity guard — 2026-10-22
- Task: owner's permanent P0 rule "STRICT REGA / R&L PROJECT ISOLATION" persisted in this repository (and, separately, in `rebar9988-max/rega-cargo`).
- Root cause: none (preventive). Two similarly named projects share tooling (Cloudflare account, GitHub owner, Prisma/Wrangler/CI patterns), so a copied prompt, PR number or CI run ID could be applied to the wrong repository.
- Change: `CLAUDE.md` section 0 (full rule), `AGENTS.md` pointer, this file, `scripts/project-identity-guard.mjs`, a guard step before the production step of `deploy.yml`, `db-migrate.yml`, `worker-secrets-sync.yml`, `ai-python-deploy.yml`, and `tests/project-identity-guard.test.ts`. No application code, UI, dependency, route, secret, database or Cloudflare configuration changed.
- Tests run (local, Node 22 type-stripping runner; this session has no npm registry access, so `npm ci`, lint, typecheck and the full suite were not run locally): `tests/project-identity-guard.test.ts` — the six owner scenarios (allow, allow, block, block, mixed block, unknown block), the exact Sorani error, CLI exit codes, read-only guarantee and guard-before-production ordering in all four workflows.
- Cloudflare verification: not applicable — no runtime, Worker, route or deployment change.
- Production impact: none at merge time beyond one extra read-only step before the existing production steps; if the guard ever blocks a legitimate run, the workflow fails before changing anything.
- Next safe continuation point: confirm CI is green on the PR, then re-run the guard from the first real `Deploy to Cloudflare Workers` run after merge and record its result here.

## /dr e-mail-code sign-in for the owner — 2026-10-22 (PR #49 squash `f1483d9`; status: DEPLOYED and VERIFIED live, owner signed in)
- Owner request: "the same /dr sign-in as on the other project" for REGA; later (same day) "no code to anyone but rebar9988@gmail.com".
- Root cause of "cannot get in at /dr": anonymous /dr redirected to the password login; the owner's account (SUPER_ADMIN since 11:48 UTC, AuditLog `auditowner20261022rega0001`) had never signed in.
- Design: signed-out /dr renders `src/app/dr/SignInForm.tsx` (data-dr-sign-in); Credentials provider `admin-code` in `src/auth.config.ts`; rules in `src/features/auth/admin-code-core.ts`, DB/mail/limits in `admin-code.ts`.
  - code: 6 digits, stored only as HMAC (AUTH_SECRET, bound to the address), 5 min, single use, 5 guesses, 30 s resend cooldown, 8 sends/h per address, 24/h and 30 verifies/h per client IP (cf-connecting-ip).
  - opens a session only for an address on `DR_CODE_EMAILS` (owner only) held by an active, verified SUPER_ADMIN; account re-read after the code is spent; never creates users or changes roles; every address gets the same answer.
  - success writes AuditLog `auth.dr_code.sign_in` and mails a notice with time and IP, no code, token or link. Password sign-in (/owner-login, /<locale>/login) unchanged and linked from the form.
- Migration `20261022120000_admin_sign_in_codes` (one new table `AdminSignInCode`, additive) applied 2026-10-22 15:56 UTC via the Neon connector with a matching `_prisma_migrations` row (checksum = sha256 of migration.sql). No branch/snapshot backup possible (Neon free plan: branch limit 10 and snapshot limit reached; nothing deleted); recovery = PITR (6 h retention), restore point LSN `0/12524FD8` at 15:46 UTC.
- CI root causes fixed on the way: E2E/smoke/browser checks expected the old redirect; a `"use server"` module exported a plain object (`CODE_IDLE`), which breaks all /dr server actions at runtime (now `sign-in-state.ts` + unit test). One run timed out on a 23-min Playwright install (runner, not code).
- Verified: PR CI `verify` success on `a7690b7`; main CI, Deploy to Cloudflare Workers, Beta health and Production browser check success on `f1483d9`; live /dr shows the code form (Firecrawl, 200, no dashboard). Owner signed in with a code at 18:14 and 18:21 UTC (AuditLog rows), then used the dashboard (business.publish, region.deactivate); notice e-mails delivered via Resend from noreply@regaplatform.com without code or link. A code request for a non-admin address created no mail.
- Known, unchanged: `Workers Builds: rega-platform` fails on every PR branch (also #44–#48) and `Create Neon Branch` fails (branch limit); neither is a required check.

## Owner-only SUPER_ADMIN everywhere — 2026-10-22 (PR after #50)
- Owner instruction: the ONLY authorized SUPER_ADMIN address is rebar9988@gmail.com; reject every other address even with a stored SUPER_ADMIN role, server-side, at code request, code verification, session creation and protected access, including existing tokens and other sign-in routes.
- Change: `SUPER_ADMIN_EMAILS` + `effectiveRole` in `src/lib/rbac.ts` (fails closed to USER); applied in `auth.config.ts` (jwt sign-in + revalidation, session callback) and `auth-helpers.ts` (`currentUser`, `currentAccount`). `user-admin.ts` refuses to give SUPER_ADMIN to another address and counts only the owner as "last SUPER_ADMIN". /dr code allowlist now reuses the same constant. No database row changed: regaplatform1@gmail.com keeps its stored role but acts as USER.
- Also fixed: the hourly `Beta health` check still expected anonymous /dr/ai -> 307 (failed 21:41 UTC on fa32c81 although production was correct); it now requires the /dr sign-in form only.
- Tests: `tests/super-admin-owner.test.ts`; E2E `security.spec.ts` "SUPER_ADMIN power exists only for the owner's address"; the E2E SUPER_ADMIN fixture uses the owner address (throw-away CI DB, no mail provider).

## /dr security review and hardening — 2026-10-23
- Owner request: review /dr security (weak points or not); owner chose item 4 (90-day session) and asked to audit OTP, all sign-in methods, session lifetime and audit logging, fixing only confirmed issues while preserving owner access.
- Confirmed weak points and fixes:
  - `allowShared` keeps long windows only in memory per isolate; the edge binding is 10/60 s. The hourly code/verify/password caps therefore did not hold across Workers (about 600 code guesses/h, password about 10/min). Fix: durable limits from the audit trail for the owner's account only (`auth.dr_code.sent` 5/h + 12/day, `auth.dr_code.failed` 10/day, `auth.password.failed` 10/h).
  - Code rows were written for any address; now only for the served owner account. Reservation is an atomic conditional update/create (no cooldown race).
  - SUPER_ADMIN sessions lived 90 days; now they end 7 days after sign-in (`token.authAt`, `superAdminSessionExpired`). Other roles unchanged.
  - Failed codes/passwords were only logged; now audited. `setMessageStatus` was the only dashboard mutation without an audit row.
- Verified without change: owner-only SUPER_ADMIN on every route (#51), OAuth cannot grant it, codes HMAC-stored, single use, constant-time compare, neutral answers, no codes or secrets in logs, server-action origin checks.
- Accepted trade-off (reported to owner): the durable limits let an attacker temporarily pause the owner's code or password sign-in (up to a day / an hour); the other method keeps working. Password sign-in for the owner stays (owner access preserved; not changed without an explicit owner decision).

## Admin business hide / show again — 2026-10-23 (PR #55, squash `a155d77`; status: DEPLOYED, public site verified)
- Owner task: admin full control over every business listing (edit, hide, unhide), non-destructive, clean UI; no rebuild.
- Audit: editing other users' listings already worked (MANAGER and up = global access via `assertBusinessAccess`); list already had
  search, status filter, pagination and mobile cards; "archive" already hid a listing and every public surface filters on
  `PUBLIC_BUSINESS` (`archivedAt: null`) or the same SQL (sitemap). Gaps: an archived listing could never be shown again from /dr
  (publish/approval reject `archivedAt`); no confirmation before hiding; no hide control on the edit page; no public/hidden indicator.
- Change: `restore` intent in the existing `updateBusiness` action; `restoreData` + `lastHiding` + `publicVisibility` in
  `src/lib/business-publication.ts`. Show again = published only if it was published before hiding, is still verified, complete and
  the actor may publish; pending -> pending; else draft (unverified). Previous status and hider come from the hiding audit entry;
  non-publishers may only show a listing they hid themselves. Repeated hide = no-op. Confirm dialog before hiding, notices that keep
  list filters, Public / Not public / Hidden badge, control on the edit page (`VisibilityControl.tsx`), 7 locales. No schema change,
  no deletion, no public UI change; owners keep their existing ability to hide their own listing.
- Tests: `tests/business-visibility.test.ts` (7), e2e `tests/e2e/business-visibility.spec.ts` (desktop + mobile). PR CI `verify`
  success (lint, typecheck, unit, Node/Worker builds, workerd smoke, 311 browser tests). Main CI `39986965968`, Deploy `39989648186`,
  Beta health and Production browser check `39989956493` success. Cloudflare diagnostics `39989935371` success (log not readable here).
- Data: production (Neon `rega-platform`) before and after: 3 businesses published + verified (Karwans HairTuning, Sky berlin, taakline),
  3 locations, 3 users; none hidden or deleted. Live `/api/v1/businesses` lists all three after the deploy.
- Not verified live: an authenticated hide/show on production (it would change real listings; no test listing on production). The full
  flow ran against a real database in CI. Next safe continuation: owner tries Hide / Show again on a listing at /dr/businesses.

## Domain migration to www.rega24.com — 2026-10-23
- Task (owner): change the production domain only. Old `regaplatform.com`; new primary `www.rega24.com`; `rega24.com` 301-redirects to it.
- Changed: every host reference (canonical-host defaults in code, apex redirect, SEO/robots/sitemap
  base, legal/help text URLs, security.txt canonical, workflows, health checks, identity guard, tests, docs).
- Not changed (out of scope): brand, design, content, database, Worker/repo names, R&L. E-mail addresses on `@regaplatform.com`
  (EMAIL_FROM, CONTACT_INBOX, info@) stay: they belong to the verified mail domain, not the website host.
- Identity guard: REGA domains are now `rega24.com`/`www.rega24.com`; `regaplatform.com`/`www.regaplatform.com` are REGA retired hosts.
  The R&L copy of the guard was not touched (owner forbade any R&L change); it treats rega24 hosts as unknown, which fails closed.
- Deploy fix: the first production deploy (run 40004887934) failed at the Worker upload; the only config change was a
  `vars.CANONICAL_HOST` entry in `wrangler.jsonc` (a variable may not share a name with a dashboard secret). Removed; the
  code default is `www.rega24.com`, so the canonical host does not depend on a Worker variable.

## Business details page: one design on mobile and desktop — 2026-10-24
- Owner task: business page must look the same on mobile and desktop (desktop = reference), compact, one clear location button.
  Owner confirmed production is `www.rega24.com` (the prompt named the retired `www.regaplatform.com`; guard blocked it, owner answered).
- Audit (live Firecrawl screenshots 1366 px / 360 px of `/ckb/business/karwans-hairtuning`, code): the contact card sat beside the
  content on desktop but at the very bottom on mobile (after reviews); Call and WhatsApp were repeated in header and card; no location
  button (only a small OpenStreetMap link in the location card); 17rem empty cover block on phones; the RTL business name stayed 52 px
  because the unlayered `[dir="rtl"] h1` clamp in `globals.css` beats Tailwind sizes.
- Change (`src/app/[locale]/business/[slug]/page.tsx` only, plus `directionsUrl` in `src/lib/urls.ts`): header actions Call + Directions
  (existing `map.directions` label; Google Maps URL opens the device's map app, coordinates else address) + WhatsApp; contact card right
  after the header on phones (`order-first`, desktop unchanged column) without the repeated Call/WhatsApp buttons, phone number is a tel
  link; cover 11rem/14rem on phone/tablet, 17rem from lg; page-scoped `text-2xl! sm:text-3xl!` on this h1 (global RTL rule untouched);
  per-location directions link only when there is more than one location. No schema, route, i18n, colour or global CSS change.
- Tests: unit 334/334 (new `directionsUrl` test), lint, typecheck, Node build, local e2e (catalog, offers-whatsapp, a11y, urls,
  reviews; desktop + mobile) all pass. Local Lighthouse (localhost, not production): mobile P88 A100 BP100 SEO92, desktop P97 A100
  BP96 SEO92; SEO/BP deductions are localhost-only (canonical points to www.rega24.com; map tiles blocked in the sandbox).
- Not changed, reported: shared footer link overflows 7 px on German mobile pages (pre-existing, global, outside scope).
- Environment: this session cannot reach www.rega24.com directly (proxy 403); live checks via Firecrawl only.
- Deployed (PR #61, squash `4f7c90b`): main CI `40072209789`, Deploy to Cloudflare Workers `40073448987`, Beta health `40073449015`,
  Production browser check `40073612454` all success. Live (Firecrawl, 200): `/ckb/business/karwans-hairtuning` serves the directions
  button, no aside WhatsApp button, contact card `order-first`, no OpenStreetMap link.
- Found live: the directions button pointed to `90,180`. Production data (read-only SELECT, Neon `rega-platform`
  `lucky-glitter-73195208`): `karwans-hairtuning` and `taakline` have primary location latitude 90 / longitude 180, `coordsSource`
  manual (saved 2026-10-20/21); `sky-berlin` is correct. The live map already showed the North Pole before #61. No row was changed.
  Follow-up fix: `isMappableCoordinate` (`src/lib/coordinates.ts`) rejects |lat| = 90 / |lng| = 180 for the business-page map and the
  directions link, which then searches the address (trailing commas trimmed). Publish/validation rules unchanged.
- Owner action needed: re-place the pin for Karwans HairTuning and taakline at /dr/businesses (Find address or click the map).
  How 90/180 was saved through the admin form is NOT verified (picker clicks are rounded MapLibre positions, server accepts
  -90..90 / -180..180); worth a separate investigation.
- Deployed (PR #62, squash `158740f`): main CI `40077049706`, Deploy `40078304714`, Beta health `40078304696`, Production browser
  check `40078473725` all success. Live 2026-10-24 08:40 UTC (Firecrawl, 200, 1366 px and mobile): Karwans HairTuning shows the same
  header / Call + Directions / contact card order on both; directions href = `maps/search/?api=1&query=Bonner Str. 2a, 53909 Zülpich`;
  no `90,180`, no North Pole map. Active Cloudflare version not read (no Cloudflare connector).
- Next safe continuation point: owner re-places the pins for Karwans HairTuning and taakline in /dr/businesses; then the map and
  point-directions return automatically. Optional follow-ups (not started): find how 90/180 was saved by the admin form; footer link
  7 px overflow on German mobile pages.

## Unified premium business profile — 2026-10-24 (owner master task "one business profile system")
- Audit: every business (all categories, existing and new) is served by ONE route, `src/app/[locale]/business/[slug]/page.tsx`
  (`/businesses/<slug>` redirects there); no parallel profile system exists, so the task was quality + de-duplication inside it.
  No video was attached in the session (only two images).
- Duplications removed: About text (header clamp + section) → section only, with read-more for long text; "no ratings" placeholder
  in the header next to the reviews empty state → rating shown only when it exists; review count repeated in the contact card;
  email shown as button and text → one button with the address; open state in the facts row only (other locations keep theirs);
  WhatsApp only in the contact card; languages section → one fact card; empty "no services" block → section hidden.
- Profile structure (data-driven, each part only with real data): compact identity (cover only when uploaded, else logo/initial
  avatar instead of a 17rem empty block), name/category/city/verified, actions Call · Directions · Share (directions red when the place
  is findable, else call), facts (opening state → #locations, languages), About, offers, services (image cards when any service has a
  cover, else list), photos, locations (map + address + weekly hours), reviews, contact card (order-first on phones).
- New: `src/components/business/ShareButton.tsx` (share sheet, else copy link), `ExpandableText.tsx`; `share-2` icon; 4 keys
  (`businesses.share|linkCopied|readMore|readLess`) in 7 locales; `OpenState` takes a `className`; services select adds `coverUrl`.
- Shared dependencies fixed (documented, narrow): footer columns `min-w-0` + word wrapping (7 px overflow on German phones);
  header below 360 px: `px-3` and the search icon hidden (search stays in the bottom bar) — the row overflowed 32 px at 320 px in
  every language (RTL clipped the logo). No change at 360 px and wider.
- Tests: `tests/e2e/business-profile.spec.ts` (desktop + mobile): 3 categories × 7 locales, 320/375/430 px overflow + logo + 44 px
  actions, duplication checks, share copy, directions.
- Local results: lint, typecheck, unit 334/334, Node build; full Playwright suite: every Chromium test passes (desktop + mobile,
  incl. 10 new profile tests); the 8 `iphone` (WebKit) tests cannot start in this sandbox (WebKit not installed) and run in CI.
  Local DB note: a row changed for an experiment was restored to its seed value (Erbil 36.191/44.009) before the final run.
- Deployed (PR #64, squash `8d81cc0`): main CI `40087646947`, Deploy `40088810271`, Beta health `40088810285`, Production browser check
  `40088944803` all success; PR CI `verify` (incl. WebKit/iPhone) success. Live 2026-10-24 11:21 UTC (Firecrawl, 200):
  `/ckb/business/karwans-hairtuning` desktop 1366 + mobile and `/en/business/taakline` mobile render `business-profile`,
  `business-actions` (share + directions; call only where a phone exists), `business-facts`; phone shown once; no aside WhatsApp.
  `sky-berlin` returns 404 because it is `draft` / unverified since 10:22 UTC (changed in /dr before this deploy) — correct behaviour.
- Still open (owner): re-place the pins for Karwans HairTuning and taakline (both still 90/180); decide on sky-berlin's status.

## Admin panel premium modernization — pin, safe delete, unified mobile/desktop — 2026-10-24 (PR #65, squash `cf214d9`; status: DEPLOYED)
- Owner task (with a reference screenshot): modernize the existing `/dr` admin only; phone and desktop the same product; Edit, safe
  Delete, administrator Pin/Unpin. Owner explicitly authorized visual changes inside the admin panel for this task (the standing
  non-visual rule still applies everywhere else). Public site, schema and R&L untouched.
- Reused: `featured` = Pin (no schema change), existing soft delete (`deletedAt`) = Delete, existing hide/show-again, `updateBusiness`,
  `assertBusinessAccess`, RBAC, audit log, BusinessForm, Avatar, colour tokens.
- Shell: `DrSidebar` (one `<nav>` for every size: sidebar from `lg`, compact top bar + same list below), grouped nav with icons
  (`src/components/dr/icons.tsx`, Lucide paths, no dependency), active state. Overview: real counts only (attention chips, key stats as
  links, review queue, pinned, recently updated, activity). Business list: status tiles, compact toolbar (search, category, city, missing
  location), dense table that collapses to the same row on phones (city/location from xl, updated from 1360 px), status pills, pinned
  first (`orderBy featured desc, updatedAt desc`), inline review for pending, one action menu (`ActionMenu`, `BusinessActions`).
  Edit page: compact header with status/visibility/verification/pin and the same menu.
- Delete: server action `deleteBusiness` (permission `business.delete` = SUPER_ADMIN/ADMIN) sets `deletedAt` (+ archived), audited
  `business.delete.soft`; `ConfirmAction` dialog names the business and the consequence; undo in the notice; "Deleted" tile/view with
  `recoverBusiness` (audited `business.recover`), which brings it back hidden. The REST `DELETE ?hard=true` path is unchanged and unused.
- Pin: new permission `business.pin` (SUPER_ADMIN/ADMIN; managers lost the old feature button), enforced in the server action and REST
  POST/PATCH; audited `business.feature` / `business.unfeature`.
- Lesson: never import plain constants from a `"use client"` module into a server component (they arrive as client references);
  menu row styles live in `src/components/dr/menu-styles.ts`. The global unlayered `[dir=rtl] h1` clamp needs `text-2xl!` on admin h1s.
- Tests: unit `rbac` (pin/delete roles), e2e `business-visibility.spec.ts` (hide, pin order + reload, delete cancel/confirm/undo/restore,
  employee gets no controls + REST 403s, no horizontal scroll and menu on screen; desktop + Pixel 5), updated `auth.spec`, `admin-business`.
  PR CI `verify` on rebased head `30747ed`: lint, typecheck, unit, builds, Worker smoke, 327 browser tests pass. Visual review with CI
  screenshots at 360/390/430/768/1024/1280/1440 px in ckb (RTL), de and en (temporary branches `preview/admin-shots` and `preview-shots`
  remain on GitHub; this session's proxy cannot delete branches — safe to delete).
- Deploy: main CI `40092930996`, Deploy to Cloudflare Workers `40093968089` and `40093975508`, Beta health and Production browser check `40094114547` (live site, desktop + mobile) success. Live: `/dr/businesses`
  anonymous shows the e-mail-code sign-in (no data). Production data unchanged by this task: 3 businesses, none deleted or pinned.
- Found, not changed: Sky berlin is draft/unverified since 2026-10-24 10:22 UTC — the owner account clicked "Remove verification" in the
  old panel (audit `business.unverify`). Republish = Approve & publish in its ⋯ menu (owner decision).
- Not verified: authenticated live use of the new panel (no owner session here). Next: owner signs in at /dr and tries pin, hide, delete
  + undo on a listing.

## Business profile: gallery, map-app chooser, editor controls — 2026-10-24 (owner task "premium profile modernization")
- Audit (reused, not rebuilt): one profile route; existing media pipeline (`/api/v1/media/business-image`, byte/MIME/size checks,
  `assertOwnMedia` ownership, Media table), `BusinessImageEditor` (crop/drag/pinch/zoom/reset; EXIF orientation applied and
  metadata stripped by the browser decode + canvas re-encode), `BusinessImageField` (logo, cover), `PhotosField`.
  Production data before the change: 3 businesses, none with cover, logo or gallery photos — no media to migrate.
- Gallery: cover + `GALLERY_PHOTOS` = 3 further images (`src/lib/business-admin.ts`). Server rule: a save with more than 3
  photos is refused (`media_invalid`) unless every photo is already stored on that listing, so older listings keep up to
  `MAX_PHOTOS` = 10 (nothing deleted) and can reorder/remove but add only below the limit. `PhotosField`: 4:3 crop, reorder
  (earlier/later), replace in place, remove with confirmation, over-limit note. Cover/logo removal also confirms.
- Editor: explicit move (←↑↓→) and zoom (−/+) buttons; logo shows a live preview at profile size before confirming.
- Profile: gallery at the top (main image + up to 3 thumbnails, photo count, sizes reserved), separate Photos section removed;
  address shown once in the facts row (location card shows the address only for multi-location businesses; a single location
  card holds opening hours only). Directions: `DirectionsMenu` + `mapLinks` (Google Maps, Apple Maps, Waze; Android also `geo:`
  for the system chooser); coordinates first, else the URL-encoded address; never the visitor's location.
- i18n: 15 keys in 7 locales (businessImages.*, map.openWith/otherApp, businesses.photoCount/openPhoto).
- Tests: unit (mapLinks), e2e `business-gallery.spec.ts` (desktop + mobile, via the local HTTPS proxy like business-publication),
  directions menu + address-once in `business-profile.spec.ts`; existing logo-removal test accepts the new confirmation.
- Local test DB note: repeated local runs leave "E2E …" Berlin listings that push demo rows to page 2 of the Berlin list
  (catalog "locations page" test); CI starts from a fresh DB. Leftovers were soft-deleted in the local throw-away DB only.
- Review fixes before PR: the directions menu was clipped by the profile card (`overflow-hidden` removed) and, when Directions is
  the first action (no phone), spilled off-screen on phones → menu now anchors to the action row (full row width on phones,
  start-aligned `max-w-sm` from `sm`), checked in LTR + RTL; thumbnail strip capped at `max-w-md` from `sm` (same structure on all
  sizes). The upload route allows 10 uploads/min per person; the gallery e2e (5 uploads) waits out the window and re-confirms
  if it is hit, like a person would. Local full suite (desktop + mobile): 323 passed before these fixes; affected specs re-run green.

## Infrastructure index — 2026-10-25

- Task: add a permanent system map and troubleshooting runbook. No application code, no migration, no domain change, no Worker publish intended.
- Added: `REGA24_SYSTEM_MAP.md`, `REGA24_TROUBLESHOOTING.md`, `docs/generated/system-inventory.json`, `scripts/generate-system-inventory.mjs`, `scripts/validate-system-docs.mjs`.
- Agents: `AGENTS.md` and `CLAUDE.md` section 6 now require those files. They do not replace this file or the Google Doc.
- Corrected in this file only: the P0 identity line that still called production `www.regaplatform.com`. Live production is `https://www.rega24.com`. Historical notes below that date were left as history.
- Deploy guard: `DOCS_ONLY_SKIP` in `.github/workflows/deploy.yml`. A documentation-only commit on `main` must not call `wrangler deploy`. `workflow_dispatch` still deploys. CI runs `node scripts/validate-system-docs.mjs`.
- Verified this session: public HTTP (health `ok: true` at 2026-10-25T18:02:00Z, redirects, jobs/events 404, `/dr` code form), DNS NS `autumn`/`max`.ns.cloudflare.com, TLS Google Trust Services WE1 through 2026-01-21, GitHub Beta health run `40217513295` success on `e8e2b69`.
- Not verified: Cloudflare dashboard, Worker version, Neon console, secret values. Google Doc was read and not updated (no write tool).
- Production impact intended: none. CI on `main` will still run. The Worker must not be replaced by this commit.


## Repository cleanup — 2026-10-26 — PR #76 (not deployed)

Baseline main `7011eb5`; remote recovery checkpoint `checkpoint/rega24-before-cleanup-20261026` and local full-history bundle created first. Isolated cleanup branch removes two unreachable UI components and consolidates directory/search business cards without changing their rendered output (448 comparisons pass). Reuses PR #71's tracked-path inventory fix/test; ignores Python caches. Two compatible transitive lockfile updates reduce npm audit findings 10→8. No direct dependency/workflow/asset/migration/data/infrastructure deletion. Active PRs retained; #68/#72/#75 own existing no-op/Neon/target work. Details: `docs/repository-cleanup-2026-10-26.md`.

Local lint/typecheck, Node/Worker builds, dry-run, Python 7 and inventory regression pass. Full Node suite 331 pass/1 pre-existing tsx IPC EPERM failure/4 DB skips; hosted final-head checks required. Canonical live rega24 deployment cf37b341/version f7a118cd observed read-only. Main's retired target, deployed-source provenance and credential-release holds still block merge/deploy. No 100/100 claim; next: review PR #76 checks and reconcile #75 release gates.

## Cleanup release hardening — 2026-10-26 — PR #76

Owner explicitly requested resolving the blockers and deploying. Original PR head d4e5bbf passed complete hosted CI 40285442047, including browser/runtime checks. Added recovery checkpoint `checkpoint/rega24-pr76-before-hardening-20261026` before this continuation. Target repair reuses the focused implementation/tests from #75; no unrelated #71/#73/#74 application changes imported. Unconsumed Neon provisioning reuses #72's manual policy: real schema/migration/browser QA remains on disposable PostgreSQL; no Neon branches/backups are deleted. Verified main has no protected required checks or rulesets, so no required gate was removed.

Dependency audit reached zero findings with Zod 4.6.7+ and scoped same-major glob/undici overrides. Zod 4's optional-default behaviour initially failed four new PATCH regression tests; all six validation cases pass after explicitly removing create defaults from partial-update fields. Creation defaults stay unchanged. Added an all-severities npm audit CI gate.

Both Wrangler files now define isolated previews. Preview entry guards run before application/cache/provider handlers, return explicit non-ready 503 except isolated health, and cannot use inherited production credentials. This repairs missing preview configuration without claiming a fully configured functional preview. Full application QA remains in CI. Python isolation regression passes; no billed inference invoked.

Cloudflare metadata-only protection: OPENAI_API_KEY and XAI_API_KEY in rega24's Previews Base were plain_text. Converted the SAME values internally to secret_text via scoped merge-patch; HTTP 200/readback verified both types, all binding names, production deployed_on and references unchanged. No key value was output, no credential deleted/rotated, no production code published by that operation. Provider-side revocation/rotation is still unverified; encrypting storage is not proof of revocation.

Pre-release live health/browser: canonical site serves normally; DB/migrations/content/auth/storage/AI/email ready, four configured providers. Current immutable rollback version f7a118cd-6f64-4206-a19e-ec5b434a5bc9/deployment cf37b341-5e5c-4703-915b-731aeefa6bfd. Its source has no Git annotation; do not claim exact source identity. New web releases attach the checked-out verified workflow-run SHA as version tag, and the read-only target preflight checks stable tag/account/domains before publishing. Final-head CI, deployment and live readback results must follow before marking this release done.

## About page global positioning — 2026-10-26

Owner scope: About page only; replace community/Germany-only positioning with Rega24's global vision. Updated only `about` and `pageMeta.about` in all seven catalogues. Describe existing directory, map, profiles and language support; distinguish global ambition from actual local coverage and avoid unverified trust/AI/native-app claims. About-only metadata uses Rega24 and an absolute title, leaving shared branding/navigation untouched. Existing layout, CMS story, operator/legal identity and social links preserved. Baseline main 7e16349; canonical Worker rega24 verified read-only (deployment e3747e03/version df20f6a1, 100%). Local and exact-head CI/release verification pending; no deployment claimed yet. No database, infrastructure, dependencies or unrelated page changes.


## Hosted validation and deployment-command repair — 2026-10-26

PR #77 merged as `7e16349e2314255a25987b1497c66d0dd927cdea`; its tree exactly matches the verified candidate. Main CI `40387716820` passed: 351 unit/integration tests, 331 E2E tests, 8 Python tests, zero Node skips/failures, lint/typecheck, disposable PostgreSQL migration/preflight, both production builds and workerd codec/route smokes. npm 10 clean install and audit pass with zero findings at every severity. Overrides are version-specific (`glob@10.3.3`, `undici@7.29.1`) and retain their major versions. Focused release tests: 26/26.

The #77 source checkpoint is 4,592,343 tracked bytes / 538 files versus baseline 4,568,729 / 533. Exactly 3 removed, 8 added, 26 modified; added safety code, tests and documentation explain the net increase. Dependencies removed: 0. Workflows modified: 7; deleted: 0. No schema/migration or brand-asset changes. Git history is preserved; no Git-storage reduction is claimed.

Python production workflow `40387716870` passed live health, anonymous rejection and authenticated process/embed/rerank smokes before enabling web integration. Cloudflare's Python build trigger incorrectly used the web root/commands. Its production trigger is now validation-only in `/services/ai-python`; the existing branch Preview settings were repaired separately. Correct preview build `cf311921-fc31-4eed-9e48-942728b73464` passed; readback shows `main.py` and only `REGA_ISOLATED_PREVIEW=1`, without production/provider bindings. Public preview probes returned Cloudflare 403/1010; live preview application QA is unverified.

Web release `40390749927` failed before upload: OpenNext forwards CLI arguments through a shell without preserving spaces in the deployment message (`Unknown arguments: CI, release`). The message now uses one shell-safe token. CI's dry-run invokes the actual OpenNext forwarding path with the same message and a synthetic tag; this passed locally alongside 19 release/identity/ownership tests and documentation validation. No application or dependency version change is needed. Final hosted/deployment/readback evidence belongs in PR #77 and the central Doc; never treat a dry-run as a production deployment.


Concurrent integration: PR78 independently passed full CI40391309551 and merged About copy/metadata changes as8edc1ed. Preserve its complete content and memory entry. PR79 had only an append conflict in this file; resolved by retaining both notes, without altering application files. Production health now reads the approved Kurdish About title from the catalogue rather than a stale hardcoded title.


## Neon to D1 preparation — 2026-10-27

Owner requested migration of Rega24 from Neon to Cloudflare D1 and confirmed an existing backup/export; file not yet received. Identity guard verified REGA, baseline/main c8f0cf2. Read central Doc before starting. Read-only Cloudflare checks: rega24 version 5ab5e7d5 / deployment 5b341ca4 at100%, source tag c8f0cf2, query redaction true; existing EU D1 rega24-migration (728f792d-37b6-49f8-abc1-e81512219f7d) reports zero tables and no production binding. Neon Rega24/lucky-glitter-73195208 SELECT1 returned HTTP402 quota. No export possible through that connection.

Added separate staged D1 schema/SQL, offline generator and in-memory SQLite verification, with details and required runtime/data/release work in docs/D1-MIGRATION.md. Active PostgreSQL schema/client/builds/workflows remain unchanged. No remote resource, binding, migration, import, paid activation, deletion or deployment. Local branch codex/rega24-d1-preparation-20261027; no PR/commit/deploy claimed. Backup validation and runtime transaction/lock/search/array/health/CI conversion remain outstanding. Next: receive backup, inspect/restore privately into disposable PostgreSQL, finalize mapping and verify data before remote import/cutover. Central Doc was read; no append-capable write used in this preparation.

Verification for staged D1 preparation: Prisma 6.19.3 schema validation/diff PASS; in-memory SQLite rehearsal PASS for all36 models/scalar columns, JSON defaults, Kurdish round-trip, original Offer/role constraints, FK rejection/cascade; generator ESLint, git whitespace and local documentation links PASS. Full application builds/browser/runtime tests not run because no runtime was changed. System inventory regeneration failed in this executor with spawnSync git EPERM; documentation validator therefore not claimed green. No inventory data fields were intentionally changed.


## D1 continuation — target schema and export rehearsal — 2026-10-27

Owner requested autonomous completion. Searched local/workspace/tmp files and Drive; no source export found (Drive search cannot establish absence of unsupported archive types). Located existing Neon backup-rega24-20261026-pre-release/br-broad-queen-b2f9p1p0 and restore-verification branches; both the latest production SELECT1 and backup SELECT1 return402. Old native snapshot dated2026-10-02 is not a current downloadable export. No Neon write, restore, deletion, resource creation or plan change. Requested backup file/location; not received yet.

Prepared read-only local-restored-backup exporter with strict typed conversion and private files, per-row/table hashes, and a separate in-memory SQLite verifier. Mapping/rehearsal tests cover money, UTC/day dates, NULL versus JSON null, arrays/multilingual/injection text, tampered checksum and changed data with recalculated checksum. No real export/import tested because source remains unavailable.

Remote change: after exact account/name/UUID and fresh empty-target guards, applied105 CREATE statements to existing disconnected D1 rega24-migration/728f792d-37b6-49f8-abc1-e81512219f7d. HTTP 200/all statements success. Readback all36 table scalar-column sets match, total application rows0, FKviolations 0. Canonical Worker still has noD1binding and queryRedactiontrue. An oversized compound SELECT failed read-only, then separate count queries verified successfully. No production deploy/binding/route/secret/data change. This supersedes earlier notes saying no remote schema change.

Runtime adapter/transaction/locking/arrays/search/health/CI conversion, actual backup validation/data import and production release remain incomplete. No100/100 claim. Continuation details in docs/D1-MIGRATION.md; preserve current production and obtain source export before data cutover.

Final continuation verification: schema generator/Prisma validation, typed mapping and cross-language SQLite/hash/tamper rehearsal,36-model constraints/FK rehearsal, ESLint and documentation relative links/whitespace all PASS. Full system inventory remains unverified due existing executor subprocess EPERM, not marked green. Central Google Doc was now updated through revision-guarded native Docs append and readback verified (supersedes earlier no-append note). Owner reiterated autonomous completion but provided no source-file location; source access and full application/runtime migration remain blocked/incomplete. No100/100 claim.

## D1 actual backup restore, complete data import and runtime verification — 2026-10-27

Supersedes earlier source402/backup-unavailable notes. Received owner's Drive archive rega24-2026-10-27-212653.dump; SHA256 4bfeb4beaab6f4655f7cac61c7e6b73fea121a6e194e902857b37fd1151116fb. Actual local PostgreSQL17.11 restore succeeded; all36 application fingerprints matched live Neon. Existing disconnected EU D1 rega24-migration/728f792d-37b6-49f8-abc1-e81512219f7d now contains all2329 application records, imported in41 journaled batches. Every original typed scalar value/hash and FK verified remotely. A newline-normalization discrepancy was detected and repaired with one guarded update, then byte-preserving splitting gained a regression test. No customer records are committed.

Runtime0002 was rehearsed against the real restored export, then applied to the disconnected target. Real D1 migration history has0001_initial.sql and0002_runtime.sql;108 revision triggers and Unicode case mirrors backfilled. Remote rehash still matches all2329 records, FKviolations 0. Actual workerd binding tests passed for nested writes, Unicode, date filters, compound daily upserts, atomic rollback and cascade. Local351 existing application tests passed; browser/complete Worker release checks remain in progress. D1 date-filter mismatch was caught and corrected before activation.

Candidate application uses PrismaD1 plus guarded native atomic batches; SDK's ignored transactions are rejected. Same domain rules and owner-only SUPER_ADMIN remain. Candidate wrangler adds existing DB binding/providerD1, production release retains exact-main CI/identity/ownership gates and adds exact-SHA final-snapshot readiness. Preview remains isolated with no D1 binding. Node22.16+; new dependency @prisma/adapter-d1@6.19.3; npm audit0 vulnerabilities. Detailed procedures and limitations: docs/D1-MIGRATION.md. Production is still PostgreSQL until final snapshot freeze, hosted checks, release and live readback actually complete; do not claim100% yet.

## D1 release checkpoint — 2026-10-28

VERIFIED: migration PR #83 merged as `2da35b15ad8167b14af425471c3a88699e5e67d0`. Its exact-main CI `40644108064` passed all application checks, including both 331-case browser suites, native D1 atomicity/concurrency tests and real Worker routes. Four source tables changed after the original archive; a consistent reconciliation brought the disconnected D1 to 2332 records across all 36 application tables. Every original typed scalar value matches, with zero FK violations, three migrations and 108 revision triggers.

The refreshed private archive `rega24-verified-source-2026-10-28.dump` was restored and checked against all source tables, then uploaded and downloaded from Drive file `1pLUm0lHDJoZ2r6iO2EhfXdIG0NQfHbnM` with identical SHA-256 `59713feb5a4161a05ab50a1b1734352fcb7555d838d1625192dfaf8961b080d4`. The original archive remains intact. No production seed, credential reset or Neon resource deletion occurred.

The first cutover attempt stopped at the CI readiness gate. No D1 application was activated. Original PostgreSQL availability was restored at 07:22 UTC and live health 200 verified. Readiness fix PR #84 merged as `09afcd538a71fff6b08627057d272bf318e4362c`; 354 unit tests, 10 native D1 tests, lint/typecheck/docs passed locally and the changed gate passed hosted unit/native checks. Exact-main CI `40651797849` is running. Production is still PostgreSQL, isolation=0; final activation and live D1 verification remain pending. See [D1 migration procedure](docs/D1-MIGRATION.md).

## D1 production migration complete — 2026-10-28

Supersedes all earlier pending D1 checkpoints: production `rega24` now runs D1 at 100% traffic. Verified exact source release `09afcd538a71fff6b08627057d272bf318e4362c`; version `912d7b51-341a-4017-bed9-470cd1b39c1c`, deployment `97a07f0a-96e5-4bb5-a049-bbef69c74cea`. DB binding points to existing EU `rega24-migration` / `728f792d-37b6-49f8-abc1-e81512219f7d`; provider=d1, isolation=0, query redaction=true, original 29 bindings and official domain ownership preserved. No new Worker/database, paid activation, production seed, account reset or Neon deletion.

All 36 source tables / 2332 records and every original typed D1 value matched after the final request drain, before traffic opened. Source remained unchanged after activation; target FK violations 0, three real migrations, 108 revision triggers. Refreshed private Drive archive `1pLUm0lHDJoZ2r6iO2EhfXdIG0NQfHbnM` restores fully and its downloaded SHA-256 matches `59713feb5a4161a05ab50a1b1734352fcb7555d838d1625192dfaf8961b080d4`. Original archive retained.

Exact-main CI 40651797849 passed 354 unit, 10 native D1, 8 Python and 331 browser cases per provider plus Worker/build/audit checks. Deploy 40655046631 succeeded. Post-cutover health 40655046619 attempt 2 reports actual provider d1/ok/HTTP 200; browser 40656143224 passed 201 desktop/mobile checks, 0 failures. Public business/geography API data exactly matched the prior production responses. Additional kmr/fa/tr pages and fresh RTL browser images verified; eight loaded images, no broken images.

Initial readiness attempt was safely blocked, source availability restored, then PR #84 changed only the gate transport to an operator-issued proof over existing Workers settings. The final gate actually passed. A browser run during the authorized source freeze observed 503; the post-cutover replacement run passed. Evidence and continuation: [cutover evidence](docs/evidence/d1-production-cutover-2026-10-28.json), [migration/recovery](docs/D1-MIGRATION.md). Do not rerun imports against active D1 or roll back to the old PostgreSQL application without reconciling D1 writes. Production sign-in/email was not triggered with customer accounts; disposable integration coverage and preserved auth configuration/hashes verify migration behavior.

## Permanent Cloudflare platform mandate — 2026-10-28

Owner instruction: Rega24 ONLY (`rebar9988-max/Rega`, `www.rega24.com`). All future application infrastructure work must use Cloudflare: D1 for the production database, Workers for backend/API, R2 for files/images, Cloudflare for hosting/deployment, DNS and security. Added the authoritative rule to CLAUDE.md section 0.9; AGENTS.md already applies all CLAUDE rules to every agent. GitHub remains source control/review/CI. Retained Neon/private backups remain recovery assets, not active application infrastructure; this instruction does not authorize deleting them. Quality 100/100 is an objective, not an unverified certification.

Read central memory and verified GitHub main caac065 before editing. Read-only Cloudflare checks confirmed provider d1 with existing database 728f792d-37b6-49f8-abc1-e81512219f7d / isolation 0; configured storage endpoint is R2 and the configured bucket exists in the same account; rega24.com is an active zone with Cloudflare nameservers. No audit score for individual security settings is claimed. Updated system map/runbook and corrected legacy deployment, architecture and backup instructions to identify D1/Workers/R2, the legacy-only PostgreSQL workflow, and safe restore rehearsals without customer-data E2E fixtures.

Documentation only: no runtime/configuration/schema/DNS/security rule/secret/resource change. Validate with generated inventory, documentation links and git whitespace; application tests/build need no repeat for this policy update. All changed paths match the existing documentation-only deployment skip rule, preserving the verified production release. Continue future work within the Cloudflare platform mandate and existing REGA identity/CI/ownership safeguards.

## Documentation merge deployment guard correction — 2026-10-28

Final verification of the permanent Cloudflare policy exposed a real docs-only release guard bug: `git diff-tree --no-commit-id --name-only -r HEAD` returns no paths for a PR merge commit. The configured empty-diff fallback then deployed, even for documentation. Earlier notes inferred DOCS_ONLY_SKIP from allowed paths without exercising a merge; those no-replacement claims were incorrect. Cloudflare actually shows documentation release caac065 as active version 38a340a5-7c83-4db8-b73a-1716c3c16b40 since 09:09 UTC, still provider d1 at 100%. Exact-main CI 40657214994, deployment 40661821443, health 40661821485 and browser 40661946377 all succeeded for that release. No database/provider/data loss was observed. Historical cutover evidence still records the initial 08:18 activation.

Fixed only the workflow scope comparison to `git diff --name-only HEAD^ HEAD` so merges compare with their first parent. Preserved the allowlist, manual dispatch behavior, root/empty-diff fallback, exact-main CI, identity and ownership gates. Executing the actual shell against real disposable Git histories passed 8 corrected cases (including depth 2 docs merges and app/mixed merges); the old unwanted-deploy behavior was reproduced separately. Running the corrected shell against actual policy merge da259e0 returns skip=true. Evidence: docs/evidence/deployment-scope-regression-2026-10-28.json. All 18 relevant identity/ownership/readiness regression tests passed. This workflow/documentation fix contains no application change and itself matches the existing skip allowlist.

## Global discovery upgrade, round 1 — Kurdistan/Iraq geography, opening status, open-now search — 2026-10-28 (PR #88)

Owner brief "REGA24 global platform upgrade" (audit → improve → extend). Identity guard OK (REGA, `main` 63149e6). Audit, read-only:
- Production D1 `728f792d…`: 3 businesses (2 public), 19 categories, 0 services. Iraq had **1 region, 2 cities** (Erbil, Sulaymaniyah). The Kurdistan Region was named only in en/de.
- Public routes `/ckb`, `/ckb/businesses`, `/ckb/services`, `/en/businesses`, `/en/services`, `/en/ai`, `/ar/businesses`, `/ckb/search`, `/ckb/nearby` and `/api/health` all returned 200 at 16:2x UTC. The earlier reported 500s **did not reproduce**; no fix was needed. `/ckb/jobs` returns 404 **by design**: the `jobs` section has `enabled: false`, "Hidden until launch", so launching it is an owner decision.
- Already in place and kept: Unicode/Arabic-script folding and function-word search, Nearby with an open-now filter, MapLibre, opening hours with overnight ranges, location picker, moderation-only public visibility.

Changes in PR #88 (no schema change, no route change):
- Seed: Iraq regions (Kurdistan Region plus the Baghdad, Basra, Nineveh, Kirkuk, Najaf and Karbala governorates) named in 7 locales. 19 cities added. Kifri has **no region** because its assignment is disputed; Kirkuk is under its own governorate. The seed writes every region translation and stays upsert-only.
- `openStatus()` (geo.ts) returns OPEN / CLOSING_SOON / OPENS_SOON / CLOSED / HOURS_UNKNOWN plus the next time, in the location's timezone. It is property-tested against `isOpenNow`. `OpenState` shows it, with 5 new messages × 7 locales.
- `search-intent.ts`: an "open" + "now" word in 7 languages becomes an open-now filter (businesses only, ≤300 candidates, unknown hours never count as open), with a notice on the search page.
- `prisma/d1/data/20261028_iraq_geography.sql`: the same Iraq rows as additive, idempotent SQL for production D1, kept identical to the seed by a test.

Tests (local): `npm test` 364 tests, 360 pass, 0 fail, 4 DB-only skips; typecheck and lint pass; `test:d1` 10/10; seed run twice on a disposable D1 is idempotent. The SQL file was rehearsed on a pre-change D1 copy (+6 regions, +47 names, +19 cities, FK clean, second run no-op, values identical to the seed, empty DB no-op).

**Production geography rows APPLIED (owner instruction «جێبەجێی بکە», 2026-10-28 17:49 UTC).** The session first refused a write without explicit owner approval; after approval the three statements of `prisma/d1/data/20261028_iraq_geography.sql` ran on D1 `728f792d…`. Restore point (D1 Time Travel) 2026-10-28T17:49:12Z. City 2039→2058, Region 22→28, RegionTranslation 44→91; Business/Location unchanged (3/3); FK violations 0. A readback of all 21 IQ cities (names, coordinates, folded columns) and all 49 IQ region names matched the seed. Live `/api/v1/geo?country=IQ` lists 7 regions, and «عەنکاوە», «هەڵەبجە» and «duhok» each find their city. Undo: delete the ids `seed_city_iq_*`, `seed_rt_iq_*` and `seed_region_iq_*` except `seed_region_iq_kurdistan-region`, which already existed.

Not done in this round (needs an owner decision or a schema change): search analytics (new table + privacy/consent review), holiday/temporary-closure hours (schema), districts (no model), Jobs launch (flag), typo tolerance, Lighthouse measurements (not run).
Release: PR #88 squash `e13f60a`. Exact-main CI 40735869540, Deploy 40741609781, Beta health 40741609899 and Production browser check 40741866280 all succeeded. Live checks at 18:14 UTC: `/api/health` ok, provider d1. `/ckb`, `/ckb/businesses`, `/ckb/services` and `/en/ai` return 200. `/ckb/search?q=ئێستا کراوە` shows the open-now notice and a plain query does not. Business pages show the new status, e.g. «داخراوە · دەکرێتەوە پێنجشەممە لە 11:00», which matches the stored hours in the IQ and DE timezones.
Next safe continuation point: round 2, which needs owner decisions: search analytics (schema + privacy), holiday/temporary closures (schema), Jobs launch, typo tolerance, Lighthouse measurement.

## Global discovery upgrade, round 2 — search typo correction ("did you mean") — 2026-10-28

Owner choice (round 2 = Smart Search only; next: holiday/temporary closures → Lighthouse → Jobs → search analytics). Audit: search matched folded substrings only (`textWhere`); no typo tolerance existed anywhere (page, `/api/v1/search`, AI).
- `src/lib/search-correction.ts` (pure): the vocabulary is the words of the `searchText` of public businesses, published services and active locations, so a correction always leads to real, public results.
  - A query word that already matches (as a substring) is never changed.
  - Unknown words are replaced by the closest vocabulary word: optimal-string-alignment distance including the word's prefix. Allowed edits: 0 for ≤2 letters, 1 for ≤4, 2 for ≤8, 3 above.
  - Sorani near letters ڕ/ر, ڵ/ل, ێ/ی, ۆ/و count 0.5. Ties go to the word in more records.
  - A letter-bitmask lower bound skips most words.
- `searchAll`: only when the search finds nothing (page 1), it retries once with the corrected words, in normal and open-now mode alike; in open-now mode the corrected query keeps the «ئێستا کراوە» words (`intentWords`).
- Vocabulary: ≤2000 rows per table, ≤20,000 words, cached per Worker isolate for 5 min.
- Search page: notice «هیچ ئەنجامێک بۆ «…» نەدۆزرایەوە…» plus a «مەبەستت «…» بوو؟» link; tabs and pagination continue with the corrected query.
- 2 new messages × 7 locales. No schema, route, API or design-token change; `/api/v1/search` is unchanged.
- Measured locally (worst case, random words): 20,000-word vocabulary built in 52 ms; a correction takes 7–29 ms. At today's real size (2 public businesses) it is well under 1 ms.
- Tests: 6 correction + 3 intent unit tests (7 languages, near letters, no wild guesses, prefix, ties, cap); `npm test` 370 tests, 366 pass, 0 fail, 4 DB-only skips; typecheck and lint pass.
- E2E on a disposable D1, `build:node` of the final code: catalog.spec 26/26 on desktop and mobile, including the new typo test. Broader regression: 81/82; the one failure was the sitemap `/guides` expectation, which needs `content.spec.ts` to run first. Run in CI order (content + seo) it passed 50/50, so it is test order, not this change.
- Release: PR #90 squash `14371a0`. Exact-main CI 40761152562, Deploy 40766214581, Beta health 40766214472 and Production browser check 40766414442 all succeeded. Live checks at 20:59 UTC: `/api/health` ok, provider d1.
  - «hairtunig» → notice «Meintest du «hairtuning»?», Karwans Hairtuning shown.
  - «تاکلاینن» and «hewlr» are corrected and show Taakline.
  - «taaklin» is found directly as a prefix, with no correction.
  - «qxzvwplk» gets no suggestion.
  - «کارواان» gets no suggestion, correctly: the live record has no Sorani name. Adding names in all languages to listings improves discovery more than any correction can.
- Next safe continuation point (owner's order): holiday/temporary closures (schema) → Lighthouse → Jobs launch → search analytics.

## Phase 3 — public holidays, temporary closures and special hours — 2026-10-29

Owner brief "REGA24 Phase 3". Audit:
- Before this change, `Location.openingHours` held weekly hours only; `openStatus`/`isOpenNow` knew OPEN/CLOSING_SOON/OPENS_SOON/CLOSED/HOURS_UNKNOWN.
- Holidays, closures and date-based hours did not exist.
- Saving the business form fully replaces `openingHours`.

Design: **no schema change, no migration**. The optional keys `holidays: "closed"` and `exceptions: [{ from, to, hours: "closed" | ranges, reason? }]` live in the same JSON. Old readers (`hoursRows`, `hasHours`) ignore them. One system for every category.

- `src/lib/holidays.ts`:
  - DE: 9 nationwide holidays plus state holidays that apply to a whole state, with Easter computed. Municipality-only holidays are left out.
  - IQ: the 7 fixed-date holidays of the 2024 official holidays law (verified via Wikipedia/Shafaq: 1 Jan, 6 Jan, 21 Mar, 1 May, 3 Oct, 10 Dec, 25 Dec).
  - Islamic lunar holidays are announced yearly and **not computed**; owners enter them as exceptions.
  - No Kurdistan-Region-only holiday is assumed (no verified list).
  - Names in 7 locales.
- `src/lib/opening-hours.ts`: `parseHoursExceptions` validation (real dates, `to` ≥ `from`, ≤ 366 days, readable hours, one-line reason ≤ 120 characters, ≤ 30 entries), tolerant readers, `composeOpeningHours`.
- `src/lib/geo.ts`: `openStatus` is date-based.
  - Rule order per date: exception (the shortest matching range wins), then holiday if `holidays: "closed"`, then weekday hours.
  - Looks back 1 day and ahead 45 days. Overnight ranges belong to their start date.
  - New status TEMPORARILY_CLOSED. Results also carry the holiday, the exception and `next.date`.
  - `isOpenNow` is derived from it, so search open-now and Nearby follow closures and holidays. Both pass the region (state) slug.
- UI:
  - Owner/staff form: `HoursExceptionsEditor` with a holiday checkbox and closure / special-hours rows, sent as one validated JSON field, always round-tripped.
  - Business page: shows a location even when it has only closures or the holiday setting. Lists upcoming changes in the location's calendar.
  - `OpenState`: temporary closure with reopening date, holiday and special-hours notes, reason in `<bdi>`.
  - 19 messages × 7 locales.
- Tests:
  - `tests/holidays-closures.test.ts` covers Easter/state holidays, Iraq dates, validation, closures, special/overnight hours, holiday closing, timezones/DST and status vs isOpenNow agreement.
  - Updated `open-status` expectations to include `next.date`.
  - New E2E test in `completion.spec.ts`.
- Caught locally: the German hint word "Bundesland" collided with the `getByLabel("Land")` lookup in an existing E2E test. Reworded; all 25 E2E label lookups checked against the new texts.
- Local verification:
  - `npm test`: 377 tests, 373 pass, 0 fail, 4 DB-only skips. `test:d1` 10/10. Typecheck and lint pass.
  - E2E on a disposable D1 (`build:node`), 10 spec files that use the business form, hours, nearby or profile: 96 passed on desktop and mobile, including the new test.
  - The 8 iPhone/WebKit cases could not start because WebKit is not installed in this container (environment limit); CI installs it.
- Release: PR #92 squash `846a18b`. PR CI `verify` passed, including the iPhone/WebKit E2E that this container cannot run. Exact-main CI 40802502526, Deploy 40806219013, Beta health 40806219024 and Production browser check 40806341935 all succeeded.
  - Live checks at 02:34 UTC: `/api/health` ok, provider d1. `/ckb`, `/ckb/businesses`, `/ckb/nearby`, `/en/ai` and open-now search return 200.
  - Playwright: taakline (IQ, Thursday 05:34) shows «داخراوە · دەکرێتەوە لە 11:00»; karwans-hairtuning (DE) shows «Geschlossen · Öffnet Samstag um 09:00». Both match the stored hours and local time. No holiday note, correctly: 29 October is not a holiday.
  - No production data was changed; existing listings have no exceptions yet.
- Remaining:
  - Islamic holidays must be entered per business as dates.
  - Kurdistan-Region-only holidays are not modelled (no verified list).
  - No Lighthouse measurement yet.
- Next safe continuation point (owner order): Lighthouse → Jobs launch → search analytics.

## Global expansion — 11 interface languages, 13 European target markets — 2026-10-29 (PR #93)

Owner brief "REGA24 global expansion & international experience". Identity guard OK (REGA, branch `claude/rega24-global-expansion-dc071c`).
Audit (read-only, production D1 `728f792d…`): 6 of 13 target countries existed (DE, FR, SE, NL, GB, AT) + IQ; missing BE, CH, GR,
NO, DK, FI, IT. Locales: 7 (ckb, kmr, de, en, ar, fa, tr); fr, sv, nl, it missing. Non-German countries showed an empty default
city list in the location selector, and the language switcher dropped the query string (search/filters/country/city).

Changes (no schema, route or design-token change):
- `src/config/locales.ts`: fr, sv, nl, it (LTR) registered once; full catalogues (all keys, placeholder/tag parity tested);
  glossary, AI system prompts, beta copy, holiday names (#92) in the new languages. Native labels per brief: «کوردیی سۆرانی»,
  «Kurmancî». "Seven languages" copy changed to eleven in every catalogue. Legal pages of the new locales keep the English
  fallback that points to the binding German text (no unreviewed legal translation).
- Language switcher: 11 entries (scrollable), keeps the page and its query.
- Seed: the 7 missing countries, each with capital region + capital (Brussels, Bern, Athens, Oslo, Copenhagen, Helsinki, Rome),
  names in the 7 column languages. `prisma/d1/data/20261029_europe_target_countries.sql`: insert-only, idempotent, documented
  undo; rehearsed on SQLite built from the D1 migrations (+7/+7/+14/+7, rerun no-op, FK clean, undo restores counts).
- `MARKET_COUNTRY_CODES` (src/lib/data/markets.ts): selector and directory filter always offer the 13 markets; country names
  from stored column or CLDR `Intl.DisplayNames`, with flag. Each market's seeded city is in `MAJOR_CITY_SLUGS`.
- Sitemap CHUNK 2,000 → 1,000 (11 locales keep the earlier per-file size).
- Names of categories/cities/businesses in fr/sv/nl/it fall back to English (public reads use legacy columns only); adding
  translated names in the admin panel is the owner's data step.

Tests: lint, typecheck; `npm test` 383 tests, 379 pass, 0 fail, 4 DB-only skips (incl. 143 language × country combinations).
Local Playwright on disposable D1 (desktop + mobile, before merging #92): 403/403 pass, incl. `international.spec.ts` (143 HTTP
combinations, 13 interactive locale/country runs, the owner's three examples, profile language switch). Six existing specs
used `getByLabel("Land")`, which now also matches «Nederlands»; they select `select[name="countryCode"]` instead.

Release (2026-10-29): PR #93 squash `8848488`. Main CI 40814940547, Deploy 40818252784 (finished 04:34Z) and Beta health
40818252655 succeeded. Production browser check 40818337689 failed once on one check (desktop `/de/services` client error page) —
it started at 04:32:40, before the deploy finished; not reproducible afterwards (11 locales x 3 HTTP, 25 browser loads, 0 errors);
the re-run succeeded at 04:45Z.

Production data: APPLIED after the owner's explicit approval («APPROVED — REGA24 PRODUCTION D1 UPDATE», then «Allow»).
Restore point (D1 Time Travel) 2026-10-29T04:22:16Z; read-only logical export of Country/Region/RegionTranslation and Business/Location
ids taken first. Country 7→14, Region 28→35, RegionTranslation 91→105, City 2058→2065; pre-existing City fingerprint, regions,
region names, Business 3, Location 3, User 3 unchanged; FK violations 0; slugs unique; a second run of the city statement changed 0.
All 13 target countries have an active city. Undo: the commented statements in the SQL file header.
Live check 04:35–04:45Z (read-only, Chromium desktop + mobile): 23/23 PASS — 143/143 language × country pages, hreflang 11 + x-default,
sitemap, 13 countries + a default city each in the selector API, 11-language switcher keeping page + query, RTL, profile, no errors.
Evidence: [docs/evidence/global-expansion-production-2026-10-29.json](docs/evidence/global-expansion-production-2026-10-29.json).
Not measured: Lighthouse, field INP, full WCAG audit, WebKit against production.
Next safe continuation point: translated names (fr/sv/nl/it) for categories and cities need admin-form fields and public reads of the
translation rows (separate task); more cities per new market only from verified sources.

## Phase 4 — Lighthouse audit and production optimization — 2026-10-29 (PR #95, squash `c751e6b`)

Owner brief "REGA24 Phase 4". Identity guard OK (REGA, `www.rega24.com`, Worker `rega24`) before merge.
Measurement: local Lighthouse 12 (simulated throttling) against production. The PageSpeed Insights API quota was exhausted,
so no PSI/CrUX field data. Requests left this container through a US edge (colo EWR), far from D1 (EEUR). Mobile Performance
varies ±5–10 between identical runs (e.g. `/ckb` 82 then 94, 93); compare trends, not single points.

Root causes found (baseline before #95):
- Uncached TTFB 0.7–3.7 s: the Worker ran at the visitor's edge and paid one transatlantic round trip per D1 query.
- Business-profile LCP 5.3–7.2 s on mobile: full-size original images (398 KB PNG, 211/166 KB JPG), no resized variants.
- Accessibility 96 on profiles: `Chip` text muted on surface-2 = 4.44:1 (< 4.5:1).
- SEO 92 on `/en`: Lighthouse `link-text` failure on "See more".
- `/ckb/nearby` TBT 8–9 s mobile, 2.2–2.5 s desktop: the map-first intro (shown before a location is known) loads and runs
  MapLibre (chunk `ca4dcb09…`) at once; headless Lighthouse renders WebGL in software, so real devices pay less (assumption).
- `/ckb/services` desktop CLS 0.086: the streamed results replace `GridSkeleton` with the shorter `NoResults` (0 services).

Changes (#95; no schema, data, route, colour or layout change):
- `wrangler.jsonc`: `"placement": { "mode": "smart" }`. Rollback: remove the block and deploy.
- Business profile: `preload(gallery[0], { as: "image", fetchPriority: "high" })` (verified live on karwans-hairtuning).
- `Chip`: `text-ink` instead of `text-muted`.
- Home: visually hidden context after "View all" / "See more" (`sr-only`).

Release: PR CI `verify` passed. Exact-main CI 40822589404, Deploy 40826355998 and Beta health 40826356070 succeeded; Production
browser check 40826458231 succeeded. New link text live from 05:59:43 UTC.

Lighthouse after (production, 06:00–06:25 UTC), Perf / A11y / BP / SEO, before → after:

| Page | Mobile before | Mobile after | Desktop before | Desktop after |
|---|---|---|---|---|
| /ckb | 93/100/100/100 | 82–94/100/100/100 | 98/100/100/100 | 99/100/100/100 |
| /en | 99/100/100/92 | 92–93/100/100/100 | 99/100/100/92 | 100/100/100/100 |
| /ar | 92/100/100/100 | 96/100/100/100 | 99/100/100/100 | 99/100/100/100 |
| /ckb/businesses | 93/100/100/100 | 94/100/100/100 | 100/100/100/100 | 100/100/100/100 |
| /ckb/business/taakline | 69/96/100/100 | 74/100/100/100 | 97/96/100/100 | 96/100/100/100 |
| /de/business/karwans-hairtuning | 66/96/100/100 | 65/100/100/100 | 91/96/100/100 | 95/100/100/100 |
| /ckb/search?q=… | 77/100/100/69 | 75/100/100/69 | 97/100/100/69 | 98/100/100/69 |
| /ckb/nearby | 59/100/100/100 | 62/100/100/100 | 62/100/100/100 | 63/100/100/100 |
| /ckb/services | 73/100/100/69 | 92/100/100/69 | 96/100/100/69 | 98/100/100/69 |

Locale homes, mobile after: kmr 96, de 93, fa 92, tr 91, fr 90, sv 93, nl 92, it 94 (A11y/BP/SEO 100 everywhere). Before:
kmr 87, de 91, fa 92, tr 88; fr 79, sv 84, nl 93, it 96 (measured after #93 went live).
Server response time (TTFB) after: 0.3–0.9 s on most pages (before 0.4–1.8 s); one outlier 1.4 s on mobile `/ckb/services`.
`/en` mobile 99 → 92–93: same bytes (Document +2 KB from #93), LCP element unchanged (hero AVIF). The simulated
load delay of the hero image was 0.56 s in the baseline run and 1.3 s after; this is not traced to #95.

Not 100/100 (honest status): Accessibility and Best Practices are 100 on every measured page. SEO is 100 except search and
services (69, deliberate `noindex`: search results, and services while 0 are published). Performance is not 100 on mobile.
Remaining corrective actions, each needs an owner decision:
1. Business images: upload-time resized variants (e.g. 640/1280 WebP) plus a backfill of existing originals in R2.
2. Nearby: defer MapLibre in the pre-location intro (e.g. static preview until interaction). This changes the visible intro.
3. Services: a `NoResults` block with the skeleton's height, or a shorter skeleton (visual change).
4. Framework JS (~51 KB unused, ~12 KB legacy polyfills) and bf-cache blocked by deliberate `no-store` are not changed.
Next safe continuation point (owner order): Jobs launch → search analytics; or one of the corrective actions above.

## Official vivid red standardization — 2026-10-29 (candidate)

Owner scope: colors only; no rebuild/redesign, logo edits, production data changes or paid services. Baseline main `311c9d7`.
Sampled owner attachment `2-Photo-2.jpg` at (386,88): RGB (250,7,13), canonical `--brand: #fa070d`.
Unified global/dark/home tokens, Tailwind v4 theme aliases, link/hover/focus/selected/native-control colors and map paints;
solid red actions use black labels for AA, text on light surfaces uses an accessible darker red derivative. Official logo
files and their asset-matching backing are preserved. Details: [brand colors](docs/BRAND-COLORS.md).

Initial local verification: typecheck/lint pass; unit 379 pass, 4 DB-only skips, 0 failures; D1 10/10 + batch splitting pass;
npm audit 0 vulnerabilities; documentation validation passes. Standard Node build is blocked by the environment's Google
Fonts network restriction. A test-only local Noto Sans Arabic response from Fontsource permits the Node build; no font
source, dependency or production configuration changes are committed. Browser/final release verification is ongoing.
New regression covers actual rendered color ratios and axe brand contrast, RTL/LTR, light/dark and 390/1366px.

Read central Doc and verified remote main and Cloudflare: `rega24` deployment `2323ffab-d956-4b04-bca0-23b3ad3bfb68`,
version `373658b2-471c-4073-89fb-ae1b22587f63` at 100% (pre-change baseline). CLI GitHub authentication fails but the connected
GitHub tool confirms access to this exact repository. Follow the existing PR/full-CI/exact-main deployment workflow;
no direct production publish or database operation is authorized by this color task. Release results must be recorded
before claiming completion.

Candidate validation update (PR #99): final Node test build passes with the local-font transport noted above. Existing
browser suites: 64 passed (public a11y, navigation, profiles, language switching); corrected new brand regression: 8/8
passed, including desktop/mobile, light/dark, RTL/LTR, action/link/soft/focus/control/thumb ratios and brand axe contrast.
The first eight brand cases failed because the test assumed a home-only wrapper existed on registration; repaired the
test and reran all eight successfully. No application defect was hidden. Native control color also explicitly preserves
white-thumb contrast. Visual baseline/candidate: 18/18 identical measured geometry and typography after matching test-only
social configuration; asynchronous MapLibre internals excluded. Screenshots inspected; official artwork unchanged.
Evidence: [local color QA](docs/evidence/brand-colors-2026-10-29.json). Extended the existing read-only production browser
checker to assert the served primary against the checked-out CSS token, including scoped home surfaces. No workflow
or deployment mechanism changed. Final hosted CI and production verification remain pending.

## Digital Operations Center — ten read-only inspection agents — 2026-10-29 (branch `claude/rega24-operations-system-nj72x0`)

Owner brief "REGA24 Autonomous Digital Operations System" (zero additional cost, no paid services, no data destruction, no
public AI activation). Identity guard OK (REGA). Read CLAUDE.md, AGENTS.md, this file, system map/runbook and the central Doc
(no earlier operations-center work recorded).

Audit (read-only): production database is D1 `728f792d…` (36 tables; Business 3, Category 19, City 2065, AuditLog 83,
Setting 0, Page/Listing 0). `public.aiSearch` is ENABLED in production (rollout 100, set earlier by the owner through
`/dr/ai`; audit rows `featureflag.update`). It was NOT changed: switching public visibility is owner-only. The new AI agent
reports it as a warning together with the configured provider keys (booleans only).

Built (no schema, migration, binding, cron, queue, Worker, dependency or paid service):
- `/dr/operations` (owner only): new permission `operations.manage`, SUPER_ADMIN only (ADMIN excluded); SUPER_ADMIN is honoured
  only for `rebar9988@gmail.com` (`effectiveRole`). Nav item in the "system" group; page and both server actions check the
  permission before reading or running anything.
- Engine `src/lib/ops/core.ts` (pure): execution-id idempotency, 100 runs/UTC day, throttled cool-down from 80 runs
  (60 s → 15 min), per-agent lock (`Setting` `ops.lock.<agent>`, 2 min TTL, atomic primary key), 25 s timeout with abort,
  one retry (not for timeouts), fail-closed BLOCKED when D1 is unavailable, no report text from error messages.
- Ten agents (`src/lib/ops/agents.ts` collectors + `src/lib/ops/analyzers/*` pure rules): business (queue, stale, required
  info, probable duplicates, category, country/city, coordinates, links — never approves/rejects), security (owner allowlist,
  stored SUPER_ADMIN rows, AUTH_SECRET length only, failed sign-ins 24 h as counts, live security headers, anonymous `/dr`
  and API separation; repo secret scan in CI), QA (12 bounded live routes, lang/dir per locale, hreflang, slug integrity),
  performance (Worker-side TTFB/HTML size/scripts; Lighthouse and field CWV reported as not measured), category, location,
  translation (all 11 registered locales), content, privacy-safe analytics (aggregates only; zero-result searches are not
  tracked and no tracking was added), AI discovery (flag/default, published-only filter, deterministic retrieval tests,
  stored-answer links; never calls a model).
- Reports = `AuditLog` rows `action=ops.report`, `entity=ops:<agent>`, `after` = report (owner's JSON shape, Sorani summary).
- HTTP probes: canonical origin only in production; `OPS_PROBE_ORIGIN` (loopback only, ignored when APP_ENV=production) lets
  E2E probe the local test server. User agent `REGA24-Operations-Inspector/1.0`; no cookies; redirects not followed.
- Scheduled mode OFF on purpose: Cloudflare account usage/billing is not readable from here, so no cron is added.
  Repository-side checks run in the existing `npm test` (CI) step: `tests/ops-repository.test.ts` (tracked-file secret scan)
  and the translation analyzer over the real catalogues.
- UI chrome in all 11 catalogues (`ops.*`, `dashboard.operations`); findings/summaries in Sorani (`lang="ckb" dir="rtl"`).
  Existing dashboard tokens, pills and icon family only (one Lucide "activity" path added).

Cost reasoning (REPORTED, not a billing proof): the Worker bundle exceeds the free-plan size, so the account is very likely on
Workers Paid with included quotas; the engine's hard caps (≤100 runs/day, ≤12 probes and ≤~5k rows read per run, 3 D1 writes
per run) are orders of magnitude below them. Account-wide usage was not readable; no billing or plan was touched.

Local verification (this session, branch head before PR): lint, typecheck PASS; `npm test` 420 tests, 416 pass, 0 fail,
4 DB-only skips (37 new ops tests); docs validator and `git diff --check` PASS. Full Playwright suite on disposable D1
(desktop + mobile): 407/407 PASS, incl. new `tests/e2e/operations.spec.ts` (anonymous → sign-in form; EMPLOYEE → no access;
owner runs one agent, gets a cool-down BLOCKED on an immediate repeat, runs all ten; Business/Category/City/flag snapshot
unchanged; one AuditLog report per run; no lock left). After final probe changes: operations+auth+security specs 17/17,
`test:d1` 10/10, Worker build + `wrangler deploy --dry-run` (4707.77 KiB gzip), workerd smoke with D1 and the D1 binding smoke
PASS. `probe()` executed inside workerd with the production compatibility date/flags (GET, HEAD, manual redirect, budget, UA,
no cookie). Not run here: PostgreSQL Worker smoke (no local Postgres; CI runs it), WebKit/iPhone project.
Two false positives found by running the agents on the seeded database and fixed before commit: hreflang check was
case-sensitive (React emits `hrefLang`, confirmed on live `/ckb`), and the AI message wrongly said "production" everywhere.

## Official-red closure — 2026-10-29 (owner continuation; colors only)

PR #99 previously released `b3ac504`; final-head CI 40847220764, exact-main CI 40852835339, deploy 40858345557,
post-deploy health 40858345472 attempt 2 and production browser 40858943890 all passed. Its live log recorded 36 successful
primary-red assertions. This closes the historical pending wording in the earlier candidate checkpoint; the shared Doc
already contained the final release. Current baseline for this continuation is `ec162ff` (unrelated operations release).
Read-only Cloudflare verification found that exact source tag at 100% on version `14592e63-ad3f-4cd4-a500-81d88935ef6a`.

Owner asked to finish remaining color work. Two genuine omissions were found: the shared danger-menu class is a `.ts`
string (`text-brand`, not covered by the earlier TSX migration), and the standalone offline HTML retained two old OKLCH
primary colors. Correct only these colors: existing `text-brand-text` for danger labels; canonical primary/derived hover
and black action labels offline, preserving all layout/text/logo markup. Refresh the existing static-cache version so
installed browsers receive the updated offline page. No cache strategy, business action, role, schema, record, dependency,
workflow or unrelated feature change. The separate held security/data work is not included or released by this branch.

Real Chromium + actual compiled CSS reproduced all 24 danger-menu default/hover/focus cases below 4.5 (minimum 3.72).
The extended application regression failed before the fix at 4.116838270266513; after the fix all 24 state cases pass,
minimum 5.67. Local typecheck/lint, 416 unit passes (4 DB-only skips), 10 D1 tests, 6 PWA unit tests, audit 0 vulnerabilities,
19 targeted brand/publication/operations browsers and 11 standalone-offline/PWA browsers pass. The eight offline cases
include light/dark, RTL/LTR, 390/1366 px, primary parity, actual hover/focus contrast and axe (zero violations).
Offline baseline/candidate geometry and typography match in 8/8 cases; screenshot inspected. Local Node build uses the
previous test-only Noto transport because of the executor's font-network restriction; no font changes are committed.
Evidence: [color closure QA](docs/evidence/brand-colors-closure-2026-10-29.json). Hosted final-head/main CI, existing deploy
and fresh production color verification must pass before marking this follow-up released.

## Figma implementation candidate — 2026-10-30

Owner directive: implement `enQ8cs8Yd2xxZ5bajyk6rI` in the existing Next.js app, consistent mobile/desktop, official ڕێگا REGA24 lockup, preserve all functional/data/security layers and spend no additional money. Identity guard passes on `codex/rega24-figma-implementation`, based on main `b36703f`; no R&L crossover.

Official Figma MCP session `c7a5e263-a842-404a-80a8-32b411010efc` read the file metadata, high-fidelity context and reference screenshots: home `3:2`/`3:94`; foundations `22:2`; directory `22:46`/`22:80`; detail `22:104`/`22:116`; owner dashboard `22:128`/`22:144`; add-business `22:160`/`22:180`; handoff `28:2`. These frames contain text, primitives and dynamic-media placeholders, not an original logo image. The handoff explicitly directs reuse of approved repository artwork.

Implementation: editorial white hero with existing working search/city selector; 12-category grid; responsive home/directory cards; actual owner registration CTA, actual counts and city links; existing AI/map/social functions retained below the design band. Profile media/info reflows into two desktop columns and one mobile column. Owner account exposes existing listings/pending/profile/sign-out actions as four responsive tiles, rather than inventing settings or request backends. Existing business wizard is retained with an 800px single-column visual shell; no action/validation/autosave/upload changes. Global light neutrals and the already-installed Vazirmatn replace the older home-specific Noto face. No dependency added; removing the obsolete next/font import also removes its external build-time font download.

Current Figma foundations primary `#db0512` supersedes the earlier sampled `#fa070d` per the owner's source-of-truth directive. White action ink passes the actual contrast regression; the home frame's `#db0514` is standardized to the shared foundation red. Original artwork is not recolored. Updated brand/metadata/manifest/offline references use Rega24 and preserve canonical URLs. Official logo derivatives and social/icon assets are reused byte-identically from this repository's prior owner-artwork PR101 head `a0e9ad0ca778effe31f7284dee9cbb130cca06c8`; none of its application changes or unrelated PRs are merged. Header/footer/auth/admin share Logo/LogoMark. Footer keeps its 32px mark and legal/navigation links. Service-worker static cache is refreshed for the new offline artwork, without changing cache policy.

Verification checkpoint (not a final-head release certificate): 416 unit passes, 4 existing DB-only skips, 0 failures after correcting one shortened Persian SEO description; native D1 10/10 and batch preservation pass; Node build, lint, TypeScript, docs validation and npm audit (0 vulnerabilities) passed on the preceding candidate. An earlier public browser batch had 77 passes and one real footer-size failure; compact logo was repaired without weakening that assertion. The corrected 94-case public/color/locale/PWA browser batch is running, including 88 persisted home screenshots (11 locales × 8 widths), home axe and eight light/dark/direction brand combinations. Account/form changes still require their final build and authenticated browser checks. A simultaneous typecheck/build briefly raced generated .next types; sequential typecheck passed; do not modify tsconfig or suppress diagnostics to hide that environment race.

Production remains untouched by this task. Earlier read-only Cloudflare baseline: Worker `rega24`, deployment `8f81131b-9128-428d-8a2e-591ba342fdaa`, version `14592e63-ad3f-4cd4-a500-81d88935ef6a` at 100%; this must be rechecked before release. No schema, migrations, production data, authorization, dependencies or CI/deployment workflow changes. Existing PR71 security/data release hold is separate and is not released here. Final exact-head CI, local authenticated checks, visual review, Lighthouse and exact-main deployment/live verification are still required. No 100/100 quality or deployment is claimed. No paid service/plan was activated; billing totals are not independently observed. Continue on this branch; finish actual checks, update PR/central Hub with exact results, and release only through the existing gates.

Figma QA continuation: corrected public batch is 94/94 PASS (including all 88 screenshot/locale-width combinations, all eight actual brand contrast cases and eight standalone offline cases). Exact application head `6cd40d5` builds successfully. Authenticated local batch: 30 passes and one intermittent upload case; the unchanged isolated upload case then passed (24.8s), so no deterministic application defect is demonstrated. Its stale-page setup opened a second active tab and never returned to the editing tab; the test now explicitly brings the editing tab to front, retaining the stale tab and every upload/permission/preview/approval/autosave assertion and timeout. Chromium background canvas encoding is a plausible cause, not independently established. A new real owner-account test passed (navigation, pending filter, four viewport screenshots, axe, sign-out and account retention). No app code changes follow `6cd40d5`; final test-only head/full CI remain mandatory. Cloudflare Billing Read returned 403 (OAuth scope unavailable), so no invoice-total/remaining-quota claim is possible; no paid resource or plan was activated.

Final in-scope accessibility review adds a 2px canonical focus ring around the stretched home profile link's whole card. The old link suppresses its own outline and the low-opacity card border alone is insufficiently distinct. The eleven-locale browser matrix now explicitly checks the rendered focus indicator. This source change requires a new exact-head CI; do not merge using the preceding head's results. No security/data/workflow changes.

## REGA24 official logo integration — 2026-10-29 (branch `claude/rega24-logo-integration-4hkyk0`)
Task: integrate the owner-supplied REGA24 master logo unmodified as a square badge (header desktop/mobile, footer, /dr
admin, auth/login/register, favicon, apple-touch, PWA any+maskable, OG image, offline/splash page, JSON-LD logo).
Identity guard: `--project REGA --domain www.rega24.com` OK. The design spec `claude/rega24-official-logo-integration-spec.md`
(Design Studio project) was not reachable from this session (environment limitation); the prompt's spec points were followed
and the file-size budgets in `tests/logo-assets.test.ts` are this session's own (REPORTED, not from the spec).
Change: master stored byte-identical at `docs/brand/rega24-official-logo-master.png` (sha256 pinned in the test);
`scripts/generate-rega24-logo-assets.py` resizes it (no crop/recolour/retouch); square and 1200x630 formats keep the full
portrait frame and fill the margins from the master's own softened edge pixels. One component, `LogoBadge`
(`src/components/ui/Logo.tsx`): WebP srcset + PNG fallback, explicit width/height, 1px `border-line` + `shadow-card`.
`Logo`/`LogoMark` removed; footer wordmark image removed (badge carries the name). Link names are now the visible text
"REGA24" (alt); auth marks are decorative (`alt=""`). Service-worker cache bumped to v3 to precache the new offline mark.
Not changed: home hero lockup (`rega-lockup-*`, not in the requested placements), `EmptyState` search icon (semantic icon;
needs spec confirmation), old `rega-mark/logo/wordmark` files left in `public/brand` (no deletion). No colours/tokens changed.
Known trade-off: the master is portrait 9:16 with the wordmark below, so at 16-32 px the wordmark is not legible.
Tests: unit 383/383 pass; typecheck, lint, docs validation pass. Local browser (next dev, no DB): /en/login, /ckb/login,
/en/auth in light+dark, RTL+LTR, 1280+390 px — all badges load, correct alt, CLS 0 / <0.002 (font swap). /dr not rendered
locally (needs DB/auth). Hosted CI, deploy and live verification: pending; record results before claiming them.
Next safe continuation point: review PR, confirm spec items above, merge through the normal CI-gated path.

Update 2026-10-30: PR #105 (merged to `main` first) adopted this PR's generated badge/icon/OG files (byte-identical) and
its own owner-approved lockup (`LogoMark` + ڕێگا/REGA24 text). Merge resolution keeps `main`'s component, header, footer,
auth, /dr, offline and service-worker versions unchanged. This PR now only adds: the pinned master, the generator script,
the new 16/32/48 `favicon.ico` (main still served the old REGA favicon), maskable 192/512 PWA icons in the manifest,
the favicon in page metadata, and `tests/logo-assets.test.ts` (adapted to `LogoMark`).

## Owner reference homepage (REGA24 desktop + mobile image) — 2026-10-30 (branch `claude/rega24-reference-homepage`)

Owner directive (zero cost, no Figma MCP — the Figma Starter/View seat hit its 20 calls/month limit before any design was built; empty
file `oH5oOuppWrMIIoy2gDw3bz` left untouched): implement the attached REGA24 desktop/mobile reference image in the existing app,
official logo kept (existing `LogoMark` badge from the pinned master; header/footer/bottom bar unchanged). Identity guard OK (REGA,
www.rega24.com), based on main `5caee06`. Explicit owner instruction for this visual change (overrides the design freeze for the home body only).

Home body rebuilt with the existing tokens (red `#db0512`, white, Vazirmatn), logical RTL/LTR geometry: hero with inline-SVG world
artwork (globe, red connection lines, generic skyline — no photo, no landmark, no network request), headline + Iraq/Europe/worldwide lead,
white search card (same `form[role=search]`, `q`, `CityFilter`/`#f-city-search`), four quick-link chips; trust strip (reviewed listings,
11 languages, worldwide, free — all true); main-category grid (4/5/6/10 columns); business cards (cover or own logo, verified mark only
when `verified`, rating only with real reviews, red "view profile"); two banners (add business → /for-business, global → /businesses);
real figures only (published businesses, locations, 11 languages, root categories, 100 % free); popular cities Erbil, Sulaymaniyah,
Duhok, Baghdad, Berlin, Köln, Hamburg, München via new read-only `listCitiesBySlug` (real counts). AI entry, nearby list/map and social
section unchanged. 27 new `home.*` keys + `communityLead` in all 11 catalogues. No schema, migration, data, auth, workflow or dependency change.

Deliberate deviations from the reference: no city photographs or stock business photos (none owned; no fake media); no favourites heart
(feature does not exist); no App Store/Google Play badges (no native apps); hero art is an original illustration instead of a photo.

Local verification (npm registry unreachable from this sandbox, so no `npm ci`): unit tests i18n/glossary/international/selector-cities
16/16 pass with the global tsx; static render of the real page components (stubbed data/i18n, real CSS) screenshotted in Chromium at
1440/768/390 px, ckb + en: no horizontal overflow in the new sections; tablet hero fixed (side-by-side layout only ≥1024 px).
Typecheck, lint, build and Playwright run in hosted CI only. Next: PR → full CI → merge → existing deploy → production browser screenshots.
CI run 41067658630 (head `b9fb362`): lint, typecheck, unit, D1, Node build PASS; Playwright 445 passed, 1 failed — de home overflowed
23 px at narrow widths: the long compound "Behördenangelegenheiten" widened its category tile (`overflow-wrap: break-word` does not
reduce min-content). Fix: grid items `min-width: 0`, label `overflow-wrap: anywhere` + `hyphens: auto`, 12 px label below 400 px.
Local re-check of all 11 locales at 320–1024 px: no overflow from the new sections.
