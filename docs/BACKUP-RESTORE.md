# Backup and restore

The data that matters is the PostgreSQL database and the media bucket. Code is in git.

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

To go back to a dump in production, restore into a *new* database, check it, then switch `DATABASE_URL` /
the Hyperdrive binding to it. Do not drop the damaged database until the new one has been verified.

## Rehearsal

Restore the latest dump into a scratch database once per quarter and run `npx prisma migrate status` and
`npm run e2e` against it (E2E refuses to run against anything that looks like production).
