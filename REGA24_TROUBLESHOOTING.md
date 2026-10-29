# REGA24 troubleshooting

Runbook for REGA Platform (`rebar9988-max/Rega`, https://www.rega24.com).

Read [REGA24_SYSTEM_MAP.md](REGA24_SYSTEM_MAP.md) first. Then [PROJECT_MEMORY.md](PROJECT_MEMORY.md) and the
[Google Doc hub](https://docs.google.com/open?id=1pp6GW-UM9AQ9TuUJHumziaujxB6ZOza5S3xwA6dmxu4) so a finished
investigation is not repeated. Architecture background: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Deploy background: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Rules for every fix:

- Follow the permanent Cloudflare platform mandate in [CLAUDE.md](CLAUDE.md): D1, Workers, R2, Cloudflare deployment, DNS and security. Diagnose and repair the responsible existing Cloudflare layer; keep recovery copies intact.
- Stay in this repository. R&L (`rebar9988-max/rega-cargo`) is a different project.
- Run `node scripts/project-identity-guard.mjs --project REGA` before a deploy, migration, or secret change.
- No production deletion, database reset, domain removal, or Worker deletion.
- Do not print secret values. Health and diagnostics already print names only.
- A docs-only commit must not be used as a pretend deploy. `workflow_dispatch` on Deploy is the manual publish.

Current database: **Cloudflare D1**, existing `rega24-migration` / `DB`; [verified cutover](docs/evidence/d1-production-cutover-2026-10-28.json). Historical PostgreSQL diagnostics below apply only to the retained recovery provider. After D1 accepts writes, do not blindly deploy a PostgreSQL-only release or replay an old import.

## Website downtime

**SYMPTOM**

`https://www.rega24.com` does not load, times out, or Cloudflare shows a 5xx page for `/` and `/ckb`.

**LOCATION**

- Edge and DNS: Cloudflare, nameservers in [REGA24_SYSTEM_MAP.md](REGA24_SYSTEM_MAP.md).
- App: Worker `rega24`, [wrangler.jsonc](wrangler.jsonc), [worker.mjs](worker.mjs).
- Process: [.github/workflows/deploy.yml](.github/workflows/deploy.yml) and [.github/workflows/ci.yml](.github/workflows/ci.yml).

**DIAGNOSTIC STEPS**

1. `GET /api/v1/health` and `GET /api/health`. A JSON body means the Worker ran. `checks.database: error` is a database problem, not a DNS problem.
2. Compare `https://rega24.com/` (expect 301) and `https://www.rega24.com/` (expect 307 to a locale).
3. Open the latest [Beta health](.github/workflows/production-health.yml) run and the latest Deploy run for `main`. A skipped deploy on a documentation commit is not an outage.
4. If the health URL is connection-refused or a Cloudflare error page with no JSON, check GitHub Deploy logs before changing DNS.
5. Do not assume the Worker version. This session had no Cloudflare dashboard. Use the manual Cloudflare diagnostics workflow if credentials are present. It lists names and deployment history, not values.

**SAFE FIX**

- If the last production deploy is the regression: roll the Worker back with `npx wrangler rollback` or redeploy the last known-good SHA. Do not delete the Worker.
- If health JSON says the database is down, use the database section. Do not roll the Worker for a database outage.
- If only one hostname fails, fix that hostname's route. Do not remove `rega24.com` or `www.rega24.com`.

**VERIFICATION**

- `/api/v1/health` returns 200 and `ok: true`.
- `/` redirects to a locale and that page returns 200.
- Beta health succeeds after the fix.

**ROLLBACK**

Redeploy a verified D1-compatible SHA that preserves the active database. Returning to a pre-D1 PostgreSQL release requires a new freeze, backup and reconciliation of D1 writes. Leave databases and domains in place.

## HTTP 4xx and 5xx

**SYMPTOM**

A specific URL returns 401, 403, 404, 429, 500, or 503. The rest of the site may be fine.

**LOCATION**

- 404 for a whole section: [src/config/sections.ts](src/config/sections.ts) and `SECTIONS_ENABLED` / `SECTIONS_DISABLED`.
- 307/308 redirects: [src/middleware.ts](src/middleware.ts) and [next.config.ts](next.config.ts).
- 503 with JSON: [src/app/api/v1/health/route.ts](src/app/api/v1/health/route.ts) when `ok` is false.
- 429: rate-limit bindings in [wrangler.jsonc](wrangler.jsonc) and [src/lib/rate-limit.ts](src/lib/rate-limit.ts).
- Dashboard HTML errors: [src/app/dr/](src/app/dr/businesses/page.tsx).

**DIAGNOSTIC STEPS**

1. Record the exact path, status, and whether the body is JSON or HTML.
2. Jobs and events are disabled in source. `/de/jobs` and `/de/events` returned 404 on 2026-10-25. That is expected until the section is enabled.
3. `/dr` returning 200 with the Sorani code form is expected for an anonymous visitor. It is not a failed redirect.
4. Health 503: read `checks` and `missingEnv` (names only).
5. Search [PROJECT_MEMORY.md](PROJECT_MEMORY.md) for the status code before changing code. Cloudflare error 1102 is already documented there and in [src/lib/db.workers.ts](src/lib/db.workers.ts) (too many Prisma clients or connections per isolate).

**SAFE FIX**

- Hidden section: set `SECTIONS_ENABLED` for that key, or change `enabled` in source and deploy through CI. Do not delete the route.
- Missing `DATABASE_URL` or `AUTH_SECRET`: set the Worker secret, then redeploy only if the runtime does not pick up secrets without a new version. `keep_vars` does not remove existing secrets.
- 429: wait for the window (login 10/60s, AI 20/60s, search 120/60s, forms 10/60s in wrangler). Do not raise limits to hide a loop.
- 500 after a deploy: roll the Worker back. Do not reset the database.

**VERIFICATION**

The same URL returns the expected status. Health stays `ok: true`. A section that must stay hidden still 404s.

**ROLLBACK**

Revert the commit and let CI deploy, or `npx wrangler rollback` if the bad version is already in production. Section flags can be restored by removing the env override.

## Cloudflare deployment failures

**SYMPTOM**

The Deploy workflow fails, a manual `wrangler deploy` fails, or production stays on the old version after a green CI run.

**LOCATION**

[.github/workflows/deploy.yml](.github/workflows/deploy.yml), [.github/workflows/ci.yml](.github/workflows/ci.yml), [wrangler.jsonc](wrangler.jsonc), [open-next.config.ts](open-next.config.ts).

**DIAGNOSTIC STEPS**

1. Confirm the failed job. CI failure never starts Deploy. Deploy's `if` requires CI `success` on `main`.
2. If Deploy is green and the log says `Skipping npx wrangler deploy`, the commit was documentation-only (`DOCS_ONLY_SKIP`). That is success, not a failed publish.
3. Credential step: missing `CLOUDFLARE_API_TOKEN` fails closed and deploys nothing.
4. Identity guard failure means the checkout does not look like REGA. Stop. Do not point the token at another account.
5. `wrangler deploy --dry-run` in CI validates the bundle without publishing. A dry-run failure is a build problem. A dry-run success does not prove the real deploy ran.
6. Python Worker failures are a different workflow: [.github/workflows/ai-python-deploy.yml](.github/workflows/ai-python-deploy.yml). It does not replace `rega-platform`.

**SAFE FIX**

- Fix the build error in git and let CI pass. Do not deploy from a laptop with a production database env mixed in.
- Token missing: an owner adds `CLOUDFLARE_API_TOKEN` in GitHub secrets. Do not paste the token into the repo, the Doc, or chat.
- Need a publish of a docs commit: run Deploy with `workflow_dispatch` on that SHA. Do not delete the skip guard to force it.
- Do not create a second Worker to "replace" `rega-platform`.

**VERIFICATION**

The Deploy log contains `Production deploy completed successfully` (not the skip line). Then `/api/v1/health` is 200. Beta health on that SHA succeeds.

**ROLLBACK**

`npx wrangler rollback` to the previous version. CI on `main` remains the normal path.

## Neon and database connection failures

**SYMPTOM**

Health `checks.database` is `error`, pages 503, Prisma cannot connect, or the Neon preview job on a pull request fails.

**LOCATION**

- Runtime: [src/lib/db.workers.ts](src/lib/db.workers.ts) and [src/lib/db.ts](src/lib/db.ts).
- Schema: [prisma/schema.prisma](prisma/schema.prisma), [prisma/migrations](prisma/migrations/migration_lock.toml).
- Production migrate: [.github/workflows/db-migrate.yml](.github/workflows/db-migrate.yml) (manual, `main` only, typed confirmations).
- Previews: [.github/workflows/neon-branch.yml](.github/workflows/neon-branch.yml), Neon project id `lucky-glitter-73195208`.
- Backup: [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md).

**DIAGNOSTIC STEPS**

1. Health JSON: `database`, `migrations`, `contentColumns`, `missingEnv`. Never print `DATABASE_URL`.
2. `migrations: false` with `database: ok` means the query worked but `_prisma_migrations` is empty or has an unfinished row. Do not run `migrate reset`.
3. Production vendor is **REPORTED** as Neon in PROJECT_MEMORY. This map's audit did not open the Neon console. Confirm the host from the dashboard before blaming Neon.
4. Hyperdrive is optional and commented out of wrangler. If a bad Hyperdrive id was added, the Worker prefers that connection string. Removing a bad binding is a config fix, not a data drop.
5. Preview branch HTTP 422 or branch-limit errors are **REPORTED** in PROJECT_MEMORY (Neon free plan limits). They are not production migrate failures. Do not raise the plan just to open a docs PR.
6. `DIRECT_DATABASE_URL` is for migrations (unpooled). The app can run on the pooled `DATABASE_URL`.

**SAFE FIX**

- Missing secret: set `DATABASE_URL` through the Worker dashboard or the manual sync workflow. Do not commit it.
- Pending additive migration: take a backup or confirm Neon point-in-time recovery, then run Database migrate with the two confirmation strings. It uses `prisma migrate deploy` only.
- Bad new migration: add a forward migration. Do not edit a migration that already ran in production.
- Preview branch failure: fix or skip the preview. Production does not read preview branches.

**VERIFICATION**

Health `database`, `migrations`, and `contentColumns` are true, and `ok` is true. `npx prisma migrate status` against a **non-production** URL says up to date before you touch production.

**ROLLBACK**

Restore into a **new** database and point `DATABASE_URL` or Hyperdrive at it only after the new database is checked ([docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md)). Do not drop the current database first. Application rollback does not undo an applied migration; old code is written to ignore additive columns.

## AI service errors

**SYMPTOM**

The assistant errors, answers with the deterministic "nothing found" path unexpectedly, or health `ai` is false / `aiProviders` is 0.

**LOCATION**

- Gateway: [src/lib/ai/gateway.ts](src/lib/ai/gateway.ts), [src/lib/ai/routing.ts](src/lib/ai/routing.ts), [src/lib/ai/runtime.ts](src/lib/ai/runtime.ts).
- HTTP: [src/app/api/v1/ai/chat/route.ts](src/app/api/v1/ai/chat/route.ts).
- Optional Python rerank: [services/ai-python/](services/ai-python/src/main.py), [docs/PYTHON-AI-ENGINE.md](docs/PYTHON-AI-ENGINE.md), `AI_SERVICE_URL` and `AI_SERVICE_TOKEN`.
- Flag: `public.aiSearch` is mentioned in [src/lib/env.ts](src/lib/env.ts).

**DIAGNOSTIC STEPS**

1. Health `ai` is true when any provider is configured (`isAiConfigured`). `aiProviders` is a count, not a name list. On 2026-10-25 the count was 4. Which four was not disclosed.
2. Default order is in `DEFAULT_ROUTING`. `AI_PROVIDER=disabled` or a single vendor name overrides it. `AI_PROVIDER_ORDER` and `AI_ROUTING` are not uploaded by the secret-sync workflow; if they are set, they were set on the Worker directly.
3. A provider error should fall through to the next configured provider. A total failure should not take the site down.
4. Python is optional. Timeout, outage, or bad JSON keeps the Postgres order. Do not debug Python first unless `AI_SERVICE_URL` is set. Whether it is set in production is UNKNOWN (not in the sync list).
5. Rate limit `AI_LIMITER` is 20 requests per 60 seconds per key.

**SAFE FIX**

- Add or rotate one vendor key with the manual sync workflow. Never log the key.
- If one vendor is down, leave the others. Do not hard-code a new provider in a page component.
- Python deploy only when `services/ai-python/**` or the listed TS files change. A bad Python deploy does not require replacing `rega-platform`.
- Do not raise `AI_DAILY_LIMIT` to hide a loop.

**VERIFICATION**

Health `ai: true` and a non-zero `aiProviders` if keys are supposed to be present. A no-match question still returns the deterministic empty answer. A known listing question returns grounded text. CI uses a fake AI server; it does not prove production keys.

**ROLLBACK**

Remove the bad `AI_PROVIDER` override or restore the previous key. Redeploy the Python Worker from the previous commit only if that Worker changed. Leave the web Worker alone if it did not change.

## Authentication and OTP failures

**SYMPTOM**

Sign-in fails, the six-digit `/dr` code never arrives, every code is rejected, or a non-owner appears to have SUPER_ADMIN.

**LOCATION**

- Code issue and check: [src/features/auth/admin-code.ts](src/features/auth/admin-code.ts) and [src/features/auth/admin-code-core.ts](src/features/auth/admin-code-core.ts).
- Table: `AdminSignInCode`, migration `20261022120000_admin_sign_in_codes`.
- Role lock: `SUPER_ADMIN_EMAILS` and `effectiveRole` in [src/lib/rbac.ts](src/lib/rbac.ts).
- Mail: [src/lib/email/index.ts](src/lib/email/index.ts).
- Session: [src/app/api/auth/[...nextauth]/route.ts](src/app/api/auth/[...nextauth]/route.ts).
- Password reset and verify-email routes under `src/app/[locale]/`.

**DIAGNOSTIC STEPS**

1. `/dr` for an anonymous browser should show the code form (verified 2026-10-25, HTTP 200). A password link on that page is the other path, not a bug by itself.
2. Codes are sent only for the owner address, and only when that user is an active SUPER_ADMIN with a verified e-mail. Every other address gets the same success response and no mail. That is deliberate.
3. Health `email: true` means `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` are set. It does not prove the latest message was delivered. On 2026-10-25 `email` was true.
4. `unavailable` from the code request means Resend did not accept the message. The unused code row is deleted.
5. `rate` means the in-isolate limiter or the durable audit limits fired. Wait. Do not delete `AuditLog` or `AdminSignInCode` in production to "clear" it.
6. OAuth buttons appear only when both id and secret for that provider are set ([docs/adr/0009-social-sign-in.md](docs/adr/0009-social-sign-in.md)). Callback host must match `AUTH_URL` / the canonical host. Stale docs may still say `regaplatform.com`.
7. Another stored SUPER_ADMIN acts as USER. That is the 2026-10-22 rule, not a broken session.

**SAFE FIX**

- Mail failing: fix `EMAIL_FROM` to a verified Resend domain and the key. PROJECT_MEMORY **reports** `regaplatform.com` as the verified sending domain. Do not change the public website domain to match the mail domain.
- Clock or TTL: codes are short-lived (`CODE_TTL_MINUTES`). Request a new code after the cooldown. Do not lengthen TTL in a drive-by patch.
- Wrong owner address: change `SUPER_ADMIN_EMAILS` only with a new explicit owner instruction, then deploy through CI.
- Do not create a second admin, and do not reset all passwords.

**VERIFICATION**

Owner receives one code, signs in once, and the code cannot be reused. A different address still gets no mail. Health `email` stays true. An audit row `auth.dr_code.sent` exists for the owner only (check as the owner, do not dump the table into git).

**ROLLBACK**

Revert the auth commit and roll the Worker back. Do not drop `AdminSignInCode`. Existing sessions are JWTs; a rollback returns the previous rules on the next sign-in.

## Missing media and R2 errors

**SYMPTOM**

Upload fails, images 404, or the business form says storage is not configured. Health `storage` is false.

**LOCATION**

- [src/lib/storage.ts](src/lib/storage.ts)
- [src/app/api/v1/media/upload-url/route.ts](src/app/api/v1/media/upload-url/route.ts)
- [src/app/api/v1/media/business-image/route.ts](src/app/api/v1/media/business-image/route.ts)
- Names: `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_URL`, and build-time `MEDIA_PUBLIC_HOST` in [next.config.ts](next.config.ts).

**DIAGNOSTIC STEPS**

1. Health `storage: true` means the four required values are non-empty. On 2026-10-25 it was true. It does not prove the bucket is R2. R2 is **REPORTED** by the legal default and code comments.
2. `StorageNotConfiguredError` is thrown before any network call when a required value is missing.
3. Pre-signed PUT URLs expire in 300 seconds. A slow client looks like a broken bucket.
4. MIME allow-list rejects SVG and HTML on purpose.
5. Public URL is `MEDIA_PUBLIC_URL` plus the object key. A wrong public host 404s even when the PUT succeeded.
6. `forcePathStyle: true` is set when `STORAGE_ENDPOINT` is present. A wrong endpoint host fails the PUT. Do not print the endpoint.

**SAFE FIX**

- Set the missing names with the manual sync workflow or the Worker dashboard. Empty GitHub secrets are skipped and do not delete existing Worker values.
- CORS on the bucket, if uploads fail only in the browser, is a bucket setting. Do not make the bucket public-list.
- Do not delete objects to "clean" a bad URL. Fix the public base URL.
- `MEDIA_PUBLIC_HOST` changes apply on the next Workers build, because `next.config.ts` reads it at build time.

**VERIFICATION**

Health `storage: true`. A new business image uploads and the profile page loads it over HTTPS. An old object key still resolves.

**ROLLBACK**

Restore the previous `MEDIA_PUBLIC_URL` and storage secret names. Do not delete the bucket. Roll the Worker back only if the application code, not the secret, caused the failure.

## DNS and SSL

**SYMPTOM**

A hostname does not resolve, the certificate warning is new, `rega24.com` does not reach `www`, or the retired `regaplatform.com` host stops redirecting.

**LOCATION**

- Public DNS for `rega24.com` and `regaplatform.com`: Cloudflare NS `autumn.ns.cloudflare.com` and `max.ns.cloudflare.com` (verified 2026-10-25).
- Certificate seen on `www.rega24.com`: Google Trust Services WE1, CN `rega24.com`, notAfter 2026-01-21. Renews through Cloudflare; there is no certificate file in git.
- App redirects: [next.config.ts](next.config.ts). HSTS is two years with `includeSubDomains` and `preload`.

**DIAGNOSTIC STEPS**

1. Compare apex, www, and both retired hosts. On 2026-10-25 all four reached `www.rega24.com`.
2. `A`/`AAAA` answers in Cloudflare anycast ranges are normal. They are not the origin IP.
3. A certificate warning before 2026-01-21 is not simple expiry. Check the hostname on the certificate and the Cloudflare SSL mode. Do not upload a random certificate into the repo.
4. HSTS means browsers will keep forcing HTTPS. Do not "test" by turning TLS off.
5. Dashboard custom-domain bindings were UNKNOWN in the 2026-10-25 audit. A public 301 does not prove which Cloudflare rule sent it.

**SAFE FIX**

- Keep both `rega24.com` and `www.rega24.com` pointed at Cloudflare. Apex must 301 to www, not the other way around (www-to-apex caused a loop before; see the comment in `next.config.ts`).
- Leave the retired hosts redirecting until the owner says to remove them. Do not delete the zones in this runbook.
- If the certificate is actually expired after the notAfter date, renew it in Cloudflare SSL. Do not change nameservers away from Cloudflare as a first step.

**VERIFICATION**

The four host checks match the system map table. `openssl` or the browser shows a current certificate for `rega24.com`. HSTS is still present on www.

**ROLLBACK**

Restore the previous DNS record or redirect rule. Do not lower the HSTS max-age to 0 on production as a rollback; that is cached by visitors.

## Performance problems

**SYMPTOM**

Pages feel slow, health `latencyMs` is high, or Cloudflare reports error 1102 (CPU or subrequest limit).

**LOCATION**

- Health handler does several SQL round-trips: [src/app/api/v1/health/route.ts](src/app/api/v1/health/route.ts). Its `latencyMs` includes those queries.
- DB pool: [src/lib/db.workers.ts](src/lib/db.workers.ts) (3 connections per request, Hyperdrive if bound).
- Edge cache: [src/lib/edge-cache.ts](src/lib/edge-cache.ts). The cache key includes the Worker version, so a deploy cold-starts HTML cache on purpose.
- Rate limits and maps are not the database.

**DIAGNOSTIC STEPS**

1. One health sample on 2026-10-25 was `latencyMs: 1692` with `database: ok`. That is a single observation, not a trend. Repeat `/api/v1/health` and a cached HTML page before changing infrastructure.
2. Distinguish HTML (may be edge-cached) from `/api/v1/health` (`cache-control: no-store`).
3. 1102 after a DB change usually means a Prisma client or a connection was created per query. Read the comments in `db.workers.ts` before adding a pool.
4. Hyperdrive is not in the committed wrangler file. Adding it is an infrastructure change, not a docs change, and needs the real config id from Cloudflare. Do not invent an id.
5. Check Beta health history for a new failure, not just slowness.

**SAFE FIX**

- Fix a query or an accidental per-request client in code, then ship through CI.
- Do not add a paid APM, a second database, or a cache vendor for a single slow sample.
- Do not disable the edge cache globally to "see fresh HTML".
- Do not raise Worker CPU limits as the first step.

**VERIFICATION**

Repeated health calls and a public HTML page are back to the usual range for this site, with no 1102 in the deploy that follows. Say the range you measured. Do not invent a baseline.

**ROLLBACK**

Roll the Worker back to the SHA before the performance patch. Cache fills again on its own.

## CI/CD failures

**SYMPTOM**

GitHub CI is red, Deploy did not start, Beta health failed, or a pull request's Neon branch job failed.

**LOCATION**

- [.github/workflows/ci.yml](.github/workflows/ci.yml) (includes `node scripts/validate-system-docs.mjs`)
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- [.github/workflows/production-health.yml](.github/workflows/production-health.yml)
- [.github/workflows/production-browser.yml](.github/workflows/production-browser.yml)
- [.github/workflows/neon-branch.yml](.github/workflows/neon-branch.yml)
- [.github/workflows/db-migrate.yml](.github/workflows/db-migrate.yml) and [.github/workflows/worker-secrets-sync.yml](.github/workflows/worker-secrets-sync.yml) are manual

**DIAGNOSTIC STEPS**

1. Read the failed job log. Do not rerun Deploy until CI is green.
2. Documentation validator failures are link, heading, inventory, or secret-pattern errors. Fix the doc or regenerate the inventory. They are not production outages.
3. CI Postgres is throw-away (`postgres:16` service). A migration failure there means the committed SQL is wrong. Do not point CI at production.
4. E2E refuses production-looking databases. Do not override that.
5. Beta health failure with Cloudflare Access headers is a different branch of the workflow (private gate). On 2026-10-25 the public health URL returned 200 with no Access challenge. If Access is turned on later, follow the workflow's Access checks instead of treating 302 as downtime.
6. Production browser runs only after a **CI-triggered** successful Beta health. A skipped browser run after the hourly health job is expected.
7. Neon branch job failure on a PR does not deploy production. See the database section and PROJECT_MEMORY before retrying in a loop.

**SAFE FIX**

- Code or test failure: fix the smallest cause and push. Required checks stay required.
- Docs inventory drift: `node scripts/generate-system-inventory.mjs` and commit the JSON with the doc change.
- Do not mark a failing check as success, and do not skip the identity guard to get a green deploy.
- Manual migrate and secret sync stay manual. A red CI run is not a reason to type `migrate` into the migrate workflow.

**VERIFICATION**

CI `verify` is green on the SHA. If the commit is not documentation-only, Deploy publishes and Beta health passes. If it is documentation-only, Deploy is green **and** logs the skip line, and the live health body is unchanged aside from `time` and `latencyMs`.

**ROLLBACK**

Revert the commit on `main`. If a non-docs commit already deployed, roll the Worker back as well. Reverting a docs-only commit does not require a Worker rollback.

## Cleanup release checks — 2026-10-26

- `missing previews block`: both candidate Wrangler files define isolated previews. `__preview-health` checks isolation; other preview requests return non-ready 503 before application/data/provider handlers. Do not copy production bindings to make previews appear functional. Full QA uses CI's disposable database.
- Neon preview HTTP 422: the old workflow created unused branches without consuming its outputs. PR #72's manual policy is reused; no branch, backup or production data is deleted. CI still runs migration/preflight/integration/browser tests on PostgreSQL. Future genuine Neon preview work needs audited capacity and an actual consumer.
- After Zod 4 upgrades, partial PATCH schemas must remove create defaults before making fields optional. `tests/validation-upgrade.test.ts` covers omitted-field preservation and bounded oversized collections.
- Target drift: `scripts/production-target.mjs` rejects wrong account, stable Worker tag, services or official domain bindings. Never recreate retired `rega-platform`. New deployed version tags must match the verified GitHub SHA. Retain the preceding version for rollback and verify all production readiness checks after publishing.
- Previews Base provider values are now secret_text. This storage conversion preserves values and does not prove provider-side rotation/revocation. Do not log or export secrets while checking them.


## Deployment annotation forwarding — 2026-10-26

If release output says `Unknown arguments: CI, release` before upload, the OpenNext deployment wrapper split a message containing spaces. Keep the deployment message a single shell-safe token, retain the verified SHA tag and identity/ownership guards, and run `npm run cf:dry-run` through the OpenNext forwarding path before publishing. Plain Wrangler dry-run alone did not exercise that path. Failed run40390749927 uploaded no new application. See PR77 and the central Doc for the subsequent verified release.


## D1 migration preparation — 2026-10-27

VERIFIED read-only: existing EU D1 `rega24-migration` reports zero tables; production `rega24` has no D1 binding and still uses PostgreSQL. Neon bounded SELECT1 returns HTTP402 quota exceeded. The owner reports an available backup, not yet supplied/verified. Separate local candidate schema/SQL is preparation only. See [D1 migration status and continuation](docs/D1-MIGRATION.md) for runtime incompatibilities, data verification, cutover and recovery requirements. Do not point the live Worker at the empty target. No remote infrastructure change performed.


## D1 target schema applied — 2026-10-27

Supersedes the earlier empty-target observation: the existing disconnected `rega24-migration` now contains the candidate36-table schema (105statements accepted). Remote readback verifies every scalar column, zero application records and zero FK violations. Production `rega24` has noD1binding; query redaction remains enabled. New offline export/rehearsal scripts and remaining runtime/data/source blockers are documented in [D1 migration status](docs/D1-MIGRATION.md). Neon production and existing backup-branch SELECT1 both return402; no quota bypass/paid activation/source change performed. Do not bind the live app to this empty candidate.

## D1 candidate and cutover checks — 2026-10-27

Earlier Neon402/source-export blocker is resolved. The real archive restores and matches all36 live source tables; the disconnected D1 copy has2329 exact records and no FK errors. Production activation remains pending hosted release checks. See [D1 migration](docs/D1-MIGRATION.md).

- Date filters missing numeric timestamps: the PrismaD1 default emits ISO filter arguments. REGA normalizes typed datetime arguments to UTC epoch milliseconds; do not change imported dates to text or silently reimport data.
- Non-atomic Prisma transactions: REGA refuses the SDK's emulation and uses one guarded native batch. A P2034 conflict means retry the request; never bypass the revision guard or remove its triggers.
- Unicode case matching: verify mirror backfill and current write adapter, not SQLite's ASCII lower(). Internal mirror fields must remain omitted from DTOs.
- Release blocked by final-snapshot readiness: verify exact release SHA, source freeze, all-table hashes and zero FK violations before marking `_RegaCutover` ready. Waiting/failing the gate makes no deployment.
- Local browser tests: override machine-local AUTH_URL for the E2E port and GEOCODING_PROVIDER=nominatim for the local fake. Never use production or a restored customer database as a fixture. The D1 initializer's --test marker is mandatory.
- Browser download/Google Fonts downloads can be blocked by executor egress policy. Local Chromium and the same actual font from its package allow bounded local verification; hosted CI still runs the normal Chromium/WebKit and production font build. Do not weaken assertions or change product typography to bypass tooling.

## First D1 release remains blocked — 2026-10-28

The first attempt never passed the readiness gate despite a verified ready D1 audit row. Original PostgreSQL availability was restored before further diagnosis; D1 was not activated. PR #84 / main `09afcd5` reads the operator-issued snapshot proof through existing authenticated Workers settings, avoiding an additional D1 API permission on the CI reader.

If first activation is blocked, inspect the current `REGA_ISOLATED_PREVIEW=1`, fresh `REGA_D1_FREEZE_NONCE`, and `REGA_D1_CUTOVER_PROOF` metadata. Require the exact release SHA/database, all-table hashes, backup hash, zero FK violations, a 120-second drain and verification within 15 minutes. Never fabricate a proof, change token scopes or bypass exact-main CI/ownership gates. If readiness or deploy fails while the old source application remains active, clear the temporary proof/nonce, restore its isolation flag to 0, and verify live health 200. After D1 accepts writes, a return to PostgreSQL requires a fresh freeze and reconciliation of D1 changes; blindly deploying old PostgreSQL code can hide new data. See [D1 cutover and recovery](docs/D1-MIGRATION.md).

## Verified D1 continuation — 2026-10-28

First activation succeeded at 08:18 UTC as release `09afcd538a71fff6b08627057d272bf318e4362c`; subsequent releases read the active provider plus exact D1 UUID. Health must report HTTP 200, `ok=true`, `checks.databaseProvider=d1`, migrations/content ready. Real D1 migration history includes 0001_initial.sql, 0002_runtime.sql and 0003_city_slug_fold.sql; 108 revision triggers support atomic concurrency guards. Current original-value verification and backup scope are in the [cutover evidence](docs/evidence/d1-production-cutover-2026-10-28.json).

The production browser run during source isolation correctly saw 503. Replacement run 40656143224 after activation passed 201 checks with zero failures; post-cutover health 40655046619 attempt 2 also passed. Do not diagnose a historical freeze result as the current deployment. Do not fix runtime errors by resetting data, reapplying original/delta imports, dropping migrations, rotating auth secrets or recreating production resources.

## Documentation PR merge unexpectedly deploys the Worker

An empty result from `git diff-tree` does not prove a merge is documentation-only: without merge flags it omits merge paths, and the release's empty-diff fallback deploys. Use the first-parent comparison `git diff --name-only HEAD^ HEAD` and execute the actual scope shell against a real merge, including a depth-2 checkout. Docs-only merges must return skip=true; application/mixed changes must return skip=false. Do not weaken the exact-main CI/ownership gates or disable application releases to fix this. [Verified regression evidence](docs/evidence/deployment-scope-regression-2026-10-28.json).

## CI failure signatures and permanent resolutions — 2026-10-29

Audit of the 200 most recent completed workflow runs (2026-10-26 to 2026-10-29). Match a new failure against this table before investigating from scratch. No signature below is an open deterministic failure on `main`.

| Signature in the log | Class | Root cause | Permanent resolution / guard |
| --- | --- | --- | --- |
| `npm ci` `EUSAGE` … `lock file's undici@… does not satisfy …` | PR defect, caught by CI | `package.json` override changed without regenerating `package-lock.json` | Regenerate the lock file with `npm install`; `npm ci` in `verify` is the guard (fails in the first minute) |
| `TS2578: Unused '@ts-expect-error'` / `not assignable to … 'ProcessEnv'` in a test | PR defect, caught by CI | Test typing | `npm run typecheck` in `verify` is the guard |
| `strict mode violation: getByLabel('Land') resolved to 3 elements` | PR defect, caught by CI (twice: «Bundesland», «Nederlands») | Playwright `getByLabel` matches substrings by default; new UI text contained the label word | Select `select[name="countryCode"]`; when new UI text is added, check short `getByLabel` lookups in `tests/e2e/`. Do not use blanket `exact: true`: a `<select>` inside its label adds its option text to the accessible name |
| `Unknown arguments: CI, release` before upload | Release bug (run 40390749927) | OpenNext re-split a deployment message with spaces | Single shell-safe message token; `npm run cf:dry-run` in CI exercises the same forwarding path |
| `D1 cutover pending; production release remains blocked` | Intended safety gate (run 40647881228) | Exact-SHA D1 readiness proof absent during cutover | None needed; the gate must stay. See the D1 sections above |
| Beta health / browser: many routes `HTTP 500` or `503` on `www.rega24.com` | Real production state, correctly reported | 2026-10-27: old PostgreSQL source unavailable; 2026-10-28: authorized D1 cutover freeze | Fixed by the D1 cutover; replacement runs passed. Never mark such a run green |
| `Create Neon Branch` `AxiosError … 422` | Retired infrastructure | Neon preview branch creation on the Free plan | `neon-branch.yml` is now a manual policy notice; PR tests use CI's disposable PostgreSQL and D1 SQLite |
| CI run `cancelled` | Expected | `cancel-in-progress` for superseded PR pushes | None; the rule applies only to `pull_request` events, so `main` CI and Deploy are not cancelled by it |

The four integration tests that need PostgreSQL (`business-repair.integration`, two `schema-readiness`, `seed-data` idempotency) skip only when `DATABASE_URL` is unset. CI sets it for the whole job, so they cannot be skipped silently there. Run them locally against a disposable PostgreSQL, never a shared database.
