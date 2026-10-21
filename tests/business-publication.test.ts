import test from "node:test";
import assert from "node:assert/strict";
import {
  approvalData,
  businessReadiness,
  type PublicationRecord,
} from "../src/lib/business-publication";
import { PUBLIC_BUSINESS, businessInCategories } from "../src/lib/search-where";
const fixture = (): PublicationRecord => ({
  id: "business",
  name: "Existing business",
  status: "pending",
  verified: false,
  categoryId: "beauty-barber",
  publishedAt: null,
  archivedAt: null,
  deletedAt: null,
  category: { sectionKey: "businesses", isActive: true, deletedAt: null },
  locations: [
    {
      addressLine1: "Street 12",
      cityId: "berlin",
      countryCode: "DE",
      latitude: 52.5,
      longitude: 13.4,
      coordsVerifiedAt: new Date(),
      city: { isActive: true, country: { code: "DE" } },
    },
  ],
});
test("staff approval atomically verifies and publishes; retries preserve the first publication date", () => {
  const b = fixture(),
    now = new Date();
  const data = approvalData(b, now);
  assert.deepEqual(data, {
    verified: true,
    status: "published",
    publishedAt: now,
    archivedAt: null,
  });
  assert.deepEqual(approvalData({ ...b, ...data! }), data);
});
test("verification cannot restore a suspended, archived, rejected or deleted business", () => {
  for (const status of ["suspended", "archived", "rejected"])
    assert.equal(approvalData({ ...fixture(), status }), null);
  assert.equal(approvalData({ ...fixture(), deletedAt: new Date() }), null);
  assert.equal(approvalData({ ...fixture(), archivedAt: new Date() }), null);
});
test("publication needs an active business category and a confirmed primary location", () => {
  for (const category of [
    null,
    { sectionKey: "jobs", isActive: true, deletedAt: null },
    { sectionKey: "businesses", isActive: false, deletedAt: null },
    { sectionKey: "businesses", isActive: true, deletedAt: new Date() },
  ])
    assert.equal(approvalData({ ...fixture(), category }), null);
  const b = fixture();
  b.locations[0].coordsVerifiedAt = null;
  assert.equal(businessReadiness(b).ok, false);
  assert.equal(approvalData({ ...fixture(), locations: [] }), null);
});
test("barber and butcher scopes cannot include businesses through unrelated services", () => {
  assert.deepEqual(businessInCategories(["travel-tickets"]), {
    categoryId: { in: ["travel-tickets"] },
  });
  assert.deepEqual(businessInCategories(["transport-moving"]), {
    categoryId: { in: ["transport-moving"] },
  });
  assert.deepEqual(businessInCategories([]), { categoryId: { in: [] } });
});
test("all public consumers require verified, published, active category and no moderation exclusion", () => {
  assert.equal(PUBLIC_BUSINESS.verified, true);
  assert.equal(PUBLIC_BUSINESS.status, "published");
  assert.equal(PUBLIC_BUSINESS.deletedAt, null);
  assert.equal(PUBLIC_BUSINESS.archivedAt, null);
  assert.equal(PUBLIC_BUSINESS.category.sectionKey, "businesses");
});

test("publication refuses a city/country mismatch or inactive city", () => {
  const mismatch = fixture(); mismatch.locations[0].city!.country.code = "IQ";
  assert.equal(approvalData(mismatch), null);
  const inactive = fixture(); inactive.locations[0].city!.isActive = false;
  assert.equal(approvalData(inactive), null);
});
