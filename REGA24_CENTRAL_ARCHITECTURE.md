# Rega24 central architecture

Audit date: 2026-10-25. Status: **BLOCKED — cutover has not happened**.
This document is the centralization specification and verified checkpoint, not a claim of deployment.
Repository: `rebar9988-max/Rega`; production branch: `main`.
Audited repository commit: `7011eb5482e518aa1b0e2f3974d516cbb8c3f6d2`.

## Required final architecture

- Exactly one production application Worker: `rega24`.
- Application hosts: `rega24.com` and `www.rega24.com`; www canonical.
- One repository, root `wrangler.jsonc`, one CI-gated production deploy workflow.
- Next.js pages, APIs, AI gateway, semantic processing and any future scheduled/queue handlers are internal modules of that Worker.
- Postgres, R2 and vendors remain external resources. Secure bindings/credentials connect them; data is never moved into Worker code.
- R&L resources and rlgo.net are excluded. Account-wide discovery does not authorize their modification.
- No paid plans, provider inference charges, extra paid monitoring or duplicate deployment paths.

## Verified live inventory

Cloudflare account `ee07860dbb8e61ff6915758785baf89a`; zone `8428220bdbf9049138d0607d0e3bcb9d`.
The zone is active, unpaused, Free Website plan, price 0. Other account subscriptions/usage charges are not verified.

| Resource | Verified state | Dependency / migration requirement |
| --- | --- | --- |
| Worker `rega24` | Absent from complete Worker list | Must deploy real application with complete runtime configuration; never substitute a placeholder/proxy and call it consolidated |
| Worker `rega-platform` | Current production application; fetch handler; assets | Preserve while preparing and verifying replacement |
| Worker `rega-ai-python` | Python runtime, fetch handler, Workers AI binding | Port embed/rerank/process behavior into internal JS/TS module before retirement |
| Worker `rega` | Older assets application; no secrets; fetch handler | Verify no clients, routes, integrations or rollback dependency before retirement |
| Pages | 0 projects | No Pages migration found |
| KV | 0 namespaces | None found |
| D1 | 0 databases | None found |
| Queues | 0 queues | None found |
| Cron | Empty schedules on all three Rega24 Workers | No scheduled behavior to migrate currently |
| R2 | `rega-media`, created 2026-10-06 | Preserve objects; application currently uses S3 API credentials |
| Hyperdrive | No Rega24 configuration found | Do not reuse the unrelated R&L Hyperdrive |
| Cloudflare AI Gateway | 0 gateways | Current vendor gateway is application code, not this Cloudflare product |
| Workers AI | `AI` binding on Python Worker | Bind to `rega24` after module parity tests and free-usage verification |
| Worker Builds | No triggers returned for `rega-platform` | Other Worker build connections not fully audited |
| www + apex | Both custom domains point to `rega-platform` | Reassign only after replacement health and rollback are verified |
| Legacy web domains | Two enabled custom domains remain attached to `rega-platform` | Remove application attachment after cutover; choose redirects without retaining another application Worker |
| Public media | `https://media.regaplatform.com` | Legacy hostname dependency remains; serve existing objects through canonical-host media path or migrate URLs compatibly before retirement |
| Worker previews | workers.dev and preview URLs enabled on all three Rega24 Workers | Public-host restriction requires reviewed retirement/disable; preserve Python access until internal module is live |
| Zone Worker routes | Empty on rega24.com | Application uses custom domains instead |
| DNS | 11 records; www/apex Worker-owned AAAA; remaining mail records | Keep mail records; do not delete them as legacy app resources |

Worker version checkpoints, each at 100% in its latest deployment:

| Worker | Version | Deployment |
| --- | --- | --- |
| rega-platform | `93023599-8b90-48a2-9449-33ea286fa34e` | `66929254-3e9d-4b43-b70f-34f89389f60f` |
| rega-ai-python | `b3e29ec6-d74c-4843-8b87-c110939d1987` | `57283b99-066e-4dbe-a1f1-a4010a88ca27` |
| rega | `6b147129-bb28-4d2a-8c78-610cb497f229` | `e0866ece-43eb-450b-b2b1-975f96a31e26` |

Only the latest deployment page was read. Historical code exports and rollback restore tests have not been completed.

## Runtime bindings and credentials

Production application has assets, version metadata and shared rate limiters:
`ASSETS`, `CF_VERSION_METADATA`, `LOGIN_LIMITER`, `AI_LIMITER`, `SEARCH_LIMITER`, `FORM_LIMITER`.
No Rega24 KV, D1, queue, service, R2-native or Hyperdrive binding was found in its settings.

Secret names only:
`AI_SERVICE_TOKEN`, `AI_SERVICE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`,
`DATABASE_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `Regaplatform`,
`RESEND_API_KEY`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `XAI_API_KEY`.
The purpose of the `Regaplatform` binding is unverified; do not discard it by assumption.

Plain configuration names:
`CONTACT_INBOX`, `EMAIL_FROM`, `EMAIL_PROVIDER`, `MEDIA_PUBLIC_URL`, `NODE_ENV`,
`STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_REGION`.

OpenAI and xAI bindings are now `secret_text`: this supersedes earlier memory reporting plaintext.
Python has secret `AI_SERVICE_TOKEN`, AI binding, and two model-name variables.
Secret presence is verified; actual credential validity is not established by a names-only inventory.

**Blocking prerequisite:** authenticated APIs used here expose existing secret names, not their values.
The reviewed inherit-binding schema supports inherited names/versions, with no source-Worker field.
Do not attempt to extract secrets using a temporary endpoint, logs or altered production code.
Populate `rega24` from the existing authorized secret source through an approved secure deployment environment.
Audit the existing GitHub secret-sync workflow first: its fixed list omits settings and may not preserve the same credentials.
Never regenerate `AUTH_SECRET`, database credentials or provider keys merely to rename a Worker.

## Neon and durable data

- Verified project `lucky-glitter-73195208`, name `Rega24`.
- 10 branches returned. Default/primary production branch: `br-floral-hall-b22rpgrw`.
- Read-only SQL on that branch: database `neondb`, 37 public tables.
- Backup branches exist, including `backup-pre-offers-whatsapp-2026-10-20`; existence is not proof of a current restorable backup.
- Runtime DATABASE_URL-to-branch match is not yet proven. Do not repoint it based only on the project name.
- No database writes, migrations, new branches, object writes or deletions were performed.
- R2 CORS already includes both canonical hosts and both legacy web hosts, methods GET/HEAD/PUT, exposed ETag, max age 3600.
  Earlier memory claiming canonical origins were absent is stale. Do not repeat that repair.
- Storage health only checks configuration presence. Actual authenticated upload/read/delete and restore remain unverified.

## Module migration plan

Keep existing application features and routes. Use these existing boundaries:

| Responsibility | Current source | Target |
| --- | --- | --- |
| Web / APIs | `src/app`, `src/features` | Same app in `rega24` |
| Edge entry/cache | `worker.mjs`, `src/lib/edge-cache.ts` | Same central fetch handler |
| AI chat / vendor routing | `src/lib/ai` | Same central module |
| Semantic reranking | `python-runtime.ts` -> HTTPS Python service | Internal Workers AI call; same timeout and fallback semantics |
| Embed / text normalization / chunking | `services/ai-python/src/app.py` | Internal TS module with parity tests |
| Database | Prisma / `src/lib/db.workers.ts` | Same verified database; secure connection |
| Media | `src/lib/storage.ts` | Preserve existing object keys and access ownership checks; native R2 binding when compatible |
| Future cron/queue | None currently | Export central handlers only, explicit module contracts |

Python migration must preserve bounds (128000-byte requests, 24 rerank items, 4000-character item text),
finite-score/vector validation, duplicate handling, top-k ordering, Unicode normalization, language detection,
chunk overlap and safe error codes. No unauthenticated internal AI endpoints should be added.
Embedding/rerank parity is a release gate, not something inferred from a successful `/health`.

## Deployment sequence and gates

1. Re-read shared project memory and provider state; verify repository identity with the existing guard.
2. Export code/configuration references, record active versions, verify data backup and restore in isolation.
3. Implement and test the internal AI port; preserve existing search fallback and provider behavior.
4. Update the identity allowlist for owner-authorized `rega24` in this repository only; retain R&L rejection tests.
5. Change root Wrangler target to `rega24`, add compatible bindings, disable public workers.dev/previews,
   and declare only the two canonical app custom domains. Do not attach domains yet in an unverified build.
6. Consolidate Python deploy into the central CI-gated workflow. Update diagnostics/secret sync/guards/health identifiers.
   Keep one root deploy command and remove independent Python publishing only when its replacement is verified.
7. Populate all required secrets through the authorized source, without logging values. Verify completeness/parity.
8. Run lint/typecheck/unit, Python-to-TS parity, database-safe integration, Node/Workers build, dry-run and browser checks.
9. Deploy `rega24` without production traffic first. Verify assets, API, auth configuration, DB, storage and AI.
10. Reassign www and apex custom domains. Verify canonical redirects preserve paths/query, HTTPS and application health.
11. Monitor errors, API responses, scheduled/queue behavior if added, storage and AI against baseline.
12. Only after successful cutover disable legacy entry points. Reverify rollback can restore domains/versions.
13. Delete redundant Rega24 Workers only after backup/restore and rollback evidence is recorded and monitoring is clean.
    Never delete their durable connected resources as part of deleting code.

Do not introduce a new paid pipeline. No hosted CI, remote build, inference, plan upgrade or monitoring service was started here.
Free-tier billing/usage must be verified before enabling any execution that could incur charges.

## Verification evidence and limitations

- Identity guard: PASS on the cloned official repository, branch/main baseline above; no mixed identifiers.
- Documentation validator: PASS on baseline; rerun after documentation edits.
- Cloudflare inventory/settings/custom domains/schedules: verified via authenticated read-only API.
- rega24.com zone: TLS minimum 1.2; TLS 1.3 on; Always Use HTTPS on; SSL mode full, certificate status active.
- `curl -I https://www.rega24.com/api/v1/health`: HTTP 200, HSTS, CSP, nosniff, DENY and same-origin COOP observed.
- `curl GET` health at `2026-10-25T19:52:15.257Z`: HTTP body ok=true; database=ok; migrations/contentColumns/auth/storage/ai/email=true;
  missingEnv=[]; aiProviders=4; latency 1246ms. These auth/storage/AI/email booleans prove configuration, not end-to-end operations.
- Python urllib probes returned 403 while curl succeeded. This is a transport-dependent verification limitation, not evidence of an app failure.
- No application code changed; no app build, browser test, live authenticated auth/storage operation or billable AI request was run.
- No cutover, deployment, Worker disable/delete, secrets mutation or production data change was performed.
- Overall centralization result: **BLOCKED**, never 100/100.

## Remaining blockers and next continuation

The immediate dependency is secure availability of the SAME required runtime secrets in the deployment environment for `rega24`.
Then implement/test internal Python replacement, prove runtime DB identity and backup restoration, verify €0 execution conditions,
deploy and test the replacement, cut over, monitor and retire legacy Workers in that order.
The shared Google Doc contains prior security/backup/release holds; check their exact current status before release.
Latest verified API shows secret typing and CORS repairs already completed; do not repeat or undo those repairs.

## Future extension rules

Add features inside this repository and Worker using explicit internal module contracts.
New databases/storage remain bound resources with documented ownership, limits, backup and deletion policy.
New handlers must be exported by the central entry and tested; no independent production Worker/pipeline without a new owner decision.
Never add another public application hostname, copy credentials into documentation, mix R&L resources, or claim health from configuration alone.
Record actual commit/version/route evidence in the existing project memory after every material deployment.
