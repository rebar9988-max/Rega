# REGA24 troubleshooting

Last repository/control-plane verification: **2026-10-26 UTC**; scope and evidence in [system map](REGA24_SYSTEM_MAP.md). Read [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [PROJECT_MEMORY.md](PROJECT_MEMORY.md) and the existing central hub before diagnosis. Older incident notes are history, not current live evidence.


## Continued admin and security checkpoint — 2026-10-25

Prepared canonical office is `/admin`; old `/dr` is compatibility redirect only, with one source tree at
[src/app/admin](src/app/admin). Diagnose redirect destination/query and authentication before touching RBAC. Do not
reintroduce an admin-to-dr rewrite: keep one actual route tree. Private navigation/API prefetching also needed
correction in browser QA; sidebar links now disable prefetch and health uses a plain anchor. Both route
prefixes bypass public edge cache. System settings require fresh `settings.write` permission and an atomic audit.

Live R2 CORS now includes official www/apex origins plus legacy origins. OpenAI/xAI storage is now secret_text and
both Workers redact query strings. Historical exposed-key revocation remains a release blocker; changing storage
is not key rotation. Never roll back to a pre-hardening config version or restore plaintext credentials.

Both prepared deployment workflows use [exact commit verification](scripts/verified-release.mjs), including manual
fallbacks on main. Missing/failed/wrong-SHA CI or API errors block release. Ordinary builds are blocked by executor
Google Font policy; test-only font mocks support isolated QA and must never be released. See
[acceptance and blockers](docs/REGA24_CONSOLIDATION.md) before deployment. Infrastructure consoles are linked from the
system page; their account permissions/billing are independently authoritative.

## Before any investigation

1. Run `node scripts/project-identity-guard.mjs --project REGA`; verify remote, branch and domain. Stop on mismatch. Never touch the separate R&L project.
2. Find previous investigation/checkpoint first. Record time UTC, affected path, status/error code, Ray/request ID, reproduction and recent exact deployed version. Keep identifiers necessary for diagnosis; omit personal content, full query strings, cookies, codes, signed URLs, connection strings and credentials.
3. Read existing CI/health/browser/Cloudflare results before rerunning. Distinguish repository implementation, current control plane and actual functional behavior. Use read-only checks first; provider permission/network errors are environment limitations.
4. Fix only the responsible layer after reproducing it. No production deletion/reset, domain removal, Worker replacement, billing activation or unreviewed migration. Never use `db push`, `migrate reset`, production seeding or “mark migration applied” to silence an error.
5. All SAFE FIX actions below are conditional repair guidance, **not authorization to mutate production during this documentation task**. Prepare code/config changes on a branch and validate in isolation; use existing release gates for actual release. Preserve backup/restore and security holds recorded in memory. Rollback is scoped and reviewed, never database reset or destructive restore.

Read-only probes from a permitted environment (TLS verification must remain enabled):

```bash
node scripts/project-identity-guard.mjs --project REGA
curl --silent --show-error --max-time 20 https://www.rega24.com/api/v1/health
curl --silent --show-error --max-time 20 --output /dev/null --write-out '%{http_code}\n' https://www.rega24.com/en
curl --silent --show-error --max-time 20 --output /dev/null --write-out '%{http_code} %{redirect_url}\n' 'https://rega24.com/en?probe=1'
node scripts/rega24-docs.mjs --check
```

Expected configuration: canonical `/en` 200; apex 301 to same path/query on www. The root has locale negotiation. No public fetch was performed from this restricted executor in the audit; these are procedures, not observed HTTP results. Avoid large load tests or inference probes with unknown spend. Public page visits may increment ordinary analytics.

## Incident: Website downtime

**SYMPTOM** → Entire site unavailable, blank response, timeout, or health 503.

**LOCATION** → [routing and deployment map](REGA24_SYSTEM_MAP.md), [health handler](src/app/api/v1/health/route.ts), [Worker wrapper](worker.mjs), [edge cache](src/lib/edge-cache.ts), Cloudflare rega-platform Deployments/Logs, existing [Beta health](.github/workflows/production-health.yml).

**DIAGNOSTIC STEPS** → Compare canonical public page, static `/brand/rega-logo.webp` and uncached `/api/v1/health`. Read status, content-type and Ray ID without sharing cookies. Check Cloudflare active version/allocation and timestamp against exact successful deployment/CI. Inspect health database/migrations/contentColumns/missingEnv booleans; a 200 health does not prove email/storage/AI operation. If static works but health fails, proceed to DB/config procedures. If no TLS/HTTP reaches the Worker, proceed to DNS/SSL. A cached page can outlive a DB outage.

**SAFE FIX** → Restore only proven missing runtime configuration via the approved secure mechanism, or prepare the responsible code fix. If a new web version causes the outage, consider the last known healthy compatible existing version; no replacement Worker. Do not deploy merely because a probe was blocked by executor policy.

**VERIFICATION** → Health 200 with DB/migrations/content columns ready, public and static paths succeed, correct active version/allocation read back, private pages remain protected. Observe repeated existing checks across a cache expiry without load testing.

**ROLLBACK** → Return traffic to recorded prior compatible Worker version through existing reviewed rollback procedure in [deployment](docs/DEPLOYMENT.md). Leave data/migrations/domains intact; recheck health. Configuration repair rollback uses protected previous values without copying them into docs.

## Incident: HTTP 4xx and 5xx errors

**SYMPTOM** → 401/403, unexpected 404, 413/415/422 validation, 429 throttling, 500/503 or Cloudflare 1102.

**LOCATION** → Matching file in [API route inventory](docs/REGA24_INVENTORY.md), [API mapping](src/lib/api.ts), [auth helpers](src/lib/auth-helpers.ts), [business access](src/lib/business-access.ts), [rate limits](src/lib/rate-limit.ts), Worker Logs.

**DIAGNOSTIC STEPS** → Capture method/path/status/stable JSON error code and deployment ID. Confirm whether response is edge HTML, application JSON or masked Next server-action error. 401 requires correct session; 403 requires current DB role/status and business membership, not a UI change. 404 can deliberately hide private/unpublished records: inspect publication rules, never auto-approve records. Check payload/mime/size for 413/415/422, shared limiter/cooldown for 429. For 500 use sanitized correlated logs; for 503 inspect health/schema. 1102 is Worker CPU exhaustion: inspect DB client/pooling/cache/build behavior before any quota change.

**SAFE FIX** → Correct client input/session or scoped application bug after reproduction. Preserve permission, visibility and rate checks. For schema mismatch use read-only preflight and the migration procedure; don't relabel every 500 as a DB outage. Do not expose internal messages or bypass roles to get HTTP 200.

**VERIFICATION** → Authorized request succeeds; corresponding anonymous, inactive-member and wrong-owner requests still fail correctly. Run relevant existing [security/API tests](tests) on isolated fixtures. Confirm masked failures remain safe and new logs omit secrets.

**ROLLBACK** → Revert the scoped client/server change; if already released, use compatible prior Worker version. Preserve access rules, data and applied additive migrations.

## Incident: Cloudflare deployment failures

**SYMPTOM** → OpenNext build, Wrangler packaging/upload or post-deploy smoke fails; unexpected version serves traffic.

**LOCATION** → [web deploy](.github/workflows/deploy.yml), [CI](.github/workflows/ci.yml), [wrangler.jsonc](wrangler.jsonc), [Next config](next.config.ts), [OpenNext config](open-next.config.ts), [build preparation](scripts/prepare-worker-build.mjs), Cloudflare Builds/Deployments.

**DIAGNOSTIC STEPS** → Identify correct repo/SHA/trigger and first failed step. Distinguish Node build, Worker bundle, upload permission and runtime failure. Read credential **presence/types**, never values. Check package-lock/adapter/Next compatibility, entry `worker.mjs`, generated `.open-next/worker.js` and assets. Do not commit generated output. Read separate Workers Builds configuration before assuming it deploys: main dry-run is verified, but inherited branch previews had a different command. Check active allocation: successful upload alone does not prove traffic switched.

**SAFE FIX** → Repair only the identified build/config defect on a branch. Use local dependency install and required checks where network allows; `npm run build` followed by `npm run cf:dry-run` validates without publishing. Do not use unsupported-version overrides, replace Workers or blindly dispatch deployment. For failed auth, restore approved account-scoped credential provisioning rather than login with another account.

**VERIFICATION** → Correct CI and dry-run succeed for final SHA; normal Node/Worker/runtime tests pass. A later authorized release must read back active version/allocation and run health/public smoke. This documentation task requires no release.

**ROLLBACK** → Revert build/config commit. If a broken version is live, select previous compatible existing web version under reviewed rollback; do not delete Worker, bindings, domains or deployment history.

## Incident: Neon connection failures

**SYMPTOM** → Health database error, connection timeout/authentication failure, pool exhaustion, missing table/column, pending/unfinished migration.

**LOCATION** → [db.workers.ts](src/lib/db.workers.ts), [db.ts](src/lib/db.ts), [schema](prisma/schema.prisma), [migrations](prisma/migrations), [preflight](scripts/database-preflight.mjs), [DB workflow](.github/workflows/db-migrate.yml); Neon project `lucky-glitter-73195208` / production branch `br-floral-hall-b22rpgrw`.

**DIAGNOSTIC STEPS** → Check Neon project/branch/endpoint state read-only and protected runtime binding presence. Verify target matches REGA before connecting; never paste URL. HYPERDRIVE is optional and was absent live. Distinguish cold compute/network/auth/SQL-schema errors from migration state. From an authorized protected environment run `node scripts/database-preflight.mjs`; it uses a read-only transaction. Compare committed ledger/required columns to actual state; health migration boolean alone is insufficient. Inspect Workers request-scoped pools, not a generic long-lived cross-request pool. Do not create/delete branches to work around quota.

**SAFE FIX** → Correct proven binding/connection configuration securely or repair the responsible pooling code while preserving request isolation. Schema changes require verified restorable backup, isolated test and committed additive migration through existing guarded workflow. Read latest release holds; manual migrate includes seed and is not a read-only diagnostic.

**VERIFICATION** → Read-only preflight reports expected applied/pending state, no unfinished migration, health ready, representative directory reads pass; verify no row/ownership changes. For pooling repair use existing Worker runtime tests on isolated DB.

**ROLLBACK** → Restore previous connection selection/config securely or compatible prior code. Leave additive schema applied. No reset/drop/truncate, branch deletion or production restore as routine rollback. Follow [backup/restore](docs/BACKUP-RESTORE.md) for separately approved recovery.

## Incident: AI service errors

**SYMPTOM** → Assistant disabled, provider auth/quota/timeout errors, inaccurate retrieval, Python fallback warnings or slow chat.

**LOCATION** → [gateway](src/lib/ai/gateway.ts), [chat](src/lib/ai/chat.ts), [routing](src/lib/ai/routing.ts), [Python runtime](src/lib/ai/python-runtime.ts), [Python client](src/lib/ai/python-client.ts), [Python app](services/ai-python/src/app.py), `/dr/ai`, Worker logs and AiUsageDaily model.

**DIAGNOSTIC STEPS** → Read feature flags/admin settings, AI_PROVIDER/order/routing/budget and configured provider key **names/types**. Check retrieved published DB candidates first; no-match may intentionally avoid a model call. Classify provider 401/403, 429, timeout or malformed output without logging request text/keys. Python warnings `ai.python.rerank_fallback` include safe failure kind/status; check its deployment, AI binding, URL/token pairing and timeout. Service secret presence at both ends does not prove equality. Use existing tests/mocks first; no paid inference or new service activation for diagnosis.

**SAFE FIX** → Fix routing/retrieval/parser errors in isolation; keep original-candidate fallback. Under separately authorized containment, disable affected provider/public AI through existing settings rather than raise spending limits. Plain-text OpenAI/xAI credentials require secure owner-side rotation/revocation and proper secret storage, with no values exported to docs.

**VERIFICATION** → Existing [gateway tests](tests/ai-gateway.test.ts), [Python tests](services/ai-python/tests/test_app.py), [fallback tests](tests/ai-python-service.test.ts) and budget tests pass. Ordinary search works with AI unavailable. Actual provider functional tests only when authorized within confirmed zero-cost limits; record unverified status otherwise.

**ROLLBACK** → Revert routing/code or restore previous safe non-secret feature settings. Preserve budget limits; never restore compromised credentials or remove deterministic fallback to force AI success.

## Incident: Authentication and OTP failures

**SYMPTOM** → Password login fails, `/dr` email code absent/expired, confirmation/reset link fails, social callback error, repeated logout.

**LOCATION** → [auth config](src/auth.config.ts), [session policy](src/features/auth/session-policy.ts), [admin code](src/features/auth/admin-code.ts), [admin code rules](src/features/auth/admin-code-core.ts), [token links](src/features/auth/tokens.ts), [OAuth diagnostics](src/features/auth/oauth-diagnostics.ts), [email adapter](src/lib/email/index.ts), [dashboard sign-in](src/app/admin/sign-in-actions.ts).

**DIAGNOSTIC STEPS** → Identify distinct flow: public password/social vs allowlisted super-admin six-digit `/dr` code vs public verification/reset link. Old “no OTP” memory is superseded by source. For code: verify active/verified super-admin allowlist, email configuration/delivery status, expiry (5 minutes), resend cooldown (30 seconds), durable fail/send caps; never log/retrieve codes or brute-force. Link tokens are single-use and expire. Check canonical AUTH_URL, actual provider callback registration and id+secret pairing. Inspect current session role/status/password marker and business membership, cookie scope/Secure/SameSite, and sanitized diagnostic error codes. Do not treat Google key presence as tested OAuth.

**SAFE FIX** → Correct proven sender/callback/runtime config securely, or scoped session/UI defect in isolation. Use an authorized test inbox/account for later live verification. Keep anti-enumeration, code hashing, expiry, attempt limits and same-site redirects; never grant super-admin, disable verification or rotate AUTH_SECRET merely to retry login.

**VERIFICATION** → Existing [delivery tests](tests/auth-delivery.test.ts), [admin-code tests](tests/admin-code-core.test.ts), [session tests](tests/session-policy.test.ts), [OAuth tests](tests/oauth-social.test.ts) pass. Authorized test verifies fresh login/expiry/logout, rejected reused/expired codes and denied unauthorized dashboard access. If no test inbox/provider access, report live delivery/login UNKNOWN.

**ROLLBACK** → Revert scoped code/config while retaining security controls; expired/consumed tokens remain invalid. Never restore revoked credentials, disable OTP limits or edit account roles as rollback. Treat any planned AUTH_SECRET rotation as a separate session-invalidating operation.

## Incident: Missing media and R2 errors

**SYMPTOM** → Broken images, public 404/403, signed upload expiry/signature mismatch, browser CORS error or storage-not-configured.

**LOCATION** → [storage](src/lib/storage.ts), [upload URL API](src/app/api/v1/media/upload-url/route.ts), [business-image API](src/app/api/v1/media/business-image/route.ts), [media ownership](src/lib/business-media.ts), Media rows/Business URLs, R2 `rega-media`, custom domain `media.regaplatform.com`.

**DIAGNOSTIC STEPS** → Distinguish server-side normalized business upload from browser direct signed PUT. Inspect safe public URL/object key, Media association/deletedAt and actual object existence using metadata only. Compare bucket/public domain to configured names and S3 endpoint. Signed URL lifetime is 300 seconds; do not paste it or its query. Browser direct PUT requires canonical-origin CORS: original audit found only old origins; continuation added canonical origins with readback, so inspect current preflight before diagnosing credentials. Inspect CSP/storage build origin, MIME/size checks and credential scope. Public media domain active in control plane does not prove every object exists.

**SAFE FIX** → Regenerate expired upload URL through normal authorized flow; fix proven URL association/normalization code without bulk rewrites. For a new confirmed CORS defect, prepare a narrowly scoped correction, preserving verified origins and methods. Correct credential provisioning securely if proven wrong. Do not make bucket public indiscriminately, rename bucket, delete “orphan” objects or replace domains.

**VERIFICATION** → Existing [media tests](tests/business-images.test.ts) and isolated runtime smoke pass; authorized disposable upload can be retrieved on intended public domain, MIME/size and ownership checks still enforced. Check canonical browser preflight for generic uploads. No production test uploads in this documentation task.

**ROLLBACK** → Restore prior CORS/config or code precisely. Keep existing media bytes/keys and database rows; do not delete production objects during rollback. Restoring missing bytes requires verified backup and separately approved targeted recovery.

## Incident: DNS and SSL

**SYMPTOM** → NXDOMAIN, certificate warning, TLS handshake failure, redirect loop, apex/legacy host serving unexpected content.

**LOCATION** → Cloudflare rega24 zone/custom domains/SSL settings, [Next redirects/security headers](next.config.ts), [middleware](src/middleware.ts), [site config](src/config/site.ts), [routing map](REGA24_SYSTEM_MAP.md#7-production-domains-and-routing).

**DIAGNOSTIC STEPS** → From permitted network check DNS with `dig rega24.com` and `dig www.rega24.com`; compare authoritative nameservers and DNS propagation. Inspect enabled custom domains → rega-platform, active certificate status/expiry and Always HTTPS. No classic Worker routes is valid for custom domains. Proxied AAAA `100::` records are provider-managed: do not “repair” them into guessed origin IPs. Test apex path+query → 301 www and www locale path → 200, tracking finite redirects. Check application canonical host and external redirect rules separately. Legacy host domains remain enabled; actual redirect behavior is not confirmed here.

**SAFE FIX** → Prepare correction only to the proven misconfigured REGA rule/host after recording prior state. Keep HTTPS/HSTS/certificate validation. Do not remove/recreate custom domains, nameservers or cert packs, change SSL mode speculatively, or buy a certificate. Do not use curl `-k` to claim resolution.

**VERIFICATION** → Valid hostname/TLS chain, expected redirects preserving path/query, no loops, health reachable on canonical domain. Read back exact rule/domain state. Recheck affected mail/media DNS remains intact.

**ROLLBACK** → Restore only prior targeted rule/config after review. Preserve all domains/records/certificates; allow DNS TTL propagation and verify canonical, media and mail behavior.

## Incident: Performance problems

**SYMPTOM** → Slow TTFB/search/navigation, stale pages, layout shifts, high Worker CPU/1102, connection spikes or slow AI.

**LOCATION** → [edge cache](src/lib/edge-cache.ts), [Workers DB pools](src/lib/db.workers.ts), [search](src/lib/search), [business publication](src/lib/business-publication.ts), [map config](src/lib/map-config.ts), [health](src/app/api/v1/health/route.ts), existing [browser checks](.github/workflows/production-browser.yml).

**DIAGNOSTIC STEPS** → Compare warm/cold anonymous reads, authenticated pages and static assets with existing measurements. Read Worker CPU/wall time and DB latency/query plans before changing capacity. Cache TTL is 300 seconds + stale-while-revalidate; version metadata is part of the key. Next revalidation and independent HTML cache are distinct. Check image dimensions/bytes, map/font downloads, network failures, query pagination/indexes and AI timeouts. Public health latency is not a page-performance metric. Historical Lighthouse scores in central memory are REPORTED, not a current benchmark.

**SAFE FIX** → Repair measured bottleneck in isolation (bounded queries, existing index strategy, request-scoped pools, asset dimensions or cache invalidation). Preserve privacy exclusions, version keys and stale fallback. Avoid global cache purge, paid compute upgrades, new monitoring, new provider calls or production load tests.

**VERIFICATION** → Repeat comparable small sample with device/network/time recorded; confirm public freshness after TTL and normal navigation/assets. Existing cache/search/Worker runtime tests pass and private content never enters anonymous cache. Record actual scores and limitations, never promise 100/100 without evidence.

**ROLLBACK** → Revert scoped optimization or cache configuration. Restore prior compatible application version if released; retain version-aware keys and DB data, no table/index deletion without separate reviewed migration.

## Incident: CI/CD failures

**SYMPTOM** → PR check red, main CI/deploy skipped, Neon branch setup fails, docs drift check fails or runtime smoke unavailable.

**LOCATION** → [.github/workflows](.github/workflows), [CI](.github/workflows/ci.yml), [deploy](.github/workflows/deploy.yml), [Neon integration](.github/workflows/neon-branch.yml), [Playwright config](playwright.config.ts), [docs validator](scripts/rega24-docs.mjs).

**DIAGNOSTIC STEPS** → Confirm repo/branch/exact SHA/event and first failed job/step. Separate missing GitHub credentials, executor network policy, package install/version issues, test failures and external preview integration. A failed Neon preview is not automatically core CI database failure (core CI uses disposable Postgres). Check concurrency/cancellation and whether workflow_run got success. Docs inventory drift: inspect source diff before regeneration, not blind hash acceptance. Read active deployment to see whether production was affected; a failed check alone proves neither downtime nor deployment.

**SAFE FIX** → Fix responsible workflow/test/code on a branch; preserve identity guard, DB test safety and CI checks. For docs, stage new source files, review infrastructure changes, update both root documents, then `node scripts/rega24-docs.mjs --write` and `--check`. Restore approved secrets through secure settings only. Do not delete Neon branches/backups, bypass checks or dispatch main deploy to “unstick” docs. Read release holds before any main update.

**VERIFICATION** → Local required relevant checks pass, then read final-head hosted checks when an authorized PR exists; don't cite another SHA's green run. Docs validator confirms links/structure/source freshness offline. Later release verification requires actual active version/health; no release is needed for this task.

**ROLLBACK** → Revert scoped workflow/documentation change; avoid triggering production by pushing/merging main just to roll back docs. Preserve checks, secrets, DB, backup/preview branches and unrelated work. If code release happened independently, follow compatible web rollback procedure.

## Recording a resolved incident

Append dated evidence and root cause to existing project memory, link exact source/commit/check result, describe scoped fix, verification, production impact and rollback checkpoint. Update the [system map](REGA24_SYSTEM_MAP.md) and this runbook after verified changes. Leave unresolved access/billing/functional facts explicit. Regenerate inventory, validate links/structure and do not repeat a completed investigation without evidence that its assumptions changed.


## Verified continuation — 2026-10-26: target drift and hosted preview failure

- Current live web target is `rega24`, same stable tag as earlier rega-platform; official custom domains agree.
  Retired endpoint returns 404. This session did not rename or redeploy it. Main’s stale target must be reconciled
  through reviewed source/CI; never fix this by recreating a missing Worker or moving domains again.
- Before mutation use [production-target preflight](scripts/production-target.mjs) with protected credentials. It
  reads only scripts/domain ownership. Missing permission/service, changed tag or mismatched domain means BLOCKED.
  Verification: both hostnames must uniquely point to manifest webWorker in production. Rollback: preserve current
  routing and review the manifest/source commit; never deploy a config with a retired name.
- Hosted build f39a26b1-ee9d-4034-aaaf-042df45445f7 at 9276ed2: normal npm build succeeded; deploy command
  `wrangler preview` failed because config lacks previews. Do not add new preview infrastructure merely to silence it.
  This branch’s preview fcdb7c667f24407bae4c85b3c29423eb is now auto_build=false and dry-run only, API200/readback.
  Rollback only after entitlement/config review: restore that preview’s setting explicitly, never production routing.
- A key-shaped OpenAI value appeared in the stored build log’s diagnostic config suggestion. Do not fetch/export raw
  logs or reproduce it. Limit access and use provider-side revoke/rotation; secret_text storage is insufficient.
  No key value was returned to the model or documentation. Original source of the diagnostic value is UNKNOWN.
- PR73’s old Neon workflow created a two-week preview successfully. Prepared workflow now requires neon-preview label
  before creation; core CI needs no provider branch. Existing preview/data/backup branches are preserved. A ready
  fresh backup/restore-verify branch is not proof of completed restoration; check actual isolated verification evidence.
- On live rega24 discovery redact_query_string=false: the older privacy checkpoint is superseded. Read current settings
  before declaring remediation; no previous version is safe merely because it once had a passing privacy setting.

2026-10-26 privacy repair after target reconciliation: settings-only update on existing rega24 succeeded HTTP200; readback redact_query_string=true and all 28 binding names/types unchanged. Active deployment cf37b341-5e5c-4703-915b-731aeefa6bfd / version f7a118cd-6f64-4206-a19e-ec5b434a5bc9 at100%. No application upload, route change or secret-value update; no new logging destination. An initial malformed multipart request was rejected400 with no change, then corrected. Rollback must preserve redaction rather than returning to a pre-hardening version.

Latest shared-hub recovery evidence (2026-10-26, REPORTED from the completed parallel session, not independently repeated here): Neon-native reconstruction compared 37public tables/2325rows with matching row/schema/index/constraint digests and14migration records; four nullable social fields were rehearsed only on the isolated restore branch, never production. Backup and restore computes were suspended. This supersedes earlier absence-of-native-proof wording; it does not certify independent PG18 dump restore, functions/grants/enums or R2 backup, and does not clear remaining release holds. Reuse that completed investigation.
