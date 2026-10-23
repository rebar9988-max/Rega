import test from "node:test";
import assert from "node:assert/strict";
import { lastHiding, publicVisibility, restoreData, type PublicationRecord } from "../src/lib/business-publication";
import { PUBLIC_BUSINESS } from "../src/lib/search-where";

const published = new Date("2026-10-01T10:00:00Z");
const hidden = (over: Partial<PublicationRecord> = {}): PublicationRecord => ({
  id: "business",
  name: "Sky berlin",
  status: "archived",
  verified: true,
  categoryId: "travel-tickets",
  publishedAt: published,
  archivedAt: new Date("2026-10-23T10:00:00Z"),
  deletedAt: null,
  category: { sectionKey: "businesses", isActive: true, deletedAt: null },
  locations: [{ addressLine1: "Street 1", cityId: "berlin", countryCode: "DE", latitude: 52.5, longitude: 13.4, coordsVerifiedAt: new Date(), city: { isActive: true, country: { code: "DE" } } }],
  ...over,
});

test("hidden listings are excluded by the shared public filter", () => {
  assert.equal(PUBLIC_BUSINESS.archivedAt, null);
  assert.equal(PUBLIC_BUSINESS.status, "published");
});

test("staff can show a hidden, verified, complete listing again: published, first publication date kept", () => {
  assert.deepEqual(restoreData(hidden(), "published", true), { verified: true, status: "published", publishedAt: published, archivedAt: null });
});

test("showing again never bypasses moderation", () => {
  // Someone who may not publish never makes a listing public; it goes back to a draft for review.
  assert.deepEqual(restoreData(hidden(), "published", false), { status: "draft", verified: false, archivedAt: null });
  // No longer complete (e.g. category deactivated) -> draft, not public.
  assert.deepEqual(restoreData(hidden({ category: { sectionKey: "businesses", isActive: false, deletedAt: null } }), "published", true), { status: "draft", verified: false, archivedAt: null });
  // Not staff-verified -> draft.
  assert.deepEqual(restoreData(hidden({ verified: false }), "published", true), { status: "draft", verified: false, archivedAt: null });
  // Waiting for review before it was hidden -> waits for review again.
  assert.deepEqual(restoreData(hidden({ verified: false }), "pending", true), { status: "pending", verified: false, archivedAt: null });
  // Unknown history -> safest state.
  assert.deepEqual(restoreData(hidden(), null, true), { status: "draft", verified: false, archivedAt: null });
  assert.deepEqual(restoreData(hidden(), "suspended", true), { status: "draft", verified: false, archivedAt: null });
});

test("only a hidden, not deleted listing can be shown again", () => {
  assert.equal(restoreData(hidden({ status: "published", archivedAt: null }), "published", true), null);
  assert.equal(restoreData(hidden({ deletedAt: new Date() }), "published", true), null);
});

test("restore keeps every other field: the update only touches status, verification, publication and hide dates", () => {
  for (const prev of ["published", "pending", "draft"]) {
    const data = restoreData(hidden(), prev, true)!;
    assert.ok(Object.keys(data).every((k) => ["status", "verified", "publishedAt", "archivedAt"].includes(k)), prev);
  }
});

test("the hiding audit entry gives the earlier status and who hid it; repeated hides are skipped", () => {
  assert.deepEqual(lastHiding([
    { before: { status: "archived" }, actorId: "x" },
    { before: { status: "published", verified: true }, actorId: "staff" },
    { before: { status: "draft" }, actorId: "old" },
  ]), { status: "published", actorId: "staff" });
  assert.equal(lastHiding([]), null);
  assert.equal(lastHiding([{ before: null, actorId: "a" }, { before: "bad", actorId: "b" }]), null);
});

test("dashboard visibility mirrors the public filter", () => {
  const cat = { sectionKey: "businesses", isActive: true, deletedAt: null };
  assert.equal(publicVisibility({ status: "published", verified: true, archivedAt: null, category: cat }), "public");
  assert.equal(publicVisibility({ status: "archived", verified: true, archivedAt: new Date(), category: cat }), "hidden");
  assert.equal(publicVisibility({ status: "published", verified: true, archivedAt: new Date(), category: cat }), "hidden");
  assert.equal(publicVisibility({ status: "published", verified: false, category: cat }), "notPublic");
  assert.equal(publicVisibility({ status: "pending", verified: false, category: cat }), "notPublic");
  assert.equal(publicVisibility({ status: "published", verified: true, category: { ...cat, isActive: false } }), "notPublic");
  assert.equal(publicVisibility({ status: "published", verified: true, category: null }), "notPublic");
});
