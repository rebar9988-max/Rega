import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { businessCreateSchema, businessUpdateSchema } from "../src/lib/validation";

const migration = "20261024220000_business_social_links";

test("social migration preserves legacy rows/ownership; parsed CRUD persists optional accounts", { skip: !process.env.DATABASE_URL }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]", "db"].includes(url.hostname), "Requires a disposable local PostgreSQL server");
  assert.notEqual(process.env.APP_ENV, "production");
  const database = `rega_social_migration_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  url.pathname = `/${database}`;
  const sql = new pg.Client({ connectionString: url.href });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    await sql.connect();
    const dir = path.join(process.cwd(), "prisma/migrations");
    for (const name of (await readdir(dir)).filter((n) => /^\d/.test(n) && n < migration).sort())
      await sql.query(await readFile(path.join(dir, name, "migration.sql"), "utf8"));
    await sql.query(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('owner','social-migration@rega.test',CURRENT_TIMESTAMP)`);
    await sql.query(`INSERT INTO "Business" (id,slug,name,description,"createdById","updatedAt") VALUES ('existing','existing-business','Existing business','Preserve this real field','owner',CURRENT_TIMESTAMP)`);
    await sql.query(`INSERT INTO "BusinessMember" (id,"businessId","userId") VALUES ('membership','existing','owner')`);
    const before = (await sql.query(`SELECT row_to_json(b) AS row FROM "Business" b WHERE id='existing'`)).rows[0].row;
    const membership = (await sql.query(`SELECT * FROM "BusinessMember"`)).rows;
    await sql.query(await readFile(path.join(dir, migration, "migration.sql"), "utf8"));
    const legacy = await db.business.findUniqueOrThrow({ where: { id: "existing" } });
    for (const field of ["facebookUrl", "instagramUrl", "tiktokUrl", "snapchatUrl"] as const) assert.equal(legacy[field], null);
    const after = (await sql.query(`SELECT row_to_json(b) AS row FROM "Business" b WHERE id='existing'`)).rows[0].row;
    for (const field of ["facebookUrl", "instagramUrl", "tiktokUrl", "snapchatUrl"]) delete after[field];
    assert.deepEqual(after, before);
    assert.deepEqual((await sql.query(`SELECT * FROM "BusinessMember"`)).rows, membership);

    const accounts = {
      facebookUrl: "https://www.facebook.com/business.name",
      instagramUrl: "https://www.instagram.com/business.name/",
      tiktokUrl: "https://www.tiktok.com/@business.name",
      snapchatUrl: "https://www.snapchat.com/add/business.name",
    };
    for (const [name, links] of [["zero", {}], ["one", { instagramUrl: accounts.instagramUrl }], ["four", accounts]] as const) {
      const parsed = businessCreateSchema.parse({ name: `Business ${name}`, ...links });
      const { nameDe, ...data } = parsed;
      void nameDe;
      const row = await db.business.create({ data: { ...data, slug: name } });
      const saved = await db.business.findUniqueOrThrow({ where: { id: row.id } });
      for (const field of ["facebookUrl", "instagramUrl", "tiktokUrl", "snapchatUrl"] as const)
        assert.equal(saved[field], field in links ? links[field as keyof typeof links] : null);
    }
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse({ ...accounts }) });
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse({ instagramUrl: "https://instagram.com/replaced.business" }) });
    let saved = await db.business.findUniqueOrThrow({ where: { id: "existing" } });
    assert.equal(saved.instagramUrl, "https://instagram.com/replaced.business");
    assert.equal(saved.facebookUrl, accounts.facebookUrl);
    assert.equal(saved.description, "Preserve this real field");
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse({ instagramUrl: "" }) });
    saved = await db.business.findUniqueOrThrow({ where: { id: "existing" } });
    assert.equal(saved.instagramUrl, null);
    assert.equal(saved.facebookUrl, accounts.facebookUrl);
    await db.business.update({ where: { id: "existing" }, data: businessUpdateSchema.parse({ facebookUrl: "", tiktokUrl: null, snapchatUrl: "  " }) });
    saved = await db.business.findUniqueOrThrow({ where: { id: "existing" } });
    for (const field of ["facebookUrl", "instagramUrl", "tiktokUrl", "snapchatUrl"] as const) assert.equal(saved[field], null);
    assert.equal(await db.business.count(), 4);
    assert.equal(await db.businessMember.count(), 1);
  } finally {
    await db.$disconnect();
    await sql.end().catch(() => undefined);
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
});
