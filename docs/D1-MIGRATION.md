# Rega24: Neon to Cloudflare D1

Status on 2026-10-27: **BACKUP RESTORED AND ALL DATA IMPORTED/VERIFIED. Application release verification is in progress; production has not switched.**

## Verified data

The supplied custom-format PostgreSQL archive `rega24-2026-10-27-212653.dump` was downloaded from the owner's private Drive backup folder. SHA-256: `4bfeb4beaab6f4655f7cac61c7e6b73fea121a6e194e902857b37fd1151116fb`. The archive was restored successfully into an isolated local PostgreSQL 17.11 server. It contains all36 application models and completed PostgreSQL migration history. All36 restored table fingerprints matched the live Neon production source when checked. Earlier HTTP402/source-unavailable notes are superseded: source reads now work.

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
3. Record exact release SHA, all-table verification and zero FK violations in the private target's `_RegaCutover` readiness row. `d1-release-readiness.mjs` blocks first deployment until that row matches. A workflow waiting for readiness makes no deployment or database changes.
4. Release through the existing CI-gated `rega24` deployment path. Preserve existing secrets, domain routes, stable Worker identity, query redaction and service bindings. Candidate configuration sets the provider to D1 and clears temporary isolation. No new Neon/paid resources or deletion is required.
5. Read back active version/binding/settings and verify live health, public multilingual pages/search, private auth guards and existing media. Record the exact release and deployment evidence in shared memory and the central Google Doc.

After D1 accepts writes, rollback requires reconciling those writes before restoring a PostgreSQL Worker. Keep Neon and the original archive; never blindly flip back to an older snapshot.

## Operations after activation

D1 migrations: `npm run db:d1:migrate` applies committed SQL to the named existing target through Wrangler. `db:migrate` and the clearly named legacy PostgreSQL workflow remain PostgreSQL-only; they must not be used as a D1 migration command. Never use reset/push against production.

A D1 SQL backup can be taken with `npx wrangler d1 export rega24-migration --remote --output backups/rega24-d1-<UTC-stamp>.sql`. Keep it private and verify restoration into disposable local D1 before relying on it. PostgreSQL `scripts/backup.sh` backs up the retained legacy source only. Media needs its separate existing object-storage backup.

City slug search uses its own Unicode mirror in migration0003; existing URL values are unchanged. This was caught by the complete browser geography tests and is covered by an actual client integration query. Migration0002 was kept byte-for-byte unchanged.
