import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Synthetic fixtures only. This database is never a restored customer backup or a remote D1 binding.
const directory = mkdtempSync(join(tmpdir(), "rega-d1-social-"));
const file = join(directory, "test.sqlite");
const sql = new DatabaseSync(file);
sql.exec("PRAGMA foreign_keys=ON");
for (const name of ["0001_initial.sql", "0002_runtime.sql", "0003_city_slug_fold.sql"])
  sql.exec(readFileSync(`prisma/d1/migrations/${name}`, "utf8"));
sql.exec(`INSERT INTO "User"(id,email,"updatedAt") VALUES ('owner','social-d1@example.invalid',0);
INSERT INTO "Business"(id,slug,name,description,"createdById","updatedAt") VALUES ('existing','existing','Existing business','Keep this description','owner',0);
INSERT INTO "BusinessMember"(id,"businessId","userId") VALUES ('membership','existing','owner');`);
const before = { ...sql.prepare('SELECT * FROM "Business" WHERE id=?').get("existing")! };
const memberships = sql.prepare('SELECT * FROM "BusinessMember"').all();
sql.exec(readFileSync("prisma/d1/migrations/0004_business_social_links.sql", "utf8"));
process.env.REGA_DATABASE_PROVIDER = "d1";
process.env.D1_SQLITE_PATH = file;
process.env.AUTH_SECRET = "d1-social-test-only";
const fields = ["facebookUrl", "instagramUrl", "tiktokUrl", "snapchatUrl"] as const;
const accounts = { facebookUrl: "https://www.facebook.com/business.name", instagramUrl: "https://www.instagram.com/business.name/", tiktokUrl: "https://www.tiktok.com/@business.name", snapchatUrl: "https://www.snapchat.com/add/business.name" };

test("D1 social migration preserves every existing business value and ownership; real client CRUD survives reopen", async () => {
  const migrated = sql.prepare('SELECT * FROM "Business" WHERE id=?').get("existing")!;
  const old = { ...migrated };
  const columns = sql.prepare('PRAGMA table_info("Business")').all();
  for (const field of fields) {
    assert.equal(migrated[field], null);
    delete old[field];
    const column = columns.find(c => c.name === field)!;
    assert.equal(column.type, "TEXT");
    assert.equal(column.notnull, 0);
    assert.equal(column.dflt_value, null);
  }
  assert.deepEqual(old, before);
  assert.deepEqual(sql.prepare('SELECT * FROM "BusinessMember"').all(), memberships);
  assert.deepEqual(sql.prepare("PRAGMA foreign_key_check").all(), []);
  const { createNodeClient } = await import("../../src/lib/db-node-client");
  const { businessCreateSchema, businessUpdateSchema } = await import("../../src/lib/validation");
  const db = createNodeClient();
  try {
    for (const [name, links] of [["zero", {}], ["one", { instagramUrl: accounts.instagramUrl }], ["four", accounts]] as const) {
      const parsed = businessCreateSchema.parse({ name: `Business ${name}`, ...links });
      const { nameDe, ...data } = parsed;
      void nameDe;
      const row = await db.business.create({ data: { ...data, slug: name } });
      const saved = await db.business.findUniqueOrThrow({ where: { id: row.id } });
      for (const field of fields) assert.equal(saved[field], field in links ? links[field as keyof typeof links] : null);
    }
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse(accounts) });
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse({ instagramUrl: "https://instagram.com/replaced.business" }) });
    let saved = await db.business.findUniqueOrThrow({ where: { id: "existing" } });
    assert.equal(saved.instagramUrl, "https://instagram.com/replaced.business");
    assert.equal(saved.facebookUrl, accounts.facebookUrl);
    assert.equal(saved.description, "Keep this description");
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse({ instagramUrl: "" }) });
    saved = await db.business.findUniqueOrThrow({ where: { id: "existing" } });
    assert.equal(saved.instagramUrl, null);
    assert.equal(saved.facebookUrl, accounts.facebookUrl);
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse({ facebookUrl: "", tiktokUrl: null, snapchatUrl: " " }) });
    assert.equal(await db.business.count(), 4);
    assert.equal(await db.businessMember.count(), 1);
  } finally { await db.$disconnect(); }
  const reopened = createNodeClient();
  try {
    const saved = await reopened.business.findUniqueOrThrow({ where: { id: "existing" } });
    for (const field of fields) assert.equal(saved[field], null);
    assert.equal(saved.description, "Keep this description");
    assert.equal(await reopened.businessMember.count({ where: { businessId: "existing", userId: "owner", isActive: true } }), 1);
  } finally { await reopened.$disconnect(); sql.close(); }
});


test("D1 business save checks resolved duplicate ownership and never regrants revoked access", async () => {
  const { prisma } = await import("../../src/lib/db");
  const { saveBusiness, businessFormSchema } = await import("../../src/lib/business-admin");
  const { HttpError } = await import("../../src/lib/auth-helpers");
  const owner = await prisma.user.create({ data: { email: "social-dedup-owner@example.invalid", role: "BUSINESS_OWNER" } });
  const actor = { id: owner.id, role: "BUSINESS_OWNER" as const };
  const perms = { canPublish: false, canCreateCity: false };
  const input = businessFormSchema.parse({ name: "Social duplicate ownership", intent: "draft", instagramUrl: accounts.instagramUrl });
  try {
    // Concurrent first saves must create both the draft and membership once, in the same transaction.
    const saves = await Promise.all([saveBusiness(input, actor, perms), saveBusiness(input, actor, perms)]);
    assert.ok(saves.every(x => x.ok));
    const first = saves[0];
    if (!first.ok) throw new Error("initial save failed");
    assert.ok(saves.every(x => x.ok && x.id === first.id));
    assert.deepEqual(saves.map(x => x.ok && x.created).sort(), [false, true]);
    assert.equal(await prisma.businessMember.count({ where: { businessId: first.id, userId: owner.id, isActive: true } }), 1);
    const count = await prisma.business.count();
    await prisma.businessMember.updateMany({ where: { businessId: first.id, userId: owner.id }, data: { isActive: false } });
    const before = await prisma.business.findUniqueOrThrow({ where: { id: first.id }, include: { locations: true } });
    const members = await prisma.businessMember.findMany({ where: { businessId: first.id } });
    const audits = await prisma.auditLog.count();
    const attack = businessFormSchema.parse({ ...input, description: "Must not be written", instagramUrl: "https://www.instagram.com/revoked.account/" });
    for (const candidate of [attack, { ...attack, id: first.id }]) {
      await assert.rejects(() => saveBusiness(candidate, actor, perms), (error: unknown) => error instanceof HttpError && error.status === 403);
      assert.deepEqual(await prisma.business.findUniqueOrThrow({ where: { id: first.id }, include: { locations: true } }), before);
      assert.deepEqual(await prisma.businessMember.findMany({ where: { businessId: first.id } }), members);
      assert.equal(await prisma.business.count(), count);
      assert.equal(await prisma.auditLog.count(), audits);
    }
    // Restoring the owned synthetic fixture permits the same omitted-id retry without another record.
    await prisma.businessMember.updateMany({ where: { businessId: first.id, userId: owner.id }, data: { isActive: true } });
    const active = await saveBusiness(attack, actor, perms);
    assert.ok(active.ok && !active.created && active.id === first.id);
    assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: first.id } })).instagramUrl, attack.instagramUrl);
    assert.equal(await prisma.business.count(), count);
    // Existing global staff permissions work even without a BusinessMember row.
    const staff = await prisma.user.create({ data: { email: "social-dedup-manager@example.invalid", role: "MANAGER" } });
    const staffActor = { id: staff.id, role: "MANAGER" as const };
    const staffInput = businessFormSchema.parse({ name: "Staff duplicate ownership", intent: "draft" });
    const staffFirst = await saveBusiness(staffInput, staffActor, { canPublish: true, canCreateCity: true });
    const staffRetry = await saveBusiness(staffInput, staffActor, { canPublish: true, canCreateCity: true });
    assert.ok(staffFirst.ok && staffRetry.ok && staffFirst.id === staffRetry.id && !staffRetry.created);
    if (!staffFirst.ok) throw new Error("staff save failed");
    assert.equal(await prisma.businessMember.count({ where: { businessId: staffFirst.id } }), 0);
  } finally { await prisma.$disconnect(); }
});
