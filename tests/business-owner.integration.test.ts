import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

test("owner creation is atomic, duplicate-safe, and cannot reactivate revoked ownership", { skip: !process.env.DATABASE_URL }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]", "db"].includes(url.hostname), "requires a disposable local database");
  assert.notEqual(process.env.APP_ENV, "production");
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const databaseName = `owner_test_${randomUUID().replaceAll("-", "")}`;
  url.pathname = `/${databaseName}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_DATABASE_URL: url.toString() };
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
    execFileSync(process.execPath, ["--require=./tests/fixtures/server-only.cjs", "--import=tsx", "tests/fixtures/business-owner-integration.ts"], { env, stdio: "pipe" });
  } finally {
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await admin.$disconnect();
  }
});
