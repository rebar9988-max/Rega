/** Readable URLs: category, city and listing pages; old URLs keep working through permanent redirects. */
import { expect, test } from "./fixtures";

test("category pages live at /businesses/<slug>; the title and canonical use the category", async ({ page, request }) => {
  const res = await page.goto("/de/businesses/legal");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Recht");
  const html = await (await request.get("/de/businesses/legal")).text();
  expect(html).toContain('<link rel="canonical" href="https://www.regaplatform.com/de/businesses/legal"');
  // The category's businesses are listed; the category dropdown is not offered on its own page.
  await expect(page.getByRole("main")).toContainText("Kurdistan Rechtsberatung");
  await expect(page.locator('select[name="category"]')).toHaveCount(0);
  expect((await request.get("/de/businesses/no-such-category-or-business")).status()).toBe(404);
});

test("old ?category=<id> URLs redirect permanently (301) to the slug URL, keeping the other filters", async ({ request }) => {
  const cats = await (await request.get("/api/v1/categories")).json();
  const legal = cats.data.find((c: { slug: string }) => c.slug === "legal");
  const res = await request.get(`/de/businesses?category=${legal.id}&sort=rating`, { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toMatch(/\/de\/businesses\/legal\?sort=rating$/);
  // An unknown id is not redirected.
  expect((await request.get("/de/businesses?category=doesnotexist1", { maxRedirects: 0 })).status()).toBe(200);
});

test("old business URLs /businesses/<slug> redirect permanently to /business/<slug>, which renders with structured data", async ({ request, page }) => {
  const old = await request.get("/de/businesses/zagros-restaurant", { maxRedirects: 0 });
  expect([301, 308]).toContain(old.status());
  expect(old.headers()["location"]).toContain("/de/business/zagros-restaurant");
  const res = await page.goto("/de/business/zagros-restaurant");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zagros Restaurant");
  const html = await (await request.get("/de/business/zagros-restaurant")).text();
  expect(html).toContain('"@type":"LocalBusiness"');
  expect(html).toContain('<link rel="canonical" href="https://www.regaplatform.com/de/business/zagros-restaurant"');
  // Listing cards link to the new URL.
  await page.goto("/de/businesses");
  await expect(page.locator('a[href="/de/business/zagros-restaurant"]').first()).toBeAttached();
});

test("city pages: /city/<slug> and /city/<city>/<category> list only matching businesses", async ({ page }) => {
  const res = await page.goto("/de/city/berlin");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unternehmen in Berlin");
  await expect(page.getByRole("main")).toContainText("Kurdistan Rechtsberatung");
  await expect(page.getByRole("main")).not.toContainText("Zagros Restaurant"); // Erbil
  await page.goto("/de/city/berlin/legal");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Recht in Berlin");
  await expect(page.getByRole("main")).toContainText("Kurdistan Rechtsberatung");
  await page.goto("/de/city/berlin/food");
  await expect(page.getByRole("main")).not.toContainText("Kurdistan Rechtsberatung");
  expect((await page.goto("/de/city/atlantis"))?.status()).toBe(404);
  expect((await page.goto("/de/city/berlin/no-such-category"))?.status()).toBe(404);
});

test("filters show counts, zero-count cities and categories stay selectable", async ({ page }) => {
  await page.goto("/de/businesses");
  const cityOptions = page.locator('select[name="city"] option');
  await expect(cityOptions.filter({ hasText: /^Berlin \(\d+\)$/ })).toHaveCount(1);
  await expect(cityOptions.filter({ hasText: /^Bonn \(0\)$/ })).toHaveCount(1);
  await expect(page.locator('select[name="category"] option').filter({ hasText: /^Steuer & Buchhaltung \(0\)$/ })).toHaveCount(1);
});

test("an empty category shows the friendly empty state with a call to add a business", async ({ page }) => {
  await page.goto("/de/businesses/insurance");
  const cta = page.getByTestId("be-first-cta");
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/de/for-business");
});
