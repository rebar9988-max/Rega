# Rega24: Neon to Cloudflare D1

Status on 2026-10-28: **COMPLETE — Production uses Cloudflare D1. Refreshed backup restored, all source data verified, exact-main CI/deployment and live production checks passed.**

Current evidence: [verified production cutover](evidence/d1-production-cutover-2026-10-28.json). The original archive/import below records the initial 2329-row snapshot; the final source reconciliation contains 2332 rows across the same 36 tables.

## Verified data

The supplied custom-format PostgreSQL archive `rega24-2026-10-27-212653.dump` was downloaded from the owner's private Drive backup folder. SHA-256: `4bfeb4beaab6f4655f7cac61c7e6b73fea121a6e194e902857b37fd1151116fb`. The archive was restored successfully into an isolated local PostgreSQL 17.11 server. It contains all 36 application models and completed PostgreSQL migration history. All36 restored table fingerprints matched the live Neon production source when checked. Earlier HTTP402/source-unavailable notes are superseded: source reads now work.

Existing EU D1 `rega24-migration` (`728f792d-37b6-49f8-abc1-e81512219f7d`) contains all2329 source records. [Import evidence](evidence/d1-data-import-2026-10-27.json) records counts and verification results without customer data. Remote verification compares every original scalar value using typed SHA-256 row hashes, including Unicode, line endings, arrays, dates, money and NULL. All36 tables match; foreign-key violations0. No production seed, demo user or password reset was performed. R2 media objects remain in their existing bucket; original references are preserved.

The initial import used41 journaled atomic batches. Exact hashing caught one newline-normalization error in an intermediate batching utility; a guarded parameterized correction restored that one description, and every table then matched. `prepare-d1-batches.py` now preserves bytes/line endings, with a CRLF/LF/CR/Unicode regression check.

## Runtime mapping

- PostgreSQL remains available through `REGA_DATABASE_PROVIDER=postgres` for baseline tests and recovery. Production candidate configuration selects `d1` and the existing `DB` binding. PostgreSQL source resources and credentials are retained.
- `prisma/schema.prisma` remains the source for application types and legacy PostgreSQL migrations. `prisma/d1/schema.prisma` generates a separate ignored SQLite client. `npm run db:generate` generates both clients and checks in static model metadata generated from the source schema (the client-engine DMMF omits essential defaults/cardinality information).
- String arrays use JSON but keep their JavaScript array API. Money is rounded to two decimal places before storage. Dates use UTC epoch milliseconds; adapter filter arguments are normalized to the same representation. SQL NULL and JSON null remain distinct in storage. Runtime migration0002 changes leaf JSON columns to TEXT to prevent SQLite numeric affinity changing scalar JSON values.
- Case-insensitive PostgreSQL searches use Unicode lowercase mirror columns, maintained on writes and backfilled on the imported data. These internal fields are omitted from client responses.
- PrismaD1's default non-atomic transaction emulation is explicitly rejected. Existing domain transactions plan parameterized writes and commit one native D1 atomic batch. A revision guard plus108 triggers detect concurrent changes and retry pure planning callbacks. Late failures commit nothing. Existing business publication rules, owner-only SUPER_ADMIN policy and auth/session secrets are preserved.
- Node development/tests use an owned local SQLite file through the same PrismaD1 adapter. Cloudflare uses the actual D1 binding with request-scoped primary sessions; no request's I/O objects are reused by another request.
- D1 health checks query real SQLite columns and the three real D1 migration records. No fabricated PostgreSQL migration history is used. The original PostgreSQL readiness path is retained.

All three D1 migrations were rehearsed on the real backup locally before remote application. Remote readback after runtime migrations and Unicode backfill still matches all2329 original records, with three D1 migrations,108 revision triggers and zero FK violations.

## Development and verification

Node22.16+ is required. For local D1 development:

```sh
npm ci
npm run db:generate
npm run db:d1:local
# Set REGA_DATABASE_PROVIDER=d1 and D1_SQLITE_PATH to the printed local file path.
npm run db:seed
npm run dev
```

The development initializer never opens a remote database. Browser fixtures require a randomly marked disposable directory created by `node scripts/init-local-d1.mjs --test`; neither production nor a restored customer backup passes that guard. Browser assertions run against both PostgreSQL and D1. CI retains the PostgreSQL service, all existing checks, and adds D1 native tests, a real local workerd/D1 binding test, and D1 Worker route readiness.

```sh
npm run test:d1
node scripts/health/d1-worker-smoke.mjs
node scripts/prepare-d1.mjs
python3 scripts/verify-d1-schema.py
D1_RESTORE_DATABASE_URL=<private-loopback-restore-url> node scripts/export-d1.mjs
python3 scripts/verify-d1-export.py <private-export-directory> --runtime
```

Source exports stay in private temporary directories with restrictive permissions. Do not commit dumps, manifests containing records, database files, credentials or signed download links.

## First production cutover

1. Require all hosted CI/browser/build/runtime checks on the exact reviewed release. The production workflow also checks successful push CI for the exact current main SHA, including manual releases, and verifies existing Worker/domain ownership.
2. Before activation, briefly freeze production requests using the existing early isolation guard. Verify that source writes have stopped; compare a final consistent Neon fingerprint with the restored/imported snapshot. If anything changed, reconcile those records and reverify every original value before proceeding.
3. Record exact release SHA, all-table verification and zero FK violations in the private target's `_RegaCutover` audit row. An operator publishes `REGA_D1_CUTOVER_PROOF` through authenticated Worker settings after directly verifying D1. It must match the exact release/database and the fresh `REGA_D1_FREEZE_NONCE`, include source/typed-manifest/backup SHA-256 hashes, all 36 tables, positive row count, zero FK violations, and verification after a 120-second drain. The CI reader uses its existing Workers permission; proofs expire after 15 minutes. `d1-release-readiness.mjs` blocks first deployment until this proof and the active source isolation flag match. A workflow waiting for readiness makes no deployment or database changes.
4. Release through the existing CI-gated `rega24` deployment path. Preserve existing secrets, domain routes, stable Worker identity, query redaction and service bindings. Candidate configuration sets the provider to D1 and clears temporary isolation. No new Neon/paid resources or deletion is required.
5. Read back active version/binding/settings and verify live health, public multilingual pages/search, private auth guards and existing media. Record the exact release and deployment evidence in shared memory and the central Google Doc.

After D1 accepts writes, rollback requires reconciling those writes before restoring a PostgreSQL Worker. Keep Neon and the original archive; never blindly flip back to an older snapshot.

## Operations after activation

D1 migrations: `npm run db:d1:migrate` applies committed SQL to the named existing target through Wrangler. `db:migrate` and the clearly named legacy PostgreSQL workflow remain PostgreSQL-only; they must not be used as a D1 migration command. Never use reset/push against production.

A D1 SQL backup can be taken with `npx wrangler d1 export rega24-migration --remote --output backups/rega24-d1-<UTC-stamp>.sql`. Keep it private and verify restoration into disposable local D1 before relying on it. PostgreSQL `scripts/backup.sh` backs up the retained legacy source only. Media needs its separate existing object-storage backup.

City slug search uses its own Unicode mirror in migration0003; existing URL values are unchanged. This was caught by the complete browser geography tests and is covered by an actual client integration query. Migration0002 was kept byte-for-byte unchanged.

## Readiness transport incident — 2026-10-28

PR #83 merged as `2da35b1` after successful hosted checks. The main CI also passed both 331-case browser suites and all unit/runtime/build checks. The first deployment stayed blocked even after the independently verified D1 audit row became ready. Production was restored to the original PostgreSQL application and live health 200 verified; the new application was not activated. The gate now consumes a fresh operator-issued snapshot attestation over its already authenticated Workers settings endpoint. No deployment-token permission expansion is required. Exact-main CI and ownership checks remain mandatory; source isolation, freeze nonce, drain interval, freshness and snapshot/backup hashes are checked.

Current snapshot: 2332 rows (four source tables changed after the original archive) matches all 36 source tables and every typed D1 value. A new private Drive archive was restored and read back with identical SHA-256: `59713feb5a4161a05ab50a1b1734352fcb7555d838d1625192dfaf8961b080d4`. The repaired gate passed for exact main `09afcd538a71fff6b08627057d272bf318e4362c`; activation and post-cutover verification are complete (see final evidence below).

## Verified production activation — 2026-10-28

Exact-main CI [40651797849](https://github.com/rebar9988-max/Rega/actions/runs/40651797849) passed 354 unit tests, 10 native D1 tests, 8 Python tests, both 331-case browser suites, real Worker runtime/routes, builds and the dependency audit (zero vulnerabilities). Release [40655046631](https://github.com/rebar9988-max/Rega/actions/runs/40655046631) passed ownership, exact-SHA readiness and deployment.

Source isolation was confirmed at `2026-10-28T08:14:46.811Z`. After draining in-flight requests, all 36 source fingerprints and every typed D1 scalar value matched the restored 2332-record snapshot. The original source remained unchanged when checked after activation. Target FK checks remained clean after the production browser checks.

Active Worker `rega24`: version `912d7b51-341a-4017-bed9-470cd1b39c1c`, deployment `97a07f0a-96e5-4bb5-a049-bbef69c74cea`, 100% traffic, version tag `09afcd538a71fff6b08627057d272bf318e4362c`. Binding `DB` uses existing EU database `728f792d-37b6-49f8-abc1-e81512219f7d`; provider is `d1`, isolation is `0`, query redaction is enabled. All 29 pre-cutover bindings (28 original plus temporary isolation) retain their names/types and original plain variable values. Both official domains and the stable Worker identity remain intact.

Fresh live health returned HTTP 200, `ok=true`, `databaseProvider=d1`, all migrations/content/config checks ready and no missing environment names. [Post-cutover health](https://github.com/rebar9988-max/Rega/actions/runs/40655046619) attempt 2 passed. [Production browser](https://github.com/rebar9988-max/Rega/actions/runs/40656143224) passed 201 checks, zero failures, on desktop and mobile, including search, geography, RTL/LTR, anonymous dashboard protection and public journeys. Live business and geography API data matched the pre-cutover responses exactly. Additional kmr/fa/tr pages returned 200 with expected direction/headings. A fresh browser confirmed eight visible images loaded, including both existing object-storage business images, with zero broken images. Configuration readiness is not a claim that a real customer's sign-in or outbound email was submitted; those flows were tested with disposable fixtures, without resetting production accounts.

The current private database archive is Drive file `1pLUm0lHDJoZ2r6iO2EhfXdIG0NQfHbnM`, 172260 bytes, SHA-256 `59713feb5a4161a05ab50a1b1734352fcb7555d838d1625192dfaf8961b080d4`; full restore and downloaded-byte verification passed. Neon and the original archive remain available for recovery. Media objects remain in existing object storage; the database archive covers their references. After D1 accepts writes, do not replay the original import/delta or blindly deploy PostgreSQL-only code: any return to Neon requires a fresh freeze, backup and reconciliation of new D1 writes. Operational snapshot proof/nonce remain audit metadata; subsequent releases verify the active D1 binding.
