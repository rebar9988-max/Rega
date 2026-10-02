#!/usr/bin/env bash
# REGA platform backup: PostgreSQL dump + media bucket sync.
# Usage: DATABASE_URL=... MEDIA_BUCKET=... MEDIA_ACCESS_KEY_ID=... \
#        MEDIA_SECRET_ACCESS_KEY=... MEDIA_ENDPOINT=... bash scripts/backup.sh
set -euo pipefail

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"

: "${DATABASE_URL:?DATABASE_URL is required}"

echo "[1/3] dumping database -> $DIR/db-$STAMP.sql.gz"
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$DIR/db-$STAMP.sql.gz"

echo "[2/3] dumping schema -> $DIR/schema-$STAMP.sql"
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > "$DIR/schema-$STAMP.sql"

if [ -n "${MEDIA_BUCKET:-}" ]; then
  echo "[3/3] syncing media bucket '$MEDIA_BUCKET' -> $DIR/media"
  rclone sync "s3:${MEDIA_BUCKET}" "$DIR/media" --fast-list --transfers 8
else
  echo "[3/3] MEDIA_BUCKET not set - skipping media sync"
fi

echo "done. Keeping the 14 most recent database dumps."
ls -1t "$DIR"/db-*.sql.gz | tail -n +15 | xargs -r rm --
