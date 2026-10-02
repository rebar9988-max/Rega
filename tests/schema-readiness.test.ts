import test from "node:test";
import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertSafeDatabase } from "./e2e/global-setup";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { contentColumnsReady, REQUIRED_CONTENT_COLUMNS } from "../src/lib/schema-readiness";

const columns = Object.entries(REQUIRED_CONTENT_COLUMNS).flatMap(([table_name, names]) => names.map((column_name) => ({ table_name, column_name })));

test("content readiness detects the observed missing tables and City column", () => {
  assert.equal(contentColumnsReady(columns), true);
  for (const table of ["Page", "Listing", "PageTranslation", "ListingTranslation"]) {
    assert.equal(contentColumnsReady(columns.filter((r) => r.table_name !== table)), false);
  }
  assert.equal(contentColumnsReady(columns.filter((r) => !(r.table_name === "City" && r.column_name === "nameFa"))), false);
  assert.equal(contentColumnsReady([]), false);
});

function loadHealth(prisma: unknown) {
  const compiled = ts.transpileModule(readFileSync(new URL("../src/app/api/v1/health/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
    const modules: Record<string, unknown> = {
      "next/server": { NextResponse: { json: (body: unknown, options: unknown) => ({ body, options }) } },
      "@/lib/db": { prisma },
      "@/lib/env": { isStorageConfigured: () => false },
      "@/lib/ai": { isAiConfigured: () => false, providerCatalog: () => [] },
      "@/lib/email": { emailEnabled: () => false },
      "@/lib/schema-readiness": { contentColumnsReady },
    };
    const exports: { GET?: () => Promise<{ body: { ok: boolean; checks: { database: string; contentColumns: boolean } }; options: { status: number; headers: Record<string, string> } }> } = {};
    runInNewContext(compiled, { exports, Date, process: { env: { DATABASE_URL: "configured", AUTH_SECRET: "configured" } }, require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected import ${name}`);
      return modules[name];
    } });
    return exports.GET!;
}

test("health returns 503 for schema drift despite a working connection and migration history", async () => {
  for (const schema of [columns, columns.filter((r) => r.table_name !== "Listing"), []]) {
    let queries = 0;
    const result = await loadHealth({ $queryRaw: async () => (++queries === 1 ? [{ value: 1 }] : queries === 2 ? [{ count: 1n }] : schema) })();
    const ready = schema === columns;
    assert.equal(result.body.checks.database, "ok");
    assert.equal(result.body.ok, ready);
    assert.equal(result.body.checks.contentColumns, ready);
    assert.equal(result.options.status, ready ? 200 : 503);
    assert.equal(result.options.headers["cache-control"], "no-store");
  }
});

test("health is ready on real migrated test PostgreSQL through the Prisma adapter", { skip: !process.env.DATABASE_URL }, async () => {
  await assertSafeDatabase(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await loadHealth(prisma)();
    assert.equal(result.body.checks.database, "ok");
    assert.equal(result.body.checks.contentColumns, true);
    assert.equal(result.options.status, 200);
  } finally {
    await prisma.$disconnect();
  }
});

test("content readiness column requirements match generated Prisma scalar fields", () => {
  for (const [table, names] of Object.entries(REQUIRED_CONTENT_COLUMNS)) {
    const model = Prisma.dmmf.datamodel.models.find((m) => (m.dbName ?? m.name) === table);
    assert.ok(model, table);
    const expected = model.fields.filter((f) => f.kind !== "object").map((f) => f.dbName ?? f.name);
    assert.deepEqual([...names].sort(), expected.sort(), table);
  }
});
