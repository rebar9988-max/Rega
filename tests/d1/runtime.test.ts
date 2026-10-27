import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const folder = mkdtempSync(join(tmpdir(), "rega-d1-runtime-"));
const path = join(folder, "test.sqlite");
const setup = new DatabaseSync(path);
setup.exec(readFileSync("prisma/d1/migrations/0001_initial.sql", "utf8"));
setup.exec(readFileSync("prisma/d1/migrations/0002_runtime.sql", "utf8"));
setup.exec(readFileSync("prisma/d1/migrations/0003_city_slug_fold.sql", "utf8"));
setup.exec("CREATE TABLE d1_migrations(name TEXT PRIMARY KEY); INSERT INTO d1_migrations VALUES('0001_initial.sql'),('0002_runtime.sql'),('0003_city_slug_fold.sql');");
setup.close();
process.env.REGA_DATABASE_PROVIDER = "d1";
process.env.D1_SQLITE_PATH = path;
process.env.AUTH_SECRET = "d1-test-secret-not-used-in-production";
process.env.GEOCODING_PROVIDER = "none";

test("D1 runtime preserves atomicity and existing domain behavior", async t => {
  const { prisma } = await import("../../src/lib/db");
  const { databaseTransaction } = await import("../../src/lib/database-transaction");
  const { Prisma } = await import("@prisma/client");
  let userId = "";
  await t.test("Unicode case matching, omitted mirrors, dates and scalar JSON", async () => {
    const user = await prisma.user.create({ data: { email: "d1@example.invalid", name: "ÖMER", role: "USER" } });
    userId = user.id;
    assert.ok(user.createdAt instanceof Date);
    assert.equal("foldedName" in user, false);
    assert.equal((await prisma.user.findFirst({ where: { name: { equals: "ömer", mode: "insensitive" } } }))?.id, user.id);
    await prisma.setting.upsert({ where: { key: "scalar" }, create: { key: "scalar", value: 123 }, update: { value: 123 } });
    assert.equal((await prisma.setting.findUniqueOrThrow({ where: { key: "scalar" } })).value, 123);
    const log = await prisma.auditLog.create({ data: { action: "test", entity: "test", after: { status: "archived" }, before: Prisma.DbNull } });
    assert.equal((await prisma.auditLog.findFirst({ where: { after: { path: ["status"], equals: "archived" } } }))?.id, log.id);
    const nulls = await prisma.auditLog.create({ data: { action: "null", entity: "test", before: Prisma.DbNull, after: Prisma.JsonNull } });
    const [stored] = await prisma.$queryRaw<{ sqlNull: number; jsonNull: number }[]>`SELECT "before" IS NULL AS sqlNull,"after" = 'null' AS jsonNull FROM "AuditLog" WHERE id=${nulls.id}`;
    assert.equal(Number(stored.sqlNull), 1);
    assert.equal(Number(stored.jsonNull), 1);
    assert.equal(await prisma.auditLog.count({ where: { id: nulls.id, before: { equals: Prisma.DbNull } } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { id: nulls.id, after: { equals: Prisma.JsonNull } } }), 1);
  });
  await t.test("late failures leave neither parent nor child writes", async () => {
    const old = await prisma.user.count();
    await assert.rejects(databaseTransaction(async tx => {
      const parent = await tx.user.create({ data: { email: "rollback@example.invalid" } });
      await tx.account.create({ data: { userId: "missing", type: "oauth", provider: "test", providerAccountId: parent.id } });
    }));
    assert.equal(await prisma.user.count(), old);
    assert.equal(await prisma.user.findUnique({ where: { email: "rollback@example.invalid" } }), null);
  });
  await t.test("date filters and repeated compound daily usage updates round trip", async () => {
    const day = new Date("2026-10-27T00:00:00Z");
    for (let i = 0; i < 2; i++) await prisma.aiUsageDaily.upsert({ where: { day_provider_model: { day, provider: "test", model: "test" } }, create: { day, provider: "test", model: "test", requests: 1 }, update: { requests: { increment: 1 } } });
    assert.equal((await prisma.aiUsageDaily.findUniqueOrThrow({ where: { day_provider_model: { day, provider: "test", model: "test" } } })).requests, 2);
    assert.equal(await prisma.user.count({ where: { id: userId, createdAt: { gt: new Date(Date.now() - 60_000) } } }), 1);
    await prisma.aiUsageDaily.upsert({ where: { day_provider_model: { day: new Date("2026-10-27T18:35:10Z"), provider: "test", model: "test" } }, create: { day, provider: "test", model: "test" }, update: { requests: { increment: 1 } } });
    assert.equal((await prisma.aiUsageDaily.findUniqueOrThrow({ where: { day_provider_model: { day, provider: "test", model: "test" } } })).requests, 3);
  });
  await t.test("read-your-writes, reverse relations and compound upserts", async () => {
    await databaseTransaction(async tx => {
      const parent = await tx.business.create({ data: { slug: "atomic", name: "Atomic", tags: ["کوردی"], languages: ["ckb"] } });
      const child = await tx.businessMember.upsert({ where: { businessId_userId: { businessId: parent.id, userId } }, create: { businessId: parent.id, userId, role: "EMPLOYEE" }, update: {} });
      const view = await tx.business.findUniqueOrThrow({ where: { id: parent.id }, include: { members: { include: { user: true } } } });
      assert.deepEqual(view.tags, ["کوردی"]);
      assert.equal(view.members[0].id, child.id);
      assert.equal(view.members[0].user.email, "d1@example.invalid");
      await tx.business.update({ where: { id: parent.id }, data: { name: "ÖMER TWO" } });
      assert.equal((await tx.business.findFirst({ where: { name: { equals: "ömer two", mode: "insensitive" } } }))?.id, parent.id);
    });
    assert.equal((await prisma.business.findUniqueOrThrow({ where: { slug: "atomic" } })).name, "ÖMER TWO");
  });
  await t.test("optimistic validation retries interleaved writes without losing increments", async () => {
    const business = await prisma.business.findUniqueOrThrow({ where: { slug: "atomic" } });
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const increment = () => databaseTransaction(async tx => {
      const b = await tx.business.findUniqueOrThrow({ where: { id: business.id } });
      arrivals++;
      if (arrivals === 2) release();
      if (arrivals <= 2) await gate;
      await tx.business.update({ where: { id: b.id }, data: { viewCount: b.viewCount + 1 } });
    });
    await Promise.all([increment(), increment()]);
    assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).viewCount, business.viewCount + 2);
    assert.ok(arrivals >= 3);
  });
  await t.test("money keeps PostgreSQL scale and rejects Decimal(12,2) overflow", async () => {
    const business = await prisma.business.findUniqueOrThrow({ where: { slug: "atomic" } });
    const service = await prisma.service.create({ data: { businessId: business.id, slug: "money", name: "Money", priceFrom: new Prisma.Decimal("2.355") } });
    assert.equal(service.priceFrom?.toString(), "2.36");
    assert.equal((await prisma.service.findUniqueOrThrow({ where: { id: service.id } })).priceFrom?.toString(), "2.36");
    const count = await prisma.service.count();
    await assert.rejects(prisma.service.create({ data: { businessId: business.id, slug: "overflow", name: "Overflow", priceFrom: new Prisma.Decimal("10000000000.00") } }));
    assert.equal(await prisma.service.count(), count);
  });
  await t.test("unconverted Prisma transactions fail closed", async () => {
    await assert.rejects(async () => prisma.$transaction(async tx => tx.user.count()), /atomic batch|does not support interactive transactions/);
    const count = await prisma.user.count();
    await assert.rejects(async () => prisma.$transaction([prisma.user.create({ data: { email: "array-must-not-write@example.invalid" } })]), /atomic batch/);
    assert.equal(await prisma.user.count(), count);
  });
  await t.test("verification tokens are replaced atomically and consumed once under concurrency", async () => {
    const { issueToken, consumeToken } = await import("../../src/features/auth/tokens");
    const first = await issueToken("verify", "token@example.invalid", 60_000);
    const last = await issueToken("verify", "token@example.invalid", 60_000);
    assert.equal(await consumeToken("verify", "token@example.invalid", first), false);
    assert.deepEqual((await Promise.all([consumeToken("verify", "token@example.invalid", last), consumeToken("verify", "token@example.invalid", last)])).sort(), [false, true]);
  });
  await t.test("real business save publishes only complete locations and rolls back invalid edits", async () => {
    const { saveBusiness, businessFormSchema } = await import("../../src/lib/business-admin");
    const country = await prisma.country.create({ data: { code: "DE", nameEn: "Germany" } });
    const city = await prisma.city.create({ data: { countryId: country.id, nameEn: "Berlin", slug: "berlin" } });
    assert.equal((await prisma.city.findFirst({ where: { OR: [{ slug: { contains: "BER", mode: "insensitive" } }, { translations: { some: { name: { contains: "BER", mode: "insensitive" } } } }] } }))?.id, city.id);
    const category = await prisma.category.create({ data: { key: "test", slug: "test", nameCkb: "تاقیکردنەوە", nameDe: "Test" } });
    const raw = { name: "Real domain save", categoryId: category.id, addressLine1: "Test address 1", countryCode: "DE", city: city.nameEn, latitude: 52.52, longitude: 13.405, coordsConfirmed: "1", coordsSource: "manual", intent: "publish", languages: ["de"] };
    const input = businessFormSchema.parse(raw);
    const saved = await saveBusiness(input, { id: userId }, { canPublish: true, canCreateCity: true });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.published, true);
    const before = await prisma.business.findUniqueOrThrow({ where: { id: saved.id }, include: { locations: true } });
    const edited = businessFormSchema.parse({ ...raw, id: saved.id, name: "Must roll back", latitude: undefined, longitude: undefined, coordsConfirmed: undefined, intent: "save" });
    const outcome = await saveBusiness(edited, { id: userId }, { canPublish: true, canCreateCity: true });
    assert.deepEqual(outcome, { ok: false, error: "published_incomplete" });
    assert.deepEqual(await prisma.business.findUniqueOrThrow({ where: { id: saved.id }, include: { locations: true } }), before);
    const duplicate = await saveBusiness(input, { id: userId }, { canPublish: true, canCreateCity: true });
    assert.equal(duplicate.ok, true);
  });
  await prisma.$disconnect();
});
