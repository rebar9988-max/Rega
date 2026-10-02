import { REQUIRED_CONTENT_COLUMNS } from "./schema-readiness";

type Column = { table_name: string; column_name: string };
type Migration = { migration_name: string; finished: boolean; rolled_back: boolean; checksum?: string };

/** Private operational metadata only: never include a URL, credential, record or database error. */
export function schemaRecoveryReport(columns: readonly Column[], migrations: readonly Migration[], connectionString?: string) {
  let provider = "unknown";
  try {
    const host = new URL(connectionString ?? "").hostname.toLowerCase();
    if (host.endsWith(".neon.tech")) provider = "neon";
    else if (host.endsWith(".supabase.co") || host.endsWith(".supabase.com")) provider = "supabase";
  } catch { /* Malformed configuration must not expose its value. */ }
  const present = new Set(columns.map((c) => `${c.table_name}.${c.column_name}`));
  const safeName = (name: string) => /^\d{14}_[a-z0-9_]+$/.test(name);
  return {
    mode: "read-only",
    provider,
    backupVerified: false,
    missingColumns: Object.fromEntries(Object.entries(REQUIRED_CONTENT_COLUMNS).map(([table, names]) => [table, names.filter((name) => !present.has(`${table}.${name}`))]).filter(([, names]) => names.length > 0)),
    appliedMigrations: migrations.filter((m) => m.finished && !m.rolled_back && safeName(m.migration_name)).map((m) => m.migration_name),
    appliedChecksums: Object.fromEntries(migrations.filter((m) => m.finished && !m.rolled_back && safeName(m.migration_name) && typeof m.checksum === "string" && /^[a-f0-9]{64}$/.test(m.checksum)).map((m) => [m.migration_name, m.checksum])),
    unfinishedMigrations: migrations.filter((m) => !m.finished && !m.rolled_back && safeName(m.migration_name)).map((m) => m.migration_name),
    unrecognizedMigrationNames: migrations.filter((m) => !safeName(m.migration_name)).length,
  };
}
