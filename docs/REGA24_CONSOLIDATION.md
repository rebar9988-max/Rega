# Rega24 consolidation acceptance and continuation

Date: 2026-10-26 UTC (includes October25 historical checks). Continued from `7301bc6`; branch `feat/rega24-central-admin-20261025`.
This report distinguishes **prepared/local implementation** from **live configuration**. It does not certify 100/100.
Authoritative locators: [project manifest](../src/config/project.json), [system map](../REGA24_SYSTEM_MAP.md),
[runbook](../REGA24_TROUBLESHOOTING.md). No R&L resources were changed.

## Acceptance ledger

| Requirement | Result | Evidence and limit |
| --- | --- | --- |
| One official product identity | PASS locally | Rega24 in shared project manifest, metadata/entity graph, public catalogues and PWA manifest. Technical Worker/package IDs remain stable; no replacement resources |
| One central office | PASS locally; production BLOCKED | Actual [admin route tree](../src/app/admin) replaces dr tree; old /dr root/descendants 308 redirect preserving query/method. Native management modules share fresh RBAC, owner restrictions and sessions. Prepared legacy website redirects preserve path/query to the official canonical host while leaving media hosting intact. Rewrite trial was removed for a single actual route tree; repeated private navigation/API prefetching was corrected with no-prefetch sidebar links and a plain health-report anchor |
| System operations | PASS locally within app; provider operations delegated | Super Admin-only system page: configuration booleans, public-review control with atomic audit, existing AI panel and provider-console links. Cloudflare/Neon credentials never enter a browser form. Arbitrary secret/system editing is intentionally rejected |
| Media operations | PASS locally within existing workflows | Permission-scoped metadata browser, bounded pagination, links to existing business image management. No bulk deletion or object migration |
| One production ownership declaration | PASS declaration; runtime target match BLOCKED | Manifest declares existing Workers/R2/Neon production project and branch; static validator checks Worker identity. Exact DATABASE_URL target cannot be read from protected binding metadata |
| Both official domains / DNS / TLS | PASS control plane; functional production BLOCKED | Enabled apex+www custom domains → rega-platform, proxied provider-managed AAAA; active certificates, SSL full, Always HTTPS on. Latest control-plane target is rega24; independent browser/HTTP check unavailable in executor; browser connector UNAUTHORIZED |
| Secrets storage | PASS live | OpenAI/xAI converted atomically to secret_text, names/types of all 28 bindings preserved; no value output. Individual secret PUT rejected the existing plain-text name (400 binding conflict); atomic settings update succeeded (200) |
| Provider-key incident containment | BLOCKED | Storage conversion is not revocation. Provider admin credentials/secure rotation and GitHub protected replacement are unavailable; historical release hold remains |
| R2 canonical-origin configuration | PASS live | Added www/apex rega24.com to existing rule; preserved legacy origins, GET/HEAD/PUT, headers/ETag and max-age. GET readback matches intended policy. No upload or file modification performed |
| Log privacy | PASS live configuration / locally prepared app code | Both Workers redact query strings; binding types preserved and traces remain off. Prepared Auth.js logger omits raw provider messages/stacks. No new logging service |
| Database readiness and ownership | PASS bounded read-only SQL | Explicit project lucky-glitter-73195208 / production br-floral-hall-b22rpgrw: neondb, neondb_owner, PG18.6, 14 finished/0 unfinished migrations, 3 businesses/3 memberships. No SQL writes. Full backup/restore and runtime URL-to-branch matching unverified |
| One effective Super Admin | PASS source + aggregate SQL | One allowlisted owner, one additional stored active SUPER_ADMIN row. Existing effectiveRole demotes non-allowlisted row to USER across session/fresh guards. No role changes; effective privilege behavior covered by existing tests |
| Duplicate infrastructure | BLOCKED retirement | Pages total_count=0 in provider readback. Extra Worker rega has no custom domains/Builds triggers, but workers.dev/previews enabled. Callers/rollback not established, so preserved. Python Worker is required modular service, not duplicate hosting. Legacy media domain remains in use |
| One release quality gate | PASS prepared code; publication BLOCKED | Web/Python workflows check out same CI-verified SHA, main-only manual fallback, shared verified-release script checks successful current-main CI for exact SHA and account before building and again before deployment; rejects test-font mock environment and fails closed. Live web Builds command reverified dry-run; no duplicate production publish there |
| Dependency vulnerabilities | PASS local scan | npm audit after scoped patching: 0 info/low/moderate/high/critical. Zod4 omitted-field regressions protect PATCH semantics; no unsupported adapter downgrade, no audit fix --force. Not a proof that all security vulnerabilities are absent |
| Functionality / accessibility / SEO / performance | QA results below; production score BLOCKED | Synthetic local account/DB only, no provider inference or real email sends. No global 100/100 claim or current production Lighthouse measurement |
| Free-only and €0 additional infrastructure | PASS no additions; full billing attestation BLOCKED | Neon free_v3 / branch ceiling 10 verified. No paid activation, upgrades, new provider projects/buckets, inference calls or hosted production-browser jobs. PR73 triggered the old Neon workflow and created one two-week preview; creation is now prepared as opt-in. Cloudflare subscriptions API 403 requires Billing Read API-token connection; current subscription/spend cap cannot be certified |
| Production deployment | PASS config hardening; application BLOCKED | Existing-code config versions read back at 100%, below. New admin application was not merged/deployed; required security/release/access gates remain |
| Production data preservation | PASS no explicit writes | Only aggregate read-only production SQL; no migration, seeding, role change, object write/delete, resource/domain removal. Local disposable PostgreSQL contains synthetic fixtures only. This is not a byte-for-byte production backup certificate |

## Verification results

Local verification results (with isolated synthetic databases, without remote mail/inference): Logs are local artifacts under
`/tmp/rega24-*`; do not copy tokens, cookies, signed URLs or connection strings into this report.

- Ordinary Node build: blocked by executor policy denying Google Fonts CSS for Noto Sans Arabic.
- Functional Node build: uses a test-only mocked font response with real npm Noto Sans Arabic bytes. No production
  font/config change. These artifacts must never be deployed. Local browser QA proves behavior with this limitation.
- Security changes reuse scoped patches reviewed in existing PR71, without its social-feature schema/application
  changes. That PR remains separate and unmerged; its past green runs are not claimed as validation for this branch.
- Full unit/integration suite: **344 passed, 0 failed, 0 skipped** on a separate fresh local database. Subsequent focused redirect/release/PATCH checks passed, including new legacy-domain rule and superseded/wrong-account release rejection.
- Python engine suite: **7 passed** (mocked inference).
- Browser checks: **42 distinct selected scenarios passed**: auth/security/control-center (21), geography/CMS/content/session (16), business address/map/publication flows (5). Business tests initially rejected the new identity in an old mock and inherited non-deterministic geocoding configuration; mock identity and explicit test provider were corrected, then all five passed. No assertion was weakened.
- Accessibility: **8 axe analyses**, zero violations; en/ckb, 360px/1366px, system/media; no horizontal overflow. Screenshots visually inspected; artifacts `/workspace/artifacts/rega24-unified/`. This is not a full-platform or production audit.
- TypeScript and ESLint passed; offline validation: **8 documents, 387 source fingerprints, 107 environment names, 10 complete procedures**, local links/anchors valid. Negative control confirms manifest/Worker drift is rejected.
- Ordinary Workers build also **BLOCKED** at Google Fonts under enforced executor policy (after invalidating test webpack cache); no normal artifact claimed.
- Test-only functional OpenNext Workers build and Wrangler dry-run **PASS**; bundle **16009.65 KiB uncompressed / 3659.66 KiB gzip**, 283 assets. Current 64MiB uncompressed limit is respected; compressed size is not a plan detector.
- Built application in local workerd **PASS**: database/schema health, /dr → /admin redirect, anonymous sign-in privacy, protected API rejection, public business query and validation. No remote deployment occurred.
- Isolated media workerd test **PASS**: PNG/JPEG normalization, crop pixels, metadata stripping, invalid-file rejection and existing S3 upload to local fake storage. Final TypeScript/ESLint readbacks **PASS**.
- Native QA uses explicit local AUTH_URL, a local fake geocoder/basemap/providers and EMAIL_PROVIDER=none. No real messages or inference requests were sent. Temporary browser config and generated Python caches/lockfile were removed.

## Verified live changes and rollback

1. R2 CORS: `rega-media` rule originally allowed only old regaplatform.com www/apex. Now additionally allows official
   www/apex rega24.com. Same methods, headers, ETag exposure and max age. Targeted rollback removes only the newly
   added origins after independent verification; never delete the bucket, domain, objects or old origins.
2. Existing OpenAI/xAI values changed storage type to secret_text in one atomic Worker settings update. Every other
   binding name/type preserved (28 before/after). No secret values entered the model, filesystem, docs or logs.
   Do not roll back to plain_text or a pre-hardening version; provider-side revoke/rotate remains separate.
3. Both Workers enabled query-string redaction using settings-only updates. No new logs/traces destinations enabled.
   Maintain this privacy improvement in any later compatible application rollout.
4. Latest configuration deployments verified via Cloudflare API:
   - web deployment `66929254-3e9d-4b43-b70f-34f89389f60f`, version `93023599-8b90-48a2-9449-33ea286fa34e`, 100%;
   - Python deployment `57283b99-066e-4dbe-a1f1-a4010a88ca27`, version `b3e29ec6-d74c-4843-8b87-c110939d1987`, 100%.
   These do not contain the new /admin application. No Worker was replaced.

## Exact blockers and next safe actions

1. Provider-side OpenAI/xAI revoke/rotation and protected GitHub secret replacement need appropriate secure account
   access. Never submit keys in chat. Hardening storage alone does not clear the historical incident release hold.
2. Cloudflare Billing Read requires an API-token connection; current OAuth connection cannot access subscriptions
   (403, no covering OAuth scope). Do not create subscriptions or infer free status from usage_model/certificate type.
3. Complete production backup + isolated restore is still unverified in existing central memory. This task has no
   migration; it neither deletes backups nor clears another feature's release hold. Direct DB network/protected
   credential injection remains unavailable in the executor; no production dump/restore was attempted.
4. Normal build requires permitted font-host access (fonts.googleapis.com/fonts.gstatic.com) in the supported
   environment policy, or an explicitly reviewed equivalent self-hosting change. Test mocks cannot justify release.
5. Production browser connector requires reauthentication. Executor network excludes production hosts and has no
   protected GitHub/Cloudflare deploy credentials; do not bypass policy or protection. Restore approved access,
   publish/review this exact branch, run normal final-head CI, then existing main-only verified deployment workflows.
6. Before retiring rega Worker/old website domains, verify actual callers, redirects, monitoring, preview links,
   rollback and media/mail dependencies. Preserve current data and routes until migration is functionally verified.
7. After application deployment, verify active version/allocation, both domains, real authorized Super Admin login,
   all administrative operations and audit trail, media upload, representative public journeys, accessibility and
   actual Lighthouse/CWV measurements. Zero-cost provider entitlement must be established before inference tests.

A 100/100 score requires measurable current production evidence and resolved blockers. No such claim is made.


Current official Worker upload limits were retrieved through Cloudflare Docs on 2026-10-25: the September 4
[changelog](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/) removes historical
compressed 3MB/10MB limits; the [current limit](https://developers.cloudflare.com/workers/platform/limits/) is 64MiB
uncompressed on both plans. Do not infer a paid plan from compressed bundle size. Free CPU/request limits still
require actual runtime measurement; a local successful render is not proof of production Free-plan capacity.


Mail metadata continuation: connected Resend lists both canonical rega24.com and legacy regaplatform.com as verified,
sending enabled, region eu-west-1, open/click tracking off. No message sent and no domain changed; actual OTP/mail
receipt and Resend plan/billing remain unverified. Do not remove the legacy sender before dependent workflows migrate.


Integration of concurrently updated main: fetched 7011eb5 (documentation/tooling only) after local implementation
commit ce441c4. The local merge preserves its docs-only deployment guard, CI validation, agent rules and historic
memory. Compatibility generate/validate commands now delegate to one canonical checker/generator with JSON and
Markdown projections; one shared docs-only scope helper protects both services. The redundant separate docs check
workflow was removed. No application source changed in this merge, and no remote main update was performed.


Post-merge verification: no application/package/Worker configuration diff against ce441c4; the previously successful
application/Worker/browser checks therefore remain applicable. Shared-scope/release/identity/workflow checks:
17/17 PASS. TypeScript, ESLint, legacy CLI wrappers, manifest-drift and redacted secret-pattern controls PASS. Current
inventory: 8 documents, 387 tracked source fingerprints, 107 environment names, 10 complete incident procedures.


## October26 hosted verification and production-target reconciliation

- Published branch at 9276ed2; draft [PR73](https://github.com/rebar9988-max/Rega/pull/73), main still7011eb5.
  GitHub manual CLI dispatch failed Forbidden; PR CI40256084164 is running. No required check was bypassed.
- Cloudflare build f39a26b1-ee9d-4034-aaaf-042df45445f7 at exact9276ed2 **normal npm build PASS** (Node24.22.1,
  npm10.9.2). Then **preview FAIL**, missing previews block in Wrangler. This resolves normal hosted-build
  uncertainty for that head; it does not prove deployment, final-head CI or a working production office.
- The same build log contains a key-shaped OpenAI value in a diagnostic config suggestion. Only name/type and
  boolean pattern detection reached the model; no value was returned/copied. Original diagnostic-value source is
  UNKNOWN. Provider revoke/rotation and restricted historical-log handling remain required.
- Existing branch preview fcdb7c667f24407bae4c85b3c29423eb: scoped repair **PASS** HTTP200/readback,
  auto_build=false and deploy command `npx wrangler deploy --dry-run`. No new preview infrastructure added.
- PR opening triggered the old Neon workflow successfully, creating br-sparkling-thunder-b22kukdq with two-week TTL,
  expires November9, zero compute on readback. This is an automatic provider branch creation caused by this PR,
  superseding earlier no-provider-branch claims. No production SQL writes or branch deletion. Prepared creation now
  requires `neon-preview` label; existing close cleanup remains. Ordinary CI uses disposable Postgres.
- **New live evidence supersedes older target/version assertions:** rega-platform endpoint404; current rega24
  has same stable resource tag7b845cda2ee749c89c4f9b83490609b4/history and both official/legacy website domains.
  Version1a2c3a34-38d0-45fe-88d2-cd9144b0e02e/deployment3010f7a1-f41d-4938-917a-7bc666e89917 was discovered at100%.
  This session did not perform that rename/upload; exact deployed application SHA UNKNOWN.
- Prepared source now reconciles manifest/Wrangler/isolation guard/workflows with existing rega24. Shared read-only
  production preflight blocks missing/wrong-tag/permission/domain drift before release or secret sync, rather than
  recreating a retired target. R&L entries/resources untouched; package/service health identifier remains rega-platform.
- New active Worker had redaction=false. After ownership/tag verification, settings-only privacy repair **PASS**:
  HTTP200/readback true, all28 binding names/types unchanged, traces off/no destinations added. Current config
  deployment cf37b341-5e5c-4703-915b-731aeefa6bfd/version f7a118cd-6f64-4206-a19e-ec5b434a5bc9 at100%.
  No admin app upload or domain change. Initial malformed multipart rejected400, then corrected without value exposure.
- Latest Neon list still ten, but includes concurrent fresh backup br-broad-queen-b2f9p1p0 and child restore-verify
  br-proud-cloud-b2d38n80. Created by other work, not this session. Ready metadata alone does not certify restoration;
  do not repeat obsolete no-fresh-copy claim. No historical branches deleted by this session.
- Existing provider rotation, verified restoration, billing/protected-access and actual production QA holds remain.
  No100/100, no current free entitlement/invoice attestation, no application release from this branch.

Target reconciliation validation: 18 pipeline/identity/target tests PASS, including wrong/missing tag/service/domain, duplicate ownership, forbidden API, missing token, retired name and wrong account. TypeScript/ESLint PASS; all10 workflow YAML files parsed; docs validation PASS (8docs/388source fingerprints/107env names/10procedures). Executor policy re-read revision28: restricted/enforced, package-manager hosts plus binaries.prisma.sh only; no injected secrets/outbound identities. No policy bypass.

Latest shared-hub recovery evidence (2026-10-26, REPORTED from the completed parallel session, not independently repeated here): Neon-native reconstruction compared 37public tables/2325rows with matching row/schema/index/constraint digests and14migration records; four nullable social fields were rehearsed only on the isolated restore branch, never production. Backup and restore computes were suspended. This supersedes earlier absence-of-native-proof wording; it does not certify independent PG18 dump restore, functions/grants/enums or R2 backup, and does not clear remaining release holds. Reuse that completed investigation.
