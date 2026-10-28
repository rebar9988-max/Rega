# Backup and restore

Production data lives in **Cloudflare D1 and Cloudflare R2**. Code is in GitHub. Follow the [Cloudflare platform mandate](../CLAUDE.md#09-permanent-cloudflare-platform-mandate-owner-instruction-2026-10-28) and [verified D1 migration/recovery procedure](D1-MIGRATION.md).

## Production D1 and R2

Before a D1 migration, export the existing database privately with `npx wrangler d1 export rega24-migration --remote --output <private-path>.sql`. Verify restoration into a disposable local D1/SQLite database, including table counts, typed values and FK integrity; retain a separate copy outside the executor. Never commit dumps or restore over the active database as a rehearsal. Back up R2 objects separately: a database archive contains media references, not the image/file bytes. Preserve the verified Drive archives and retained Neon recovery source. Returning to PostgreSQL requires explicit owner direction and reconciliation of writes made after D1 activation.

The PostgreSQL commands below apply only to the retained legacy source. `npm run backup` does not back up active D1. Customer-backup restore checks must use dedicated scratch databases; browser E2E fixtures must use separately created disposable test databases, never restored customer data.

## Back up

```bash
# Needs pg_dump (and rclone configured as remote "s3" if the media bucket should be copied too).
DATABASE_URL=… [MEDIA_BUCKET=…] npm run backup        # = bash scripts/backup.sh
```

Writes `backups/db-<UTC stamp>.sql.gz` (data + schema), `backups/schema-<stamp>.sql` and, when `MEDIA_BUCKET` is set, a copy
of the bucket under `backups/media`. The 14 newest database dumps are kept. Use a **direct** (non-pooled) connection string.
Store dumps outside the machine that runs the database. Never commit a dump or a connection string.

**Before every production migration:** take a dump first (`db-migrate.yml` applies only committed, additive migrations;
it never resets, drops or truncates).

## Restore (into an empty database, never over production)

```bash
createdb rega_restore
gunzip -c backups/db-<stamp>.sql.gz | psql "$RESTORE_DATABASE_URL"
DATABASE_URL="$RESTORE_DATABASE_URL" npx prisma migrate status     # must report "up to date"
```

For an explicitly authorized legacy recovery, restore into a new database and verify it. Changing `DATABASE_URL` does not switch the active D1 provider. Follow the D1 recovery procedure and reconcile subsequent D1 writes before any production provider change; retain the existing database.

## Rehearsal

Restore the latest legacy dump into a dedicated scratch database and verify migrations, counts and values read-only. Run E2E separately against owned disposable fixtures, never against a customer archive or production.
