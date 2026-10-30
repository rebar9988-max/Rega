import test from "node:test";
import assert from "node:assert/strict";
import { AUDIT_MAX_PAGE, auditHref, auditWhere, parseAuditFilters } from "../src/features/admin-audit/filters";
import { badgeText, buildNotifications, visibleKinds } from "../src/features/admin-notifications/build";

test("audit filters: valid values pass, visitor input that is not an identifier is dropped", () => {
  assert.deepEqual(parseAuditFilters({}), { page: 1 });
  assert.deepEqual(parseAuditFilters({ page: "3", action: "business.publish", entity: "Business", actor: " Owner@Example.com " }),
    { page: 3, action: "business.publish", entity: "Business", actor: "owner@example.com" });
  assert.deepEqual(parseAuditFilters({ page: "-4", action: "x'; DROP TABLE", entity: "a".repeat(80), actor: "two words" }), { page: 1 });
  assert.equal(parseAuditFilters({ page: "999999" }).page, AUDIT_MAX_PAGE);
  assert.equal(parseAuditFilters({ action: ["review.approve", "other"] }).action, "review.approve");
});

test("audit filters: Prisma filter and links carry only the filters that are set", () => {
  assert.deepEqual(auditWhere({ page: 1 }), {});
  assert.deepEqual(auditWhere({ page: 2, action: "user.update", actor: "rega" }), { action: "user.update", actorEmail: { contains: "rega" } });
  assert.equal(auditHref({ page: 1 }, 1), "/dr/audit");
  assert.equal(auditHref({ page: 1, entity: "Business", actor: "a@b.c" }, 2), "/dr/audit?entity=Business&actor=a%40b.c&page=2");
});

test("notifications: only permitted, non-empty kinds, in a fixed order", () => {
  const counts = { newMessages: 2, pendingBusinesses: 3, pendingReviews: 0, openReports: 1 };
  assert.deepEqual(buildNotifications(counts, "SUPER_ADMIN").map((n) => [n.kind, n.count]), [["pendingBusinesses", 3], ["openReports", 1], ["newMessages", 2]]);
  assert.deepEqual(buildNotifications(counts, "USER"), []);
  assert.deepEqual(buildNotifications(counts, null), []);
  assert.deepEqual(visibleKinds("BUSINESS_OWNER"), []);
  assert.deepEqual(buildNotifications({ pendingBusinesses: Number.NaN, openReports: -1 }, "SUPER_ADMIN"), []);
  assert.equal(buildNotifications(counts, "SUPER_ADMIN")[0].href, "/dr/businesses?status=pending");
});

test("notification badge caps at 99+", () => {
  assert.equal(badgeText(0), "0");
  assert.equal(badgeText(7), "7");
  assert.equal(badgeText(99), "99");
  assert.equal(badgeText(100), "99+");
});
