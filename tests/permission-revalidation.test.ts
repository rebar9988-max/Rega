import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as rbac from "../src/lib/rbac";

const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/auth-helpers.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type Actor = { id: string; role: rbac.Role; email: string; name: string };
function guards(row: Actor | null | Error, signedIn = true) {
  let queries = 0;
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/auth": { auth: async () => signedIn ? { user: { id: "actor", role: "SUPER_ADMIN", email: "old@example.org" } } : null },
    "@/lib/rbac": rbac,
    "@/lib/db": { prisma: { user: { findFirst: async (query: { where: { status: string; deletedAt: null } }) => {
      queries++;
      assert.equal(query.where.status, "active");
      assert.equal(query.where.deletedAt, null);
      if (row instanceof Error) throw row;
      return row;
    } } } },
  };
  const exports: { requirePermission?: (permission: rbac.Permission) => Promise<Actor>; requireStaff?: () => Promise<Actor> } = {};
  runInNewContext(compiled, { exports, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
    return modules[name];
  } });
  return { permission: exports.requirePermission!, staff: exports.requireStaff!, queries: () => queries };
}
const actor = (role: rbac.Role): Actor => ({ id: "actor", role, email: "current@example.org", name: "Current" });

test("demoted actors cannot use privileges cached in their JWT", async () => {
  await assert.rejects(guards(actor("USER")).permission("business.publish"), { status: 403 });
  await assert.rejects(guards(actor("BUSINESS_OWNER")).staff(), { status: 403 });
});

test("suspended or deleted accounts are rejected by permission and staff guards", async () => {
  await assert.rejects(guards(null).permission("business.write"), { status: 401 });
  await assert.rejects(guards(null).staff(), { status: 401 });
});

test("database failure never restores cached administrator privileges", async () => {
  const outage = new Error("database unavailable");
  await assert.rejects(guards(outage).permission("user.role"), outage);
  await assert.rejects(guards(outage).staff(), outage);
});

test("allowed requests return current account details and role", async () => {
  const current = actor("MANAGER");
  assert.equal(await guards(current).permission("business.publish"), current);
  assert.equal(await guards(current).staff(), current);
});

test("anonymous guards fail before querying the database", async () => {
  const guard = guards(actor("SUPER_ADMIN"), false);
  await assert.rejects(guard.permission("business.write"), { status: 401 });
  assert.equal(guard.queries(), 0);
});
