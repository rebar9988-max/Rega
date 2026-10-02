import { test } from "node:test";
import assert from "node:assert/strict";
import { composeSearchText, reindexAll, reindexBusinessTree } from "../src/lib/search-index";

/**
 * In-memory stand-in for the Prisma calls reindexing makes. Like Prisma's @updatedAt, `updatedAt` changes only
 * when `update` is called, so "no write" and "updatedAt unchanged" are checked through the same mechanism.
 */
type Row = { id: string; searchText: string; updatedAt: number; [k: string]: unknown };
function fakeDb() {
  let clock = 1;
  const cat = { nameCkb: "یاسایی", nameKmr: null, nameDe: "Recht", nameEn: "Legal", nameAr: null, nameFa: null, nameTr: null };
  const city = { nameEn: "Berlin", nameCkb: "بەرلین", nameKmr: null, nameDe: "Berlin", nameAr: null, nameTr: null };
  const business: Row = {
    id: "b1", searchText: "stale", updatedAt: 0, name: "Kurdistan Rechtsberatung", nameCkb: "ڕاوێژکاری یاسایی", nameKmr: null, nameAr: null, nameTr: null,
    description: "Beratung", descriptionCkb: null, descriptionKmr: null, descriptionDe: null, descriptionAr: null, descriptionTr: null,
    tags: ["anwalt"], category: cat,
  };
  const services: Row[] = [
    { id: "s1", searchText: "", updatedAt: 0, status: "published", name: "Erstberatung", nameCkb: null, nameKmr: null, nameAr: null, nameTr: null, description: null, descriptionCkb: null, descriptionDe: null, descriptionAr: null, category: cat },
    { id: "s2", searchText: "", updatedAt: 0, status: "draft", name: "Geheimprojekt", nameCkb: null, nameKmr: null, nameAr: null, nameTr: null, description: null, descriptionCkb: null, descriptionDe: null, descriptionAr: null, category: null },
  ];
  const locations: Row[] = [
    { id: "l1", searchText: "", updatedAt: 0, status: "active", label: null, addressLine1: "Karl-Marx-Allee 12", addressLine2: null, postalCode: "10178", city },
    { id: "l2", searchText: "", updatedAt: 0, status: "archived", label: null, addressLine1: "Hinterhof 1", addressLine2: null, postalCode: null, city: { ...city, nameEn: "Potsdam", nameCkb: null, nameDe: "Potsdam" } },
  ];
  const writes: string[] = [];
  const updater = (rows: Row[], kind: string) => ({
    update: async ({ where, data }: { where: { id: string }; data: { searchText: string } }) => {
      const row = rows.find((r) => r.id === where.id)!;
      row.searchText = data.searchText;
      row.updatedAt = clock++;
      writes.push(`${kind}:${row.id}`);
      return row;
    },
  });
  const clone = <T>(v: T): T => structuredClone(v);
  const db = {
    business: {
      ...updater([business], "business"),
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === business.id ? clone({ ...business, services, locations }) : null),
      findMany: async ({ cursor }: { cursor?: { id: string } }) => (cursor ? [] : [{ id: business.id }]),
    },
    service: updater(services, "service"),
    location: updater(locations, "location"),
  };
  return { db: db as never, business, services, locations, writes };
}

test("first run persists the composed search text of business, services and locations (existing behaviour)", async () => {
  const f = fakeDb();
  await reindexBusinessTree(f.db, "b1");
  assert.deepEqual(f.writes.sort(), ["business:b1", "location:l1", "location:l2", "service:s1", "service:s2"]);
  // Business: names, tags, category, active cities and published services; never drafts or archived places.
  assert.equal(f.business.searchText, composeSearchText([
    "Kurdistan Rechtsberatung", "ڕاوێژکاری یاسایی", "anwalt", "یاسایی", "Recht", "Legal", "بەرلین", "Berlin", "Berlin",
    "Erstberatung", "یاسایی", "Recht", "Legal", "Beratung",
  ]));
  assert.ok(!f.business.searchText.includes("geheimprojekt"));
  assert.ok(!f.business.searchText.includes("potsdam"));
  // Service and location rows keep their own composition.
  assert.ok(f.services[0].searchText.includes("erstberatung") && f.services[0].searchText.includes("kurdistan rechtsberatung"));
  assert.ok(f.locations[0].searchText.includes("karl-marx-allee 12") && f.locations[0].searchText.includes("10178"));
});

test("unchanged search text: no database write and updatedAt stays as it was", async () => {
  const f = fakeDb();
  await reindexBusinessTree(f.db, "b1");
  const stamps = [f.business, ...f.services, ...f.locations].map((r) => r.updatedAt);
  f.writes.length = 0;
  await reindexBusinessTree(f.db, "b1");
  await reindexBusinessTree(f.db, "b1");
  assert.deepEqual(f.writes, []);
  assert.deepEqual([f.business, ...f.services, ...f.locations].map((r) => r.updatedAt), stamps);
});

test("changed search text is persisted, and only for the rows whose text changed", async () => {
  const f = fakeDb();
  await reindexBusinessTree(f.db, "b1");
  f.writes.length = 0;
  f.locations[0].postalCode = "10179"; // only this location's own text depends on it
  await reindexBusinessTree(f.db, "b1");
  assert.deepEqual(f.writes, ["location:l1"]);
  assert.ok(f.locations[0].searchText.includes("10179"));

  f.writes.length = 0;
  f.business.name = "Kurdistan Recht"; // the business name is part of every row in the tree
  await reindexBusinessTree(f.db, "b1");
  assert.deepEqual(f.writes.sort(), ["business:b1", "location:l1", "location:l2", "service:s1", "service:s2"]);
  assert.ok(f.business.searchText.startsWith("kurdistan recht "));
});

test("reindexAll is a no-op on an up-to-date index; missing businesses are ignored", async () => {
  const f = fakeDb();
  assert.equal(await reindexAll(f.db), 1);
  f.writes.length = 0;
  assert.equal(await reindexAll(f.db), 1);
  assert.deepEqual(f.writes, []);
  await reindexBusinessTree(f.db, "does-not-exist");
  assert.deepEqual(f.writes, []);
});
