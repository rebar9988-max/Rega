import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { modelsFromSchema, convert, decimal, sqlLiteral, hashRow, hashTable } from "./d1-values.mjs";

const source = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const models = modelsFromSchema(source);
test("all current models have explicit scalar types and primary keys", () => {
  assert.equal(models.length, 36);
  assert.deepEqual(models.find(m => m.name === "Account").primary, ["provider", "providerAccountId"]);
  assert.equal(models.flatMap(m => m.fields).filter(f => f.array).length, 4);
});
test("NULL, JSON null and string arrays retain their distinct meaning", () => {
  const json = { name: "value", type: "Json", nullable: true };
  assert.equal(convert(json, null), null);
  assert.equal(convert(json, "null"), "null");
  assert.equal(convert({ name: "tags", type: "String", array: true }, ["کوردی", "O'Reilly"]), '["کوردی","O\'Reilly"]');
  assert.throws(() => convert({ name: "tags", array: true }, null));
  assert.throws(() => convert({ name: "tags", array: true }, [1]));
});
test("UTC instants and date-only values retain their cutoff", () => {
  assert.equal(convert({ type: "DateTime" }, new Date("2026-10-27T01:00:00+02:00")), Date.parse("2026-10-26T23:00:00Z"));
  assert.equal(convert({ type: "DateTime", day: true }, "2026-10-27"), Date.parse("2026-10-27T00:00:00Z"));
  assert.throws(() => convert({ type: "DateTime" }, "invalid"));
});
test("money range, invalid numbers, text and SQL quoting fail safely", () => {
  assert.equal(decimal("9999999999.99"), "9999999999.99");
  assert.equal(decimal("1.2"), "1.20");
  assert.throws(() => decimal("10000000000.00"));
  assert.throws(() => decimal("0.001"));
  assert.throws(() => convert({ type: "Float" }, Infinity));
  assert.throws(() => convert({ type: "Boolean" }, "true"));
  assert.throws(() => convert({ type: "String" }, "x\0y"));
  assert.equal(sqlLiteral("کوردی'; DROP TABLE User; --"), "'کوردی''; DROP TABLE User; --'");
});
test("cross-language SQLite rehearsal verifies all tables and detects tampering", () => {
  const folder = mkdtempSync(join(tmpdir(), "rega24-d1-fixture-"));
  const fixture = new Map();
  let sql = "PRAGMA defer_foreign_keys=ON;\n";
  for (const name of ["Business", "Service", "AuditLog", "Setting"]) {
    const fields = models.find(m => m.name === name).fields;
    const row = Object.fromEntries(fields.map(f => [f.name, f.nullable ? null : f.array ? [] : f.type === "Boolean" ? false : ["Int", "Float"].includes(f.type) ? 0 : f.type === "Json" ? "null" : f.type === "DateTime" ? new Date("2026-10-27T00:00:00Z") : "test"]));
    if (name === "Business") {
      row.name = "ڕێگا O'Reilly; DROP TABLE User; --";
      row.ratingAvg = 4.25;
      row.tags = ["کوردی", "العربية", "Türkçe"];
    }
    if (name === "Service") { row.priceFrom = "9999999999.99"; row.priceTo = "-0.01"; }
    if (name === "AuditLog") { row.before = null; row.after = "null"; }
    const values = fields.map(f => convert(f, row[f.name]));
    fixture.set(name, hashRow(fields, values));
    sql += `INSERT INTO "${name}" (${fields.map(f => '"' + f.name + '"').join(",")}) VALUES (${values.map(sqlLiteral).join(",")});\n`;
  }
  const sha = x => createHash("sha256").update(x).digest("hex");
  const manifest = { format: 1, project: "REGA", schemaSha256: sha(source), sqlSha256: sha(sql), tables: models.map(m => ({ ...m, count: fixture.has(m.name) ? 1 : 0, sha256: hashTable(fixture.has(m.name) ? [fixture.get(m.name)] : []) })) };
  writeFileSync(join(folder, "data.sql"), sql, { mode: 0o600 });
  writeFileSync(join(folder, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
  const run = () => spawnSync("python3", ["scripts/verify-d1-export.py", folder], { stdio: "inherit" });
  assert.equal(run().status, 0);
  writeFileSync(join(folder, "data.sql"), sql + "-- tampered\n");
  assert.notEqual(run().status, 0);
  const changedRow = sql.replace("4.25", "4.5");
  assert.notEqual(changedRow, sql);
  writeFileSync(join(folder, "data.sql"), changedRow);
  manifest.sqlSha256 = sha(changedRow);
  writeFileSync(join(folder, "manifest.json"), JSON.stringify(manifest));
  assert.notEqual(run().status, 0); // File checksum alone cannot hide a changed source row.
});
