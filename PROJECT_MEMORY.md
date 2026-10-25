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
- PROJECT A — REGA Platform: repository `rebar9988-max/Rega`, production `https://www.regaplatform.com`, Workers `rega-platform` / `rega-ai-python`. **This repository.**
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

## Business profile + owner social accounts — 2026-10-25 (PR #71, not deployed)

- Identity verified: `rebar9988-max/Rega`, canonical `www.rega24.com`, Worker `rega-platform`; guard passes.
  Base `e8e2b69`; source commit `7a9da31`, branch `feat/business-social-profile-20261025`.
  Cloudflare readback confirmed canonical domains on this Worker; deployment `5d6f039c-01b9-4384-8bde-6a6da9daaf54`
  used version `79627fce-fc09-4df7-9094-3e8c401f2b6a` at 100%. This task has NOT deployed a version.
- Figma session read frames `22:104` (desktop detail), `22:116` (mobile detail), `22:160` (Add Business).
  Adapted to existing tokens/primitives: same profile route, one BusinessForm for Add/Edit, existing gallery/media,
  owner guards, Call/Directions/Share, About and services. With real gallery media the desktop hero uses two columns;
  mobile wraps the same content. Social precedes About/Services; offers follow services. No homepage/admin/nav redesign.
- Schema audit found no equivalent social fields. Model/table `Business`, primary key `id` (cuid); owner access is
  active `BusinessMember(userId,businessId,isActive)` (staff keep existing global access), creator marker `createdById`.
  Frontend -> form action/REST -> DB use the SAME four names: `facebookUrl`, `instagramUrl`, `tiktokUrl`, `snapchatUrl`.
  Additive migration `20261024220000_business_social_links` adds four nullable TEXT columns using existing camelCase
  conventions. Empty/null removes; omitted PATCH/form fields preserve existing accounts. No production migration run.
- Shared pure `business-social.ts` validator + shared Zod schemas: HTTPS, exact approved hosts, bounded 500 characters,
  no userinfo/lookalike/redirect/content-only paths, account identity retained; tracking query/hash removed (Facebook
  profile.php keeps numeric id). Four authentic icons reuse existing simple-icons. Optional compact fields preserve
  failed submitted input; public server-rendered section hides missing platforms and disappears entirely when empty.
  Safe external attributes, localized accessible names, seven locales; same valid URLs in JSON-LD sameAs.
- Local final validation: lint/typecheck pass; 349/349 unit/integration tests pass, zero skipped. Integration applies all
  14 baseline migrations to an isolated local DB, inserts existing business/owner/membership, applies the new migration,
  proves every old column and owner relationship unchanged, then CREATE zero/one/four, READ/reload, replace/partial
  UPDATE and REMOVE one/all. Separate browser API tests prove owner access, stranger403 and anonymous401.
- Final focused browser run: 13/13 PASS, zero failures/skips/retries (desktop profile/gallery/social + touch social).
  All nine requested widths (320/360/375/390/430/768/1024/1440/1920) in Sorani RTL and English LTR; real LOCAL test
  cover/logo uploaded through the existing editor; exact links, icons, tap dimensions, focus, empty hiding and input
  retention verified. Earlier runs exposed a removed phone display (restored before final build) and a test that typed
  during an unfinished save response (now waits for Save enabled, retaining exact persistence assertions).
- Normal local build is blocked fetching Google Fonts (proxy403). Local Node/OpenNext builds use a TEST-ONLY
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES backed by genuine npm Noto Sans Arabic files; no source/dependency/font change.
  Both builds PASS, Wrangler dry-run PASS (3593.25 KiB gzip), actual local Worker DB/auth/routes/validation smoke PASS.
  Pinned Chromium download locally returns403; local browser checks use system Chromium151.0.7922.173, not pinned141.
  Hosted CI on initial source `7a9da31` (run40166399806) already passed ordinary Node build, lint/typecheck/unit/migration
  and pinned browser installation; full E2E/Worker checks were still running at this checkpoint. Final-head CI must pass.
- PR: https://github.com/rebar9988-max/Rega/pull/71 (draft). Existing separate Create Neon Branch workflow
  run40166399832 failed at Create Neon Branch; not disabled/bypassed. No migration/production workflow dispatched.
- Release blockers: no current restorable production backup verified (Neon snapshot listing returned only manual
  snap-muddy-mountain-b2f40zxu dated2026-10-02). Owner asked only for backup identifier/time, never credentials.
  Follow docs/DEPLOYMENT.md: verify backup, make migration available to the main-only DB workflow WITHOUT deploying
  code that reads new columns, apply migration first, then release application through existing CI-gated main process.
  Do not merge this feature first and race the auto-deploy against a migration. No production rows/settings/secrets,
  paid services/plans or R&L resources changed. Current official platform-documentation lookup and executor public
  www.rega24.com fetch are proxy403; live feature behavior/performance and authenticated production CRUD unverified.
- Evidence (outside repository): `/workspace/artifacts/rega-social/` (349-test log, final13 browser log/traces,
  migration proof, build/dry-run/runtime logs, eight desktop/touch Sorani/English screenshots). No 100/100 claim.
- Additional bounded QA after the clean final13: existing Add form checked at all nine widths in en/ckb (18 states),
  with no page overflow, all four URL inputs LTR, >=44px and contained in the viewport. Scoped axe WCAG2A/AA+2.1A/AA
  checked the social fieldset in all18 states and public social in en/ckb at390/1440:22 checks, zero violations and zero
  incomplete results, including contrast. Actual Tab navigation through all four public links passes. Temporary LOCAL
  fixture social values restored in finally. Evidence:extra-qa.log/extra-qa-results.json. Existing Node/proxy stopped.

## PR #71 production recovery — 2026-10-25 (release held)

- Resumed clean `2f02a44`; identity guard PASS, repo `rebar9988-max/Rega`, www.rega24.com → rega-platform.
  Production readback remains deployment5d6f039c-01b9-4384-8bde-6a6da9daaf54 / version79627fce-fc09-4df7-9094-3e8c401f2b6a at100%.
- Actual Neon production metadata: lucky-glitter-73195208 / br-floral-hall-b22rpgrw / neondb / PostgreSQL18.6.
  Read-only SQL:3 Business,3 BusinessMember,14 applied migrations,0 unfinished,0 social columns, social migration not applied,
  0 orphan memberships. Pre-migration business digest f7c15ac83f54d776dff7ed31d4e685d2; membership digest
  3d3620e17398f5ee18d8b8cfa1269af5 (no customer rows/content retained). All14 applied migrations match the baseline.
- Backup creation actually attempted through Neon create_snapshot for production: HTTP422 `snapshots limit exceeded`.
  Snapshot listing still only snap-muddy-mountain-b2f40zxu (2026-10-02). Fresh backup/isolated restore NOT VERIFIED;
  production migration/merge/deploy BLOCKED. No snapshot deleted and no plan upgraded.
- Neon Create Branch run40166824571/job121089502786: Axios HTTP422. Project free tier branch limit10, actual branches10,
  PR71 preview absent. Three existing preview PRs29/35/47 are still OPEN, so they were not treated as stale or deleted.
  Exact owner cleanup approval requested for archived temporary branches br-young-sea-b2xt4g94 (seed-validation) and
  br-aged-fog-b2e43gus (old restore rehearsal), retaining production/backups/the existing snapshot. Await reply; no deletion.
- CI40166823984 failed with332 browser passes and2 map failures (desktop/mobile nearby.spec.ts:64, selected marker vanished).
  Reproduced locally by running the original social fixture before nearby. The public social fixture remained published
  at the reference listing's coordinates; it polluted later map clustering. Fixed ONLY its test lifecycle: public-context
  work is inside try/finally; after closing it, archive/soft-delete this newly created local fixture. No map/search code,
  application behavior, assertion or timeout weakened. Diagnostic narrow run also lacked the full suite's Hamburg fixture;
  the properly composed profile/gallery/social/nearby run includes that prerequisite and passes unchanged RTL assertions.
- Fresh verification:349/349 unit/integration,0 skips; lint/typecheck PASS;37/37 composed desktop/touch browser tests PASS
  (includes the13 scoped tests plus nearby regressions). Fresh extra QA:22 scoped WCAG2/2.1A/AA axe analyses,0 violations,
  0 incomplete, including contrast; Add fields all9widths×en/ckb, public social keyboard/layout checks. No production writes.
  Local functional Node build uses the existing test-only genuine-font response due network restrictions; this is NOT proof
  of production typography. Earlier remote normal Node/OpenNext build logs on2f02a44 prove ordinary builds completed;
  final-head hosted CI and real production typography still require verification. Evidence:/workspace/artifacts/rega-social/recovery/.
- Cloudflare non-production build3dbc5197-2529-4a1c-8ada-3dceddc9a9fe: normal OpenNext build succeeded, then `npx wrangler preview`
  failed because its preview config block was missing. Identified the exact Rega repo1402276782 feature-only trigger
  9d825d1a-494d-4a62-b51c-93478f9aa285 (tag4affdd6cf1ad4d7b88690352ccea6be3, includes only this feature branch).
  Changed ONLY its deploy command through the documented trigger PATCH API to `npx wrangler deploy --dry-run` (HTTP200).
  Readback confirms it; main trigger b396f1cf-0a07-4019-ad6c-76f0a770747e stays dry-run; GitHub CI-gated production deployment
  remains unchanged. This fixes the responsible validation configuration without publishing a second production path.
  The next feature push must actually pass the rebuilt Cloudflare check; configuration readback alone is not build success.
- Security incident: the existing Cloudflare preview error log contained provider key values and the initial diagnostic
  tool output forwarded that raw log before redaction. Values are never repeated or stored here. Later diagnostics emit
  only whitelisted metadata. Runtime binding metadata confirms OPENAI_API_KEY/XAI_API_KEY are plain_text, unlike other secrets.
  Owner must rotate those two provider keys via secure provider management and update them as secret_text; no values in chat.
  Rotation NOT VERIFIED and no production key/config mutation performed. Deployment stays held pending containment.
- Live paths: executor www.rega24.com requests remain policy-blocked CONNECT403; approved connected Opera navigation was
  attempted but returned UNAUTHORIZED/requires reauthentication. Environment allow-list/TCP5432 access requested for the
  verified Neon host and HTTPS site/font/API hosts. No proxy/TLS bypass or paid browser used. Live verification NOT VERIFIED.
- Prepared a SQL-only migration stage locally, ops/pr71-migration-only commit a7d241a on verified main e8e2b69. One7-line
  migration file only; no schema/model/application changes, no push/merge/apply. Initially stale local origin/main was
  refreshed and the new staging commit rebased before this proof; the guard now passes in that worktree. docs/DEPLOYMENT.md
  describes the approved main-only workflow order; docs/BACKUP-RESTORE.md records PG18 and full quota constraints.
- Two helper-agent turns hit the session usage limit; no role approvals or reviews invented. Root completed the checks.
  PR71 remains draft. Next safe steps: obtain exact cleanup/network permissions and secure key rotation; verify a fresh
  complete backup + isolated restore, then migration-only stage/approved production migration, final green feature checks,
  merge, existing CI-gated deployment, active-version readback and real live verification. No R&L resources modified.
