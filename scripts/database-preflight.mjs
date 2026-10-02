// Production diagnostics only: no application records, credentials or connection URLs are printed.
import pg from "pg";
import { readdir } from "node:fs/promises";

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Database preflight unavailable: protected database configuration is missing.");
  process.exit(1);
}
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const names = new Set(tables.rows.map((r) => r.table_name));
  const committed = (await readdir(new URL("../prisma/migrations/", import.meta.url), { withFileTypes: true })).filter((f) => f.isDirectory()).map((f) => f.name).sort();
  const migrationRows = names.has("_prisma_migrations")
    ? (await client.query('SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations"')).rows
    : [];
  const applied = new Set(migrationRows.filter((r) => r.finished && !r.rolled_back).map((r) => r.migration_name));
  const columns = (await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('City', 'Page', 'Listing')")).rows;
  let reviewAssociations = null;
  if (names.has("Review") && names.has("User")) {
    const result = await client.query(`SELECT
      (SELECT count(*) FROM "Review" r WHERE r."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = r."userId")) AS orphaned,
      (SELECT count(*) FROM (SELECT "businessId", "userId" FROM "Review" WHERE "userId" IS NOT NULL GROUP BY "businessId", "userId" HAVING count(*) > 1) d) AS duplicate_groups`);
    reviewAssociations = result.rows[0];
  }
  await client.query("ROLLBACK");
  console.log(JSON.stringify({ mode: "read-only", backupVerified: false,
    pendingMigrations: committed.filter((name) => !applied.has(name)),
    unknownAppliedMigrations: [...applied].filter((name) => !committed.includes(name)),
    unfinishedMigrations: migrationRows.filter((r) => !r.finished && !r.rolled_back).map((r) => r.migration_name),
    missingContentTables: ["City", "Page", "Listing"].filter((name) => !names.has(name)),
    contentColumns: columns, reviewAssociations,
  }, null, 2));
} catch (error) {
  // Server errors can contain connection/user information; expose only a standard diagnostic code.
  console.error(JSON.stringify({ mode: "read-only", errorCode: typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "PREFLIGHT_FAILED" }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
