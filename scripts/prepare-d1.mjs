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
  .replace('provider   = "prisma-client-js"', 'provider   = "prisma-client-js"\n  output     = "../../.generated/d1-client"')
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
console.log("D1 candidate generated. Runtime conversion and data verification are still required.");
