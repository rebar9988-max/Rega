# Rega24: Neon to D1 migration preparation

Status: **TARGET SCHEMA APPLIED — data import and application cutover incomplete; production still uses PostgreSQL.**

## Verified starting point — 2026-10-27

- Repository and local baseline: `rebar9988-max/Rega`, `c8f0cf2ac859414f48fd8dd080484f587b661679` (also GitHub main when checked).
- Canonical Worker: `rega24`; active deployment `5b341ca4-f063-4358-af07-427bac5c8d3e`, version `5ab5e7d5-2c4d-4f98-aaad-6074dfeb69f5`, 100%, source tag matching the baseline. Query-string redaction enabled.
- Neon project `lucky-glitter-73195208`, named `Rega24`: bounded `SELECT 1` failed with HTTP 402, quota exceeded. Source data cannot currently be exported through this connection.
- Existing D1 `rega24-migration`, ID `728f792d-37b6-49f8-abc1-e81512219f7d`, EU jurisdiction: list response reports zero tables. No D1 binding on the production Worker. This task created neither resource nor binding.
- Owner confirms an existing backup/export is available; file not yet supplied or validated. No assumption about its freshness, contents or recoverability.

## Offline preparation

The separate [candidate schema](../prisma/d1/schema.prisma) and [initial SQL](../prisma/d1/migrations/0001_initial.sql) do not replace the active [PostgreSQL schema](../prisma/schema.prisma). They are not referenced by application builds or migration workflows. The initial schema was applied to the existing, disconnected migration D1 after verifying it contained no application tables; production was not switched.

Regenerate and verify from the repository root with installed project dependencies:

```sh
node scripts/prepare-d1.mjs
python3 scripts/verify-d1-schema.py
```

The generator runs the project identity guard and Prisma 6.19.3 validation/diff locally. It gives the candidate a separate client output, converts four scalar arrays (`Business.tags`, `languages`, `photos`, `JobDetails.languages`) to JSON, removes four PostgreSQL GIN indexes and native database type annotations, quotes JSON defaults, and preserves existing Offer CHECK constraints and allowed role values in SQL. It performs no remote operation. Review regenerated SQL before use.

The verification uses in-memory SQLite, checks every model's scalar column names, JSON defaults, Kurdish text, Offer date/discount rules, role rejection, foreign-key rejection and cascade. It does not prove D1 runtime or Prisma driver behavior. `DECIMAL` in SQLite does not provide PostgreSQL fixed-scale guarantees; final money representation and exact round-trip tests remain required.

## Required implementation before cutover

| Area | Current dependency | Required work |
| --- | --- | --- |
| Runtime | `src/lib/db.ts`, `src/lib/db.workers.ts`: PrismaPg/pg | D1 adapter/binding; correct request-scoped runtime context; local development parity. Preserve isolated preview guards. |
| Writes/concurrency | Callback `$transaction` in content/business/location/moderation APIs; `pg_advisory_xact_lock` | Redesign as D1 atomic batches/conditional writes with race tests for approve/edit/archive, duplicate submission and primary locations. Never substitute a no-op transaction wrapper. |
| Arrays | Four string arrays become JSON | Typed input/output conversion and validation at all callers, without changing public API shape. |
| Search | `mode: "insensitive"`, PostgreSQL GIN/trigram indexes | Explicit case/Unicode semantics and suitable SQLite queries/indexes. Test all seven locales. |
| SQL | Health uses Postgres catalogs/casts; sitemap uses raw SQL | SQLite/D1 queries and migration/readiness checks. Do not fabricate old `_prisma_migrations` history. |
| Types | Decimal, DateTime, JSON, booleans, role enum | Preserve precision, UTC instant/day semantics, SQL NULL versus JSON null, and existing auth/RBAC behavior. |
| Delivery | CI, seeds, backup, migration workflow, inventory and environment validation require PostgreSQL | Add D1 migration/runtime/integration checks; update operational docs and recovery. Keep hosted CI and identity/ownership gates. |

## Data and release sequence

1. Obtain the owner's backup through file attachment or an accessible private file location. Keep backup contents outside tracked paths; no credential values in chat or documentation.
2. Inspect format and timestamp without dumping records; restore into a disposable local PostgreSQL instance, never execute an unreviewed dump against production. Compare backup schema with current models/migrations. State the backup's recovery cutoff and any data lost since it was made.
3. Produce a private manifest of row counts and stable hashes from a consistent snapshot. Preserve primary IDs, relationships, password hashes, settings, translations and media references. R2 objects stay separate from the SQL migration. Do not seed demo users/content into the target.
4. Finalize runtime/schema mapping above, rehearse export/conversion/import locally, verify per-table counts/hashes, foreign keys and representative auth/content operations. Plain Postgres SQL is not valid D1 input; use a typed conversion, not search-and-replace of a dump.
5. Recheck the exact account/database identity and target emptiness, import schema/data into the existing migration D1, and verify remotely. Do not overwrite a populated target or provision a replacement silently.
6. Run full hosted checks and D1/workerd integration/browser checks on the final revision. Freeze writes during the final snapshot/cutover or use a verified delta strategy. Release through the existing main CI-gated deployment path with the correct version annotation and retained query redaction.
7. Verify live health, sign-in, owner-only dashboard access, search, content, money/dates and media, then update shared memory/map/runbook with actual evidence. Keep Neon and the private backup for recovery. Once D1 accepts writes, rollback requires reconciliation of those writes, not merely restoring the old Worker.

The disconnected D1 target schema was created. No production binding, production schema/data, secrets, routes, application deployment or paid plan was changed. Backup validation, runtime conversion, data import and cutover remain outstanding.


## Continuation evidence — 2026-10-27

- Existing Neon backup branch `backup-rega24-20261026-pre-release` (`br-broad-queen-b2f9p1p0`) and restore-verification branch exist. A bounded SELECT1 against the backup branch also returns402. The old native snapshot is dated2026-10-02, not a fresh downloadable export. No branch/snapshot was restored, deleted or newly created.
- Local `/workspace` and `/tmp` searches found migration SQL but no source data dump. Drive keyword/metadata searches returned no export; the Rega24 folder contains Branding. Drive search is not proof that no archive exists because the connector filters supported file types. Owner-provided backup location/file remains necessary.
- After exact account/target-name/UUID checks and a fresh empty-target read, D1 accepted all105 schema statements (HTTP200). Readback confirms all36 model tables and every scalar column match the local candidate; all application row counts are0; `PRAGMA foreign_key_check` returns no violations. Worker readback still has noD1binding and query redaction remains true.
- One read-only verification query exceeded D1's compound-SELECT term limit. Separate count statements succeeded; no data/schema correction was needed. Do not use the large UNION approach in the final verifier.

## Private data export and rehearsal tools

After restoring the supplied backup into a disposable LOCAL PostgreSQL database, configure `D1_RESTORE_DATABASE_URL` through the private execution environment and run:

```sh
node scripts/export-d1.mjs
python3 scripts/verify-d1-export.py /tmp/rega24-d1-export-<generated-directory>
node --test scripts/d1-values.test.mjs
```

The exporter accepts only a loopback Postgres URL without query overrides. It opens a repeatable-read, read-only transaction, checks exact scalar-column coverage, requires completed source migration history, and writes private SQL/manifest files under a mode0700 temporary directory (mode0600 files). It never contacts D1 or changes source records. Source errors are redacted. UTC timestamp/date parsing is independent of the execution host's timezone. SQL NULL and JSON null are retained separately; arrays remain typed string arrays encoded as JSON. Unexpected NULLs/types/ranges abort the export rather than silently coercing data. It intentionally does not recreate Postgres migration history in D1.

The separate verifier restores only into in-memory SQLite, checks the source-schema fingerprint and file checksum, then compares every table's row count and hash over every typed value. Float hashes use IEEE754 bytes; Decimal values are compared at the source's two-decimal scale. The data SQL cannot attach files or alter/drop/update/delete schemas or records in the verifier. Unit/rehearsal fixtures cover multilingual and apostrophe/injection text, NULL versus JSON null, four string-array fields in schema, UTC/day values, numeric boundaries, file tampering and changed-row detection even after recalculating the file checksum. Fixtures are local test data only.

These tools are not a completed backup validation, remote data import, application runtime conversion, end-to-end test or production certification. No real source export was possible in this session.
