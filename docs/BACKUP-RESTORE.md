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

The verified REGA production server is PostgreSQL 18.6 (2026-10-25). Use PostgreSQL 18 or newer `pg_dump`
and an isolated PostgreSQL 18 restore target; a PostgreSQL 16 client cannot dump this server.
Record the dump checksum, restore exit status, migration ledger, exact table counts and business/membership
digests from the same consistent backup point. Never publish an unencrypted database dump in public CI artifacts.

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

## PR #71 recovery constraints (2026-10-25)

The production branch is `br-floral-hall-b22rpgrw` in REGA project `lucky-glitter-73195208`.
Fresh snapshot creation returned HTTP 422 `snapshots limit exceeded`; the existing manual snapshot from
2026-10-02 is not a verified current backup. The free branch limit is also full (10/10).
Do not delete the only snapshot or an existing backup to make room, and do not upgrade the plan.
Cleanup of existing non-production copies requires an identified target and owner authorization.
An alternative is the existing `scripts/backup.sh` through an authorized direct connection, followed by
the isolated restore proof above. Executor network-policy denial must be resolved through the environment
configuration workflow; never bypass its proxy or TLS checks. Until backup and restore succeed, migration is blocked.
