import { expect, test } from "./fixtures";

test("business list shows published demo businesses and filters by text", async ({ page }) => {
  await page.goto("/de/businesses");
  await expect(page.getByRole("link", { name: "Zagros Restaurant" })).toBeVisible();
  await page.getByRole("searchbox").first().fill("rechtsberatung");
  await page.getByRole("button", { name: "Anwenden" }).click();
  await expect(page).toHaveURL(/q=rechtsberatung/);
  await expect(page.getByRole("link", { name: "Kurdistan Rechtsberatung" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zagros Restaurant" })).toHaveCount(0);
});

test("empty result shows a helpful empty state", async ({ page }) => {
  await page.goto("/de/businesses?q=zzzzzzzz");
  await expect(page.getByRole("status")).toContainText("Keine Ergebnisse");
});

test("invalid query params never crash the page", async ({ page }) => {
  const res = await page.goto("/de/businesses?page=-5&sort=evil&category[]=x&verified=maybe");
  expect(res?.status()).toBe(200);
});

test("business detail: content, contact actions, structured data", async ({ page }) => {
  await page.goto("/de/businesses/kurdistan-rechtsberatung");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kurdistan Rechtsberatung");
  await expect(page.getByRole("link", { name: "Anrufen", exact: true })).toHaveAttribute("href", /^tel:\+?\d+$/);
  await expect(page.getByRole("link", { name: "Website besuchen" })).toHaveAttribute("rel", /noopener/);
  const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((t) => JSON.parse(t));
  const ld = blocks.find((b) => b["@type"] === "LocalBusiness");
  expect(ld?.name).toBe("Kurdistan Rechtsberatung");
  expect(blocks.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);
  await expect(page.getByRole("heading", { name: "Standorte" })).toBeVisible();
});

test("Kurdish business name keeps its own direction on a German page", async ({ page }) => {
  await page.goto("/ckb/businesses/kurdistan-rechtsberatung");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  // Address is Latin: it must be isolated as LTR inside the RTL page.
  await expect(page.locator('address bdi[dir="ltr"]').first()).toContainText("Karl-Marx-Allee");
});

test("service list → service detail → provider", async ({ page }) => {
  await page.goto("/de/services");
  await page.getByRole("link", { name: "Catering" }).click();
  await expect(page).toHaveURL(/\/de\/services\/zagros-restaurant\/main$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catering");
  await page.getByRole("link", { name: "Zagros Restaurant" }).first().click();
  await expect(page).toHaveURL(/\/de\/businesses\/zagros-restaurant$/);
});

test("locations page lists cities and filters by city", async ({ page }) => {
  await page.goto("/de/locations");
  await page.getByRole("link", { name: /^Berlin/ }).click();
  await expect(page).toHaveURL(/city=/);
  await expect(page.getByRole("link", { name: "Kurdistan Rechtsberatung" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zagros Restaurant" })).toHaveCount(0);
});

test("unified search: tabs, hint for short queries, results", async ({ page }) => {
  await page.goto("/de/search");
  await expect(page.getByRole("status")).toContainText("mindestens 2 Zeichen");
  await page.goto("/de/search?q=zagros");
  await expect(page.getByRole("heading", { name: "Unternehmen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dienstleistungen" })).toBeVisible();
  await page.getByRole("link", { name: "in Unternehmen" }).click();
  await expect(page).toHaveURL(/type=businesses/);
  await expect(page.getByRole("heading", { name: "Dienstleistungen" })).toHaveCount(0);
});

test("home search form: what + where (city) navigate to filtered businesses", async ({ page }) => {
  await page.goto("/de");
  const form = page.locator("main form[role=search]");
  await form.getByRole("searchbox").fill("clinic");
  await form.getByRole("combobox").selectOption({ label: "Sulaimaniyya" });
  await form.getByRole("button", { name: "Suche" }).click();
  await expect(page).toHaveURL(/\/de\/businesses\?q=clinic&city=/);
  await expect(page.getByRole("link", { name: "Sulaymaniyah Clinic" }).first()).toBeVisible();
});

test("draft businesses are never public", async ({ request }) => {
  const res = await request.get("/api/v1/businesses?perPage=100");
  const json = await res.json();
  expect(json.data.every((b: { status: string }) => b.status === "published")).toBe(true);
});
