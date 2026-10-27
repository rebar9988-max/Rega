// Initializes a local SQLite/D1 development database; never opens a remote database.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, mkdtempSync, readFileSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

execFileSync(process.execPath, ["scripts/project-identity-guard.mjs", "--project", "REGA"], { stdio: "inherit" });
const test = process.argv.includes("--test");
const path = test ? join(mkdtempSync(join(tmpdir(), "rega-d1-e2e-")), "test.sqlite") : resolve(process.env.D1_SQLITE_PATH || ".local/rega.sqlite");
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(path);
chmodSync(path, 0o600);
db.exec("PRAGMA foreign_keys=ON;");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
if (tables.length && !tables.some(t => t.name === "d1_migrations")) throw new Error("Local initialization refused: existing untracked database contents");
db.exec("CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);");
for (const name of ["0001_initial.sql", "0002_runtime.sql"]) {
  if (db.prepare("SELECT 1 FROM d1_migrations WHERE name=?").get(name)) continue;
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.exec(readFileSync(`prisma/d1/migrations/${name}`, "utf8"));
    db.prepare("INSERT INTO d1_migrations(name) VALUES(?)").run(name);
    db.exec("COMMIT;");
  } catch (error) { db.exec("ROLLBACK;"); throw error; }
}
if (test) {
  db.exec("CREATE TABLE _RegaTestOnly(id INTEGER PRIMARY KEY CHECK(id=1),marker TEXT NOT NULL);");
  db.prepare("INSERT INTO _RegaTestOnly VALUES(1,?)").run(randomUUID());
}
db.close();
console.log(path);
