import test from "node:test";
import assert from "node:assert/strict";
import { isMissingBusinessTable } from "./e2e/database-safety";
import { assertSafeDatabase } from "./e2e/global-setup";

test("E2E permits only the specific missing Business table probe error", () => {
  assert.equal(isMissingBusinessTable({ code: "P2021", meta: { table: "public.Business" } }), true);
  assert.equal(isMissingBusinessTable({ code: "P2021", meta: { table: "Business" } }), true);
  for (const error of [null, new Error("connection failed"), { code: "P1000" }, { code: "P1001" },
    { code: "P2024" }, { code: "P2022" }, { code: "P2021" }, { code: "P2021", meta: { table: "User" } }]) {
    assert.equal(isMissingBusinessTable(error), false);
  }
});

test("the shared seed/E2E guard refuses production and unapproved remote databases before connecting", async () => {
  const saved = { APP_ENV: process.env.APP_ENV, VERCEL_ENV: process.env.VERCEL_ENV, E2E_ALLOW_REMOTE_DB: process.env.E2E_ALLOW_REMOTE_DB };
  try {
    process.env.APP_ENV = "production";
    await assert.rejects(assertSafeDatabase("postgresql://test:test@localhost/rega"), /marked as production/);
    process.env.APP_ENV = "test";
    process.env.VERCEL_ENV = "production";
    await assert.rejects(assertSafeDatabase("postgresql://test:test@localhost/rega"), /marked as production/);
    process.env.VERCEL_ENV = "test";
    process.env.E2E_ALLOW_REMOTE_DB = "0";
    await assert.rejects(assertSafeDatabase("postgresql://test:test@example.org/rega"), /not local/);
    await assert.rejects(assertSafeDatabase("invalid"), /not a valid URL/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
