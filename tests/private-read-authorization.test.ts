import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as rbac from "../src/lib/rbac";
import { PUBLIC_BUSINESS } from "../src/lib/search-where";

const routes = ["businesses/route.ts", "businesses/[id]/route.ts", "locations/route.ts"];
type Query = { where: { status?: string; business?: { status?: string } } };
type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;

/** Execute the real guards and GET handlers with a cached staff session and an independently current DB account. */
function requestFor(route: string, role: rbac.Role | null | Error, { anonymous = false, published = false } = {}) {
  let accountReads = 0, dataReads = 0;
  const business = { id: "listing", slug: "listing", name: "Local test listing", status: published ? "published" : "draft",
    verified: published, createdById: "private-owner", locations: [], services: [], media: [], photos: [] };
  const isVisible = (query: Query) => !query.where.status || query.where.status === business.status;
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/auth": { auth: async () => anonymous ? null : { user: { id: "actor", role: "SUPER_ADMIN", email: "cached@example.org" } } },
    "@/lib/rbac": rbac,
    "@/lib/db": { prisma: {
      user: { findFirst: async (query: { where: { id: string; status: string; deletedAt: null } }) => {
        accountReads++;
        assert.equal(query.where.id, "actor");
        assert.equal(query.where.status, "active");
        assert.equal(query.where.deletedAt, null);
        if (role instanceof Error) throw role;
        return role ? { id: "actor", role, email: "current@example.org" } : null;
      } },
      business: {
        count: async (q: Query) => isVisible(q) ? 1 : 0,
        findMany: async (q: Query) => { dataReads++; return isVisible(q) ? [business] : []; },
        findFirst: async (q: Query) => { dataReads++; return isVisible(q) ? business : null; },
      },
      location: {
        count: async (q: Query) => q.where.business && !published ? 0 : 1,
        findMany: async (q: Query) => { dataReads++; return q.where.business && !published ? [] : [{ id: "private-location" }]; },
      },
    } },
    "@/lib/api": {
      ok: (data: unknown) => Response.json({ ok: true, data }),
      fail: (status: number, code: string) => Response.json({ ok: false, error: { code } }, { status }),
      handleError: () => Response.json({ ok: false }, { status: 500 }),
      pageParams: () => ({ page: 1, perPage: 20, skip: 0, take: 20 }),
      metaFor: () => ({}), orderBy: () => ({ id: "asc" }),
    },
    "@/lib/search-where": { PUBLIC_BUSINESS, textWhere: () => ({}) },
    "@/lib/business-media": { ownsBusinessImages: () => assert.fail("Public reads must not validate or write upload ownership") },
    "@/lib/search-index": {}, "@/lib/business-access": {}, "@/lib/validation": {},
    "@/lib/business-publication": {}, "@/lib/category-tree": {}, "@/lib/audit": {}, "@/lib/opening-hours": {},
  };
  function load(path: string) {
    const exports: Record<string, unknown> = {};
    const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(code, { exports, Response, URL, require: (name: string) => {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    } });
    return exports;
  }
  modules["@/lib/auth-helpers"] = load("../src/lib/auth-helpers.ts");
  const get = load(`../src/app/api/v1/${route}`).GET as Handler;
  return { get: () => get(new Request("http://localhost/api/v1/test"), { params: Promise.resolve({ id: "listing" }) }),
    accountReads: () => accountReads, dataReads: () => dataReads };
}

for (const route of routes) {
  test(`${route}: a cached staff role cannot expose drafts after demotion or account removal`, async () => {
    for (const role of ["USER", "BUSINESS_OWNER", null] as const) {
      const req = requestFor(route, role);
      const response = await req.get();
      assert.equal(response.status, route.includes("[id]") ? 404 : 200);
      if (response.status === 200) assert.deepEqual((await response.json()).data, []);
      assert.equal(req.accountReads(), 1);
    }
  });

  test(`${route}: authorized current staff retain private access with no-store responses`, async () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const) {
      const req = requestFor(route, role);
      const response = await req.get();
      assert.equal(response.status, 200);
      const data = (await response.json()).data;
      if (route.includes("[id]")) assert.equal(data.createdById, "private-owner");
      else assert.equal(data.length, 1);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(req.accountReads(), 1);
    }
  });

  test(`${route}: database failures fail closed before reading management data`, async () => {
    const req = requestFor(route, new Error("database unavailable"));
    assert.equal((await req.get()).status, 500);
    assert.equal(req.dataReads(), 0);
  });

  test(`${route}: anonymous public reads need no account lookup`, async () => {
    const req = requestFor(route, null, { anonymous: true, published: true });
    const response = await req.get();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.data);
    if (route.startsWith("businesses")) {
      const rows = Array.isArray(body.data) ? body.data : [body.data];
      for (const row of rows) assert.equal("createdById" in row, false);
    }
    assert.equal(req.accountReads(), 0);
  });
}
