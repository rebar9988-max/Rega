import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";
import { reindexBusinessTree } from "../../src/lib/search-index";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const stamp = Date.now().toString(36);
async function login(page: Page, who = ADMIN) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
}
test.afterAll(async () => db.$disconnect());
test("staff verification publishes atomically; canonical categories, search, country, counts and suspension agree", async ({
  page,
  browser,
  request,
}) => {
  const city = await db.city.findFirstOrThrow({
    where: { nameEn: "Berlin", country: { code: "DE" } },
  });
  const cats = await db.category.findMany({
    where: { sectionKey: "businesses" },
  });
  const cat = (key: string) => cats.find((c) => c.key === key)!;
  const ids: string[] = [];
  for (const [label, primary, wrong] of [
    ["Barber", "beauty-barber", "travel-tickets"],
    ["Butcher", "groceries-markets", "transport-moving"],
  ]) {
    const b = await db.business.create({
      data: {
        name: `E2E ${label} ${stamp}`,
        slug: `e2e-${label.toLowerCase()}-${stamp}`,
        categoryId: cat(primary).id,
        status: "pending",
        verified: false,
        locations: {
          create: {
            addressLine1: "Street 12",
            countryCode: "DE",
            cityId: city.id,
            isPrimary: true,
            latitude: 52.5,
            longitude: 13.4,
            coordsVerifiedAt: new Date(),
          },
        },
        services: {
          create: {
            name: `E2E unrelated service ${stamp}`,
            slug: "other",
            categoryId: cat(wrong).id,
            status: "published",
          },
        },
      },
    });
    await reindexBusinessTree(db, b.id);
    ids.push(b.id);
    expect(
      (
        await (
          await request.get(
            `/api/v1/businesses?q=${encodeURIComponent(b.name)}`,
          )
        ).json()
      ).meta.total,
    ).toBe(0);
  }
  await login(page);
  const first = await page.request.patch(`/api/v1/businesses/${ids[0]}`, {
    data: { verified: true },
  });
  expect(first.status()).toBe(200);
  expect((await first.json()).data).toMatchObject({
    verified: true,
    status: "published",
    categoryId: cat("beauty-barber").id,
  });
  // Verify through the actual admin action for the second record.
  await page.goto(
    `/dr/businesses?status=pending&q=${encodeURIComponent(`E2E Butcher ${stamp}`)}`,
  );
  await page.getByRole("button", { name: "Prüfen & veröffentlichen" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(0);
  const anon = await browser.newContext();
  const publicPage = await anon.newPage();
  for (const [index, primary, wrong] of [
    [0, "beauty-barber", "travel-tickets"],
    [1, "groceries-markets", "transport-moving"],
  ] as const) {
    const b = await db.business.findUniqueOrThrow({
      where: { id: ids[index] },
    });
    const json = await (
      await request.get(
        `/api/v1/businesses?q=${encodeURIComponent(b.name)}&categoryId=${cat(primary).id}&cityId=${city.id}&country=DE`,
      )
    ).json();
    expect(json.meta.total).toBe(1);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].createdById).toBeUndefined();
    expect(json.data[0].searchText).toBeUndefined();
    expect(
      (
        await (
          await request.get(
            `/api/v1/businesses?q=${encodeURIComponent(b.name)}&categoryId=${cat(wrong).id}`,
          )
        ).json()
      ).meta.total,
    ).toBe(0);
    expect(
      (
        await (
          await request.get(
            `/api/v1/businesses?q=${encodeURIComponent(b.name)}&country=IQ`,
          )
        ).json()
      ).meta.total,
    ).toBe(0);
    await publicPage.goto(
      `/de/businesses/${primary}?q=${encodeURIComponent(b.name)}&country=DE&city=${city.id}`,
    );
    await expect(publicPage.getByRole("main")).toContainText(b.name);
    await publicPage.goto(
      `/de/search?q=${encodeURIComponent(b.name)}&type=businesses`,
    );
    await expect(publicPage.getByRole("main")).toContainText(b.name);
  }
  expect(
    (
      await page.request.patch(`/api/v1/businesses/${ids[0]}`, {
        data: { categoryId: "not-real" },
      })
    ).status(),
  ).toBe(422);
  const suspended = await page.request.post("/api/v1/businesses/bulk", {
    data: { ids: [ids[0]], action: "archive" },
  });
  expect(suspended.ok()).toBe(true);
  expect(
    (
      await (
        await request.get(
          `/api/v1/businesses?q=${encodeURIComponent(`E2E Barber ${stamp}`)}`,
        )
      ).json()
    ).meta.total,
  ).toBe(0);
  expect((await request.get(`/api/v1/businesses/${ids[0]}`)).status()).toBe(
    404,
  );
  expect(
    (
      await page.request.patch(`/api/v1/businesses/${ids[0]}`, {
        data: { verified: true },
      })
    ).status(),
  ).toBe(422);
  await anon.close();
});

test("non-owner and anonymous callers cannot verify or change categories", async ({
  page,
  request,
}) => {
  const b = await db.business.findUniqueOrThrow({
    where: { slug: "zagros-restaurant" },
  });
  expect(
    (
      await request.patch(`/api/v1/businesses/${b.id}`, {
        data: { verified: true },
      })
    ).status(),
  ).toBe(401);
  await login(page, EMPLOYEE);
  for (const data of [
    { verified: true },
    { categoryId: "seed_category_legal" },
  ])
    expect(
      (
        await page.request.patch(`/api/v1/businesses/${b.id}`, { data })
      ).status(),
    ).toBe(403);
});

