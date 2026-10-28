/** Local D1-compatible SQLite binding for development and integration tests. Never imported by Workers. */
import { DatabaseSync } from "node:sqlite";
import type { D1Connection, D1Statement, D1Value } from "./d1-connection";

export function localD1(path: string): D1Connection {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  class Statement implements D1Statement {
    constructor(readonly sql: string, readonly args: D1Value[] = []) {}
    bind(...args: D1Value[]) { return new Statement(this.sql, args); }
    private native() { return db.prepare(this.sql); }
    private params() { return this.args.map(v => v instanceof ArrayBuffer ? new Uint8Array(v) : v); }
    evaluate() {
      const stmt = this.native();
      if (stmt.columns().length) return { success: true, results: stmt.all(...this.params()), meta: { changes: 0 } };
      const result = stmt.run(...this.params());
      return { success: true, results: [], meta: { changes: Number(result.changes) } };
    }
    async all<T = Record<string, unknown>>() { return this.evaluate() as { success: boolean; results: T[]; meta: { changes: number } }; }
    async run() { const result = this.native().run(...this.params()); return { success: true, meta: { changes: Number(result.changes) } }; }
    async raw(options?: { columnNames?: boolean }) {
      const stmt = this.native();
      const names = stmt.columns().map(c => c.name);
      stmt.setReturnArrays(true);
      const rows = stmt.all(...this.params()) as unknown as unknown[][];
      return options?.columnNames ? [names, ...rows] : rows;
    }
  }
  return {
    prepare: sql => new Statement(sql),
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map(s => {
          if (!(s instanceof Statement)) throw new Error("Statement belongs to another SQLite binding");
          return s.evaluate();
        });
        db.exec("COMMIT");
        return results;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
}
