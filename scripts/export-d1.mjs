// Read-only export from a LOCAL restored backup. No remote D1 or production write capability.
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync, chmodSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { modelsFromSchema, convert, sqlLiteral, hashRow, hashTable } from "./d1-values.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
execFileSync(process.execPath, ["scripts/project-identity-guard.mjs", "--project", "REGA"], { cwd: root, stdio: "inherit" });
const url = process.env.D1_RESTORE_DATABASE_URL;
if (!url) throw new Error("D1_RESTORE_DATABASE_URL must select a disposable local restored backup");
let parsed;
try { parsed = new URL(url); } catch { throw new Error("Invalid local restore connection configuration"); }
if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) || parsed.search || parsed.hash) {
  throw new Error("Only loopback PostgreSQL is accepted. Restore the backup locally first.");
}
const source = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const models = modelsFromSchema(source);
const quote = name => `"${name.replaceAll('"', '""')}"`;
const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 5000,
  types: {
    getTypeParser(oid, format) {
      // Prisma's TIMESTAMP WITHOUT TIME ZONE convention is UTC, independent of the export host's TZ.
      if (oid === 1114) return value => new Date(`${value.replace(" ", "T")}Z`);
      if (oid === 1082) return value => value;
      return pg.types.getTypeParser(oid, format);
    },
  },
});
let output;
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '30s'");
  const { rows: columns } = await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'");
  const expected = new Set(models.flatMap(m => m.fields.map(f => `${m.name}.${f.name}`)));
  const found = new Set(columns.filter(c => c.table_name !== "_prisma_migrations").map(c => `${c.table_name}.${c.column_name}`));
  if (expected.size !== found.size || [...expected].some(c => !found.has(c))) throw new Error("Backup schema differs from current models; reconcile before export");
  output = mkdtempSync(join(tmpdir(), "rega24-d1-export-"));
  chmodSync(output, 0o700);
  const sqlPath = join(output, "data.sql");
  writeFileSync(sqlPath, "-- PRIVATE REGA data; candidate rehearsal only.\nPRAGMA defer_foreign_keys=ON;\n", { mode: 0o600 });
  const manifest = { format: 1, project: "REGA", exportedAt: new Date().toISOString(), source: "local-restored-backup", schemaSha256: createHash("sha256").update(source).digest("hex"), tables: [] };
  for (const model of models) {
    const hashes = [];
    const select = model.fields.map(f => `${quote(f.name)}${f.type === "Json" ? "::text" : ""} AS ${quote(f.name)}`).join(",");
    for (let offset = 0; ; offset += 100) {
      const { rows } = await client.query(`SELECT ${select} FROM public.${quote(model.name)} ORDER BY ${model.primary.map(quote).join(",")} LIMIT 100 OFFSET $1`, [offset]);
      for (const row of rows) {
        const values = model.fields.map(f => convert(f, row[f.name]));
        hashes.push(hashRow(model.fields, values));
        appendFileSync(sqlPath, `INSERT INTO ${quote(model.name)} (${model.fields.map(f => quote(f.name)).join(",")}) VALUES (${values.map(sqlLiteral).join(",")});\n`);
      }
      if (rows.length < 100) break;
    }
    manifest.tables.push({ ...model, count: hashes.length, sha256: hashTable(hashes) });
  }
  const { rows: history } = await client.query('SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name');
  if (!history.length || history.some(m => !m.finished && !m.rolled_back)) throw new Error("Backup has incomplete or missing migration history");
  manifest.sourceMigrationHistory = history;
  await client.query("COMMIT");
  manifest.sqlSha256 = createHash("sha256").update(readFileSync(sqlPath)).digest("hex");
  writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`Private export completed: ${output}. Run verify-d1-export.py before using it.`);
} catch {
  // A pg error can contain source records or credentials; never echo it.
  await client.query("ROLLBACK").catch(() => {});
  console.error("Export failed; no remote changes. Check local restored-backup connectivity/schema and typed value compatibility privately.");
  if (output) console.error(`Incomplete private export (no valid manifest): ${output}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
