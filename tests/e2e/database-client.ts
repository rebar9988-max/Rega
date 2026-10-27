/** Same browser assertions for either provider, always against an explicitly disposable database. */
import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeClient } from "../../src/lib/db-node-client";
import { usesD1 } from "../../src/lib/d1-connection";
import { d1Models } from "../../src/lib/d1-models";

export function assertLocalD1TestFile() {
  const file = process.env.D1_SQLITE_PATH;
  if (!file || !realpathSync(file).startsWith(join(realpathSync(tmpdir()), "rega-d1-e2e-"))) throw new Error("E2E refused: D1 file is not in an owned disposable test directory");
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const marker = db.prepare('SELECT marker FROM "_RegaTestOnly" WHERE id=1').get();
    if (!marker || typeof marker.marker !== "string" || marker.marker.length < 20) throw new Error("E2E refused: D1 test marker is absent");
  } finally { db.close(); }
}
export function testDatabaseClient() {
  if (usesD1()) assertLocalD1TestFile();
  return createNodeClient();
}
const dates = new Set([...d1Models.values()].flatMap(m => m.fields.filter(f => f.type === "DateTime").map(f => f.name)));
export function testSqlClient() {
  if (usesD1()) assertLocalD1TestFile();
  const sqlite = usesD1() ? new DatabaseSync(process.env.D1_SQLITE_PATH!) : null;
  sqlite?.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  const postgres = sqlite ? null : new pg.Client({ connectionString: process.env.DATABASE_URL });
  return {
    async connect() { if (postgres) await postgres.connect(); },
    async end() { if (postgres) await postgres.end(); else sqlite!.close(); },
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, values: unknown[] = []) {
      if (postgres) return postgres.query<T>(sql, values);
      const args: (string | number | null)[] = [];
      const text = sql.replace(/\$(\d+)/g, (_, n) => { args.push(values[Number(n) - 1] as string | number | null); return "?"; })
        .replace(/\bnow\(\)/gi, "CAST(unixepoch('subsec')*1000 AS INTEGER)");
      const statement = sqlite!.prepare(text);
      if (statement.columns().length) {
        const rows = statement.all(...args).map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, dates.has(k) && v != null ? new Date(v as string | number) : v]))) as T[];
        return { rows, rowCount: rows.length };
      }
      const result = statement.run(...args);
      return { rows: [] as T[], rowCount: Number(result.changes) };
    },
  };
}
