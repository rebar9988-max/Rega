import test from "node:test";
import assert from "node:assert/strict";
import { schemaRecoveryReport } from "../src/lib/schema-recovery-report";
import { REQUIRED_CONTENT_COLUMNS } from "../src/lib/schema-readiness";

test("private recovery metadata identifies schema drift without exposing connection details", () => {
  const columns = Object.entries(REQUIRED_CONTENT_COLUMNS).flatMap(([table_name, names]) => names.map((column_name) => ({ table_name, column_name }))).filter((c) => c.table_name !== "Page" && !(c.table_name === "City" && c.column_name === "nameFa"));
  const report = schemaRecoveryReport(columns, [
    { migration_name: "20260926225423_init", finished: true, rolled_back: false },
    { migration_name: "20261002090000_growth_foundation", finished: false, rolled_back: false },
    { migration_name: "20261002120000_content_sections_core", finished: false, rolled_back: true },
    { migration_name: "postgresql://private-user:private-password@private-host/db", finished: true, rolled_back: false },
  ], "postgresql://private-user:private-password@private-project.neon.tech/private-db?token=private-token");
  assert.equal(report.provider, "neon");
  assert.deepEqual(report.missingColumns.City, ["nameFa"]);
  assert.deepEqual(report.missingColumns.Page, REQUIRED_CONTENT_COLUMNS.Page);
  assert.deepEqual(report.appliedMigrations, ["20260926225423_init"]);
  assert.deepEqual(report.unfinishedMigrations, ["20261002090000_growth_foundation"]);
  assert.equal(report.unrecognizedMigrationNames, 1);
  assert.equal(report.backupVerified, false);
  assert.ok(!JSON.stringify(report).includes("private-"));
});

test("provider detection neither guesses an unknown provider nor accepts a misleading hostname", () => {
  for (const url of [undefined, "invalid-private-config", "postgresql://user:password@neon.tech.evil.example/db", "postgresql://user:password@unidentified.example/db"]) {
    assert.equal(schemaRecoveryReport([], [], url).provider, "unknown");
  }
  assert.equal(schemaRecoveryReport([], [], "postgresql://user:password@aws.pooler.supabase.com/db").provider, "supabase");
});
