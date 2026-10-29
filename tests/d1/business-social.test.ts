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
