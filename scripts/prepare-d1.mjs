// Offline preparation only. Never connects to Neon or Cloudflare, or changes the active client.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
execFileSync(process.execPath, ["scripts/project-identity-guard.mjs", "--project", "REGA"], { cwd: root, stdio: "inherit" });
const source = readFileSync(`${root}prisma/schema.prisma`, "utf8");
if (!source.includes('provider  = "postgresql"')) throw new Error("Expected REGA PostgreSQL source schema");
let schema = source
  .replace(/^\/\/ Prisma schema[^]*?\ngenerator client/, '// STAGED D1 candidate; see docs/D1-MIGRATION.md. Not the active application schema.\ngenerator client')
  .replace('provider   = "prisma-client-js"', 'provider   = "prisma-client-js"\n  output     = "../../node_modules/@rega/d1-client"')
  .replace(/  \/\/ Rust-free[^\n]*\n/, "")
  .replace('provider  = "postgresql"', 'provider  = "sqlite"')
  .replace('url       = env("DATABASE_URL")', 'url       = "file:./rehearsal.db"')
  .replace(/  directUrl[^\n]*\n/, "")
  .replace(/String\[\](\s+)@default\(\[\]\)/g, 'Json$1@default("[]")')
  .replace(/\s+@db\.Decimal\(12, 2\)/g, "")
  .replace(/ @db\.Date/g, "")
  .split("\n").filter(line => !line.includes("type: Gin")).join("\n");
mkdirSync(`${root}prisma/d1/migrations`, { recursive: true });
writeFileSync(`${root}prisma/d1/schema.prisma`, schema);
const cli = `${root}node_modules/prisma/build/index.js`;
execFileSync(process.execPath, [cli, "validate", "--schema", "prisma/d1/schema.prisma"], { cwd: root, stdio: "inherit" });
const target = `${root}prisma/d1/migrations/0001_initial.sql`;
execFileSync(process.execPath, [cli, "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/d1/schema.prisma", "--script", "--output", target], { cwd: root, stdio: "inherit" });
let sql = readFileSync(target, "utf8");
// Prisma 6.19 emits unquoted JSON-array defaults; SQLite needs a SQL string literal.
sql = sql.replace(/DEFAULT \[\]/g, "DEFAULT '[]'");
// Prisma schemas cannot express these existing Postgres CHECK constraints.
const offer = readFileSync(`${root}prisma/migrations/20261020090000_business_whatsapp_offers/migration.sql`, "utf8");
const checks = [...offer.matchAll(/ALTER TABLE "Offer" ADD (CONSTRAINT "Offer_\w+_check" CHECK[^;]+);/g)].map(m => m[1]);
if (checks.length !== 2) throw new Error("Expected both original Offer checks");
sql = sql.replace(/(CREATE TABLE "Offer" \([^]*?)(\n\);)/, (_, body, end) => `${body},\n    ${checks.join(",\n    ")}${end}`);
const roles = source.match(/enum Role \{([^]*?)\n\}/)[1].split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//"));
sql = sql.replace(/("role" TEXT NOT NULL DEFAULT '[A-Z_]+')/g, `$1 CHECK ("role" IN (${roles.map(r => `'${r}'`).join(", ")}))`);
writeFileSync(`${root}prisma/d1/migrations/0001_initial.sql`, "-- Candidate schema for the migration target; production has not switched to D1.\n" + sql);
// Keep 0001 immutable in shape; runtime additions are a separate migration.
const folds = JSON.parse(readFileSync(`${root}src/lib/d1-fold-fields.json`, "utf8"));
let runtime = '-- D1 runtime support. Apply atomically before enabling the D1 application client.\nPRAGMA defer_foreign_keys=ON;\n';
let citySlug = '-- Unicode-insensitive city slug search; existing URL values are preserved.\n';
for (const [table, fields] of Object.entries(folds)) {
  for (const [field, folded] of Object.entries(fields)) {
    const body = source.match(new RegExp(`model ${table} \\{([\\s\\S]*?)\\n\\}`))[1];
    const nullable = new RegExp(`^\\s+${field}\\s+String\\?`, 'm').test(body);
    const declaration = `  ${folded} String${nullable ? '?' : ''}${nullable ? '' : ' @default("")'}`;
    schema = schema.replace(new RegExp(`(model ${table} \\{)`), `$1\n${declaration}`);
    const addition = `ALTER TABLE "${table}" ADD COLUMN "${folded}" TEXT${nullable ? '' : " NOT NULL DEFAULT ''"};\n`;
    if (table === "City" && field === "slug") citySlug += addition;
    else runtime += addition;
  }
}
// SQLite JSONB has NUMERIC affinity: scalar JSON numbers need TEXT columns for exact preservation.
// These are leaf tables: rebuilding them cannot cascade into another application table.
for (const table of ['Location', 'AuditLog', 'Setting']) {
  if (sql.includes(`REFERENCES "${table}"`)) throw new Error(`Unsafe leaf-table assumption: ${table}`);
  const definition = sql.match(new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\n\\);`))[0];
  const temporary = `__rega_new_${table}`;
  runtime += definition.replace(`CREATE TABLE "${table}"`, `CREATE TABLE "${temporary}"`).replace(/ JSONB/g, ' TEXT') + '\n';
  runtime += `INSERT INTO "${temporary}" SELECT * FROM "${table}";\nDROP TABLE "${table}";\nALTER TABLE "${temporary}" RENAME TO "${table}";\n`;
  for (const index of sql.matchAll(new RegExp(`CREATE (?:UNIQUE )?INDEX [^;]+ ON "${table}"[^;]+;`, 'g'))) runtime += index[0] + '\n';
}
runtime += 'CREATE TABLE "_RegaRevision" (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CONSTRAINT RegaRevision_nonnegative CHECK(revision>=0));\nINSERT INTO "_RegaRevision" VALUES(1,0);\n';
for (const [, table] of source.matchAll(/^model (\w+)/gm)) {
  for (const event of ['INSERT', 'UPDATE', 'DELETE']) runtime += `CREATE TRIGGER "_rega_revision_${table}_${event}" AFTER ${event} ON "${table}" BEGIN UPDATE "_RegaRevision" SET revision=revision+1 WHERE id=1; END;\n`;
}
writeFileSync(`${root}prisma/d1/schema.prisma`, schema);
writeFileSync(`${root}prisma/d1/migrations/0002_runtime.sql`, runtime);
writeFileSync(`${root}prisma/d1/migrations/0003_city_slug_fold.sql`, citySlug);
console.log("D1 candidate generated. Runtime conversion and data verification are still required.");
