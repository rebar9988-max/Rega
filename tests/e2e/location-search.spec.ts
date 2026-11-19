/**
 * Smart location search: one field for city, district/street and postal code, with typo tolerance, one canonical row
 * per city, no silent choice for an ambiguous postal code, translated labels and intact geographic relationships.
 * Runs on desktop and on a phone (bottom sheet), on PostgreSQL and on D1.
 */
import { testDatabaseClient } from "./database-client";
import { expect, test } from "./fixtures";

type City = { id: string; nameEn: string; regionId: string | null; countryCode: string; match?: { kind: string; value: string } };
type Geo = { cities: City[]; regions: { id: string }[]; ambiguous: boolean };

const geo = async (request: import("@playwright/test").APIRequestContext, q: string): Promise<Geo> => {
  const res = await request.get(`/api/v1/geo?country=DE&q=${encodeURIComponent(q)}`);
  expect(res.status()).toBe(200);
  return (await res.json()).data as Geo;
};
const trigger = (page: import("@playwright/test").Page) => page.locator("#f-city-search");

test.describe.serial("smart location search", () => {
  test("postal code resolves country, region and city of the listing", async ({ request }) => {
    for (const q of ["10178", "1017"]) {
      const data = await geo(request, q);
      const berlin = data.cities.find((c) => c.nameEn === "Berlin");
      expect(berlin?.match).toEqual({ kind: "postal", value: "10178" });
      expect(berlin?.countryCode).toBe("DE");
      expect(data.ambiguous).toBe(false);
      if (berlin?.regionId) expect((await geo(request, "")).regions.map((r) => r.id)).toContain(berlin.regionId);
    }
    expect((await geo(request, "99999")).cities).toEqual([]);
  });

  test("street search finds the city; a city found by name carries no address hint", async ({ request }) => {
    const street = await geo(request, "Karl-Marx-Allee");
    expect(street.cities.find((c) => c.nameEn === "Berlin")?.match).toEqual({ kind: "street", value: "Karl-Marx-Allee 12" });
    const byName = await geo(request, "berlin");
    expect(byName.cities.find((c) => c.nameEn === "Berlin")?.match).toBeUndefined();
  });

  test("typos are tolerated and every location appears once", async ({ request }) => {
    expect((await geo(request, "Hambrug")).cities.some((c) => c.nameEn === "Hamburg")).toBe(true);
    expect((await geo(request, "Berlni")).cities.some((c) => c.nameEn === "Berlin")).toBe(true);
    for (const q of ["ber", "berlin", "10178", "Karl"]) {
      const ids = (await geo(request, q)).cities.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect((await geo(request, "zzzzqqqq")).cities).toEqual([]);
  });

  test("an ambiguous postal code lists every city and is never chosen automatically", async ({ request, page }) => {
    const db = testDatabaseClient();
    const slug = "e2e-ambiguous-postal";
    try {
      const source = await db.business.findFirstOrThrow({ where: { slug: "kurdistan-rechtsberatung" }, select: { categoryId: true } });
      const hamburg = await db.city.findFirstOrThrow({ where: { nameEn: "Hamburg", country: { code: "DE" } }, select: { id: true } });
      await db.business.create({
        data: {
          slug, name: "E2E Ambiguous Postal", status: "published", verified: true, categoryId: source.categoryId,
          locations: { create: { addressLine1: "Teststraße 1", postalCode: "10178", countryCode: "DE", cityId: hamburg.id, isPrimary: true } },
        },
      });
      const data = await geo(request, "10178");
      expect(data.ambiguous).toBe(true);
      expect(data.cities.filter((c) => c.match?.kind === "postal").map((c) => c.nameEn).sort()).toEqual(["Berlin", "Hamburg"]);

      await page.goto("/de/businesses/legal");
      await trigger(page).click();
      const panel = page.getByRole("dialog");
      const search = panel.getByRole("combobox").first();
      await search.fill("10178");
      await expect(panel.getByRole("status").filter({ hasText: "mehreren Orten" })).toBeVisible();
      await expect(search).not.toHaveAttribute("aria-activedescendant", /.+/);
      await page.keyboard.press("Enter");
      await expect(panel).toBeVisible(); // nothing was chosen
      await page.keyboard.press("ArrowDown");
      await expect(search).toHaveAttribute("aria-activedescendant", /.+/);
    } finally {
      await db.business.deleteMany({ where: { slug } }); // test database only
      await db.$disconnect();
    }
  });

  test("selector: postal code suggestion with hint, chosen by tap/click", async ({ page }) => {
    await page.goto("/de/businesses/legal");
    await trigger(page).click();
    const panel = page.getByRole("dialog");
    await panel.getByPlaceholder("Stadt, Stadtteil, Straße oder PLZ").fill("10178");
    const option = panel.getByRole("listbox").getByRole("option", { name: /^Berlin/ });
    await expect(option).toContainText("10178");
    await option.click();
    await expect(panel).toBeHidden();
    await expect(trigger(page)).toContainText("Berlin");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("one character is narrowed locally; country/region lists are folded away but still usable", async ({ page }) => {
    const queries: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/api/v1/geo?") && r.url().includes("q=")) queries.push(r.url()); });
    await page.goto("/de/businesses/legal");
    await trigger(page).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("listbox").getByRole("option").first()).toBeVisible();
    await panel.getByRole("combobox").first().fill("b");
    await page.waitForTimeout(400);
    expect(queries).toEqual([]);
    await panel.getByRole("combobox").first().fill("");
    const browse = panel.getByText("Nach Land oder Region durchsuchen");
    if (await browse.count()) {
      await expect(panel.locator("details select").first()).toBeHidden();
      await browse.click();
      await expect(panel.locator("details select").first()).toBeVisible();
    }
  });

  test("translations: Kurdish (RTL) and English labels", async ({ page }) => {
    await page.goto("/ckb/businesses/legal");
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await trigger(page).click();
    await expect(page.getByRole("dialog").getByPlaceholder("شار، گەڕەک، شەقام یان کۆدی پۆستە")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/en/businesses/legal");
    await trigger(page).click();
    await expect(page.getByRole("dialog").getByPlaceholder("City, district, street or postal code")).toBeVisible();
  });
});
