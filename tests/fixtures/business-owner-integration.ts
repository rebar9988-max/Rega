/** Executed only by the local disposable-database integration test. */
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/db";
import { saveBusiness, businessFormSchema } from "../../src/lib/business-admin";

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  assert.ok(["localhost", "127.0.0.1", "[::1]", "db"].includes(host));
  assert.notEqual(process.env.APP_ENV, "production");
  const owner = await prisma.user.create({ data: { email: "owner@local.rega.test", role: "BUSINESS_OWNER" } });
  const category = await prisma.category.create({ data: { key: "owner-integration", slug: "owner-integration", nameCkb: "Test", nameDe: "Test", sectionKey: "businesses" } });
  const actor = { id: owner.id, role: owner.role };
  const perms = { canPublish: false, canCreateCity: false };
  const input = businessFormSchema.parse({ name: "E2E Atomic owner", categoryId: category.id, intent: "draft", ownerId: "untrusted-client-owner" });
  const [first, retry] = await Promise.all([saveBusiness(input, actor, perms), saveBusiness(input, actor, perms)]);
  assert.ok(first.ok && retry.ok);
  assert.equal(first.id, retry.id, "concurrent retries reuse the first draft");
  assert.equal(await prisma.business.count(), 1);
  const membership = await prisma.businessMember.findUniqueOrThrow({ where: { businessId_userId: { businessId: first.id, userId: owner.id } } });
  assert.equal(membership.isActive, true);
  assert.equal(membership.role, "EMPLOYEE");
  const stored = await prisma.business.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(stored.createdById, owner.id);
  assert.equal(stored.status, "draft");
  assert.equal(stored.verified, false);

  // Fail only the membership insert. The business and its data must roll back with it.
  await prisma.$executeRawUnsafe(`CREATE FUNCTION owner_test_fail_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'local test membership failure'; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER owner_test_membership BEFORE INSERT ON "BusinessMember" FOR EACH ROW EXECUTE FUNCTION owner_test_fail_membership()`);
  await assert.rejects(() => saveBusiness({ ...input, name: "E2E Rollback owner" }, actor, perms));
  assert.equal(await prisma.business.count({ where: { name: "E2E Rollback owner" } }), 0);
  await prisma.$executeRawUnsafe(`DROP TRIGGER owner_test_membership ON "BusinessMember"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION owner_test_fail_membership()`);

  // A revoked relationship must not be reactivated by resubmitting a recent creation.
  await prisma.businessMember.update({ where: { id: membership.id }, data: { isActive: false } });
  const fresh = await saveBusiness(input, actor, perms);
  assert.ok(fresh.ok);
  assert.notEqual(fresh.id, first.id);
  assert.equal((await prisma.businessMember.findUniqueOrThrow({ where: { id: membership.id } })).isActive, false);
  assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: first.id } })).name, stored.name);
}
main().finally(() => prisma.$disconnect());
