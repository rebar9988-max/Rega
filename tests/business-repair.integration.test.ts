import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

test("repair preserves later edits, repairs only eligible approval and is idempotent", { skip: !process.env.DATABASE_URL }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]", "db"].includes(url.hostname), "Repair integration test requires a local disposable database");
  assert.notEqual(process.env.APP_ENV, "production");
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  // Separate disposable database: other unit tests exercise seed idempotence concurrently.
  const databaseName = `repair_test_${randomUUID().replaceAll("-", "")}`;
  url.pathname = `/${databaseName}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_DATABASE_URL: url.toString() };
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  let created = false;
  const key = `repair-${randomUUID()}`;
  const ids: string[] = [];
  let actorId: string | undefined, categoryId: string | undefined, cityId: string | undefined;
  const run = (apply = false) => JSON.parse(execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/business-publication-repair.ts", ...(apply ? ["--apply"] : [])], { encoding: "utf8", env }));
  try {
    // databaseName is generated here from a UUID; no input is interpolated into these identifiers.
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
    const country = await db.country.upsert({ where: { code: "DE" }, create: { code: "DE", nameEn: "Germany" }, update: {} });
    cityId = (await db.city.create({ data: { nameEn: key, countryId: country.id } })).id;
    categoryId = (await db.category.create({ data: { key, slug: key, nameCkb: key, nameDe: key } })).id;
    actorId = (await db.user.create({ data: { email: `${key}@rega.test`, role: "SUPER_ADMIN" } })).id;
    for (const suffix of ["eligible", "edited"]) {
      const business = await db.business.create({ data: {
        name: `${key}-${suffix}`, slug: `${key}-${suffix}`, categoryId, status: "draft", verified: true,
        locations: { create: { addressLine1: "Test street 12", countryCode: "DE", cityId, isPrimary: true, latitude: 52.5, longitude: 13.4, coordsVerifiedAt: new Date() } },
      } });
      ids.push(business.id);
      await db.auditLog.create({ data: { actorId, action: "business.verify", entity: "Business", entityId: business.id, createdAt: new Date(Date.now() - 10_000), after: { verified: true } } });
      if (suffix === "edited") await db.auditLog.create({ data: { actorId, action: "business.update", entity: "Business", entityId: business.id, before: { status: "published" }, after: { status: "draft" } } });
    }
    const dry = run();
    // The dry run is read-only, and only the eligible record may be repaired.
    assert.deepEqual(dry.report.filter((r: { result: string }) => r.result === "eligible (read-only)").map((r: { id: string }) => r.id), [ids[0]]);
    assert.match(dry.report.find((r: { id: string }) => r.id === ids[1]).result, /^skipped/);
    assert.equal((await db.business.findUniqueOrThrow({ where: { id: ids[0] } })).status, "draft");
    run(true);
    assert.equal((await db.business.findUniqueOrThrow({ where: { id: ids[0] } })).status, "published");
    assert.equal((await db.business.findUniqueOrThrow({ where: { id: ids[1] } })).status, "draft");
    run(true);
    assert.equal(await db.auditLog.count({ where: { entityId: ids[0], action: "business.publication_repair" } }), 1);
  } finally {
    await db.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await admin.$disconnect();
  }
});
