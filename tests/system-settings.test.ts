import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { isManagedFlag } from "../src/lib/control-center";

function action({ allowed = true, auditFails = false } = {}) {
  let committed = false, audited = false, called = false;
  const mutations: unknown[] = [];
  const actionModule = { exports: {} as { setSystemFlag(form: FormData): Promise<void> } };
  class HttpError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
  const modules: Record<string, unknown> = {
    "@/lib/auth-helpers": { HttpError, requirePermission: async (permission: string) => {
      assert.equal(permission, "settings.write");
      if (!allowed) throw new HttpError(403, "forbidden", "Forbidden");
      return { id: "owner", email: "qa@example.org" };
    } },
    "@/lib/control-center": { isManagedFlag },
    "next/cache": { revalidatePath: () => assert.ok(committed) },
    "@/lib/db": { prisma: { $transaction: async (work: (tx: unknown) => Promise<void>) => {
      called = true;
      await work({ featureFlag: { findUnique: async () => ({ enabled: true, rollout: 100 }), upsert: async (input: unknown) => mutations.push(input) },
        auditLog: { create: async (input: { data: { action: string; entityId: string } }) => {
          assert.equal(input.data.action, "system.featureflag.update");assert.equal(input.data.entityId, "public.reviews");
          if (auditFails) throw new Error("audit unavailable");audited = true;
        } } });
      committed = true;
    } } },
  };
  const source = ts.transpileModule(readFileSync("src/app/admin/system/actions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { module: actionModule, exports: actionModule.exports, require: (id: string) => { assert.ok(id in modules, id);return modules[id]; } });
  return { invoke: actionModule.exports.setSystemFlag, state: () => ({ committed, audited, called, mutations }) };
}
const form = (key = "public.reviews", enabled = "0") => { const f = new FormData();f.set("key", key);f.set("enabled", enabled);return f; };

test("system settings reject unauthorized direct server-action calls before DB access", async () => {
  const a = action({ allowed: false });await assert.rejects(a.invoke(form()), /Forbidden/);assert.equal(a.state().called, false);
});
test("system settings reject arbitrary secret/setting names and malformed boolean values without mutation", async () => {
  for (const f of [form("AUTH_SECRET"), form("DATABASE_URL"), form("__proto__"), form("public.reviews", "true")]) {
    const a = action();await assert.rejects(a.invoke(f), /Invalid setting/);assert.equal(a.state().called, false);
  }
});
test("settings update commits with its audit, and audit failure aborts the transaction", async () => {
  const a=action();await a.invoke(form());assert.equal(a.state().audited,true);assert.equal(a.state().committed,true);
  const b=action({auditFails:true});await assert.rejects(b.invoke(form()),/audit unavailable/);assert.equal(b.state().committed,false);
});
