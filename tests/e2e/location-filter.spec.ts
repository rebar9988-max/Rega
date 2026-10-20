/**
 * Location filter: the API behind the selector, the selector itself (search, keyboard, nearby detection, bottom sheet,
 * Kurdish RTL) and the saved place shared by the home page, the business list and the map.
 */
import { expect, test } from "./fixtures";

type City = { id: string; slug: string | null; nameEn: string; regionId: string | null; countryCode: string; count: number };

const STORAGE_KEY = "rega-location";
const trigger = (page: import("@playwright/test").Page) => page.locator("#f-city-search");
const dialog = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Ort wählen" });

test.describe("geo API", () => {
  test("returns bounded, real places and never the whole gazetteer", async ({ request }) => {
    const res = await request.get("/api/v1/geo?country=DE");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("s-maxage");
    const { data } = await res.json();
    expect(data.countryCode).toBe("DE");
    expect(data.countries.map((c: { code: string }) => c.code)).toContain("DE");
    expect(data.cities.length).toBeGreaterThan(0);
    expect(data.cities.length).toBeLessThanOrEqual(40);
    expect(data.cities.some((c: City) => c.nameEn === "Berlin")).toBe(true);
    expect(data.cities.every((c: City) => c.countryCode === "DE")).toBe(true);
    expect(Array.isArray(data.regions)).toBe(true);
  });

  test("a region narrows the cities to that region", async ({ request }) => {
    const { data } = await (await request.get("/api/v1/geo?country=DE")).json();
    test.skip(data.regions.length === 0, "no region data in this database");
    const region = data.regions[0] as { id: string };
    const inRegion = (await (await request.get(`/api/v1/geo?country=DE&region=${region.id}`)).json()).data;
    expect(inRegion.cities.length).toBeGreaterThan(0);
    expect(inRegion.cities.every((c: City) => c.regionId === region.id)).toBe(true);
  });

  test("text search works in German spelling variants and in Kurdish", async ({ request }) => {
    const find = async (q: string) => (await (await request.get(`/api/v1/geo?country=DE&q=${encodeURIComponent(q)}`)).json()).data.cities as City[];
    expect((await find("ber"))[0]?.nameEn).toBe("Berlin");
    expect((await find("koeln")).some((c) => c.slug === "koeln")).toBe(true);
    expect((await find("Köln")).some((c) => c.slug === "koeln")).toBe(true);
    expect((await find("بەرلین")).some((c) => c.nameEn === "Berlin")).toBe(true);
    expect(await find("zzzzqqqq")).toEqual([]);
  });

  test("one city by id, nearest city to a position, and strict validation", async ({ request }) => {
    const { data } = await (await request.get("/api/v1/geo?country=DE&q=berlin")).json();
    const berlin = (data.cities as City[]).find((c) => c.nameEn === "Berlin")!;
    expect(berlin).toBeTruthy();
    expect((await (await request.get(`/api/v1/geo?city=${berlin.id}`)).json()).data.city.id).toBe(berlin.id);
    expect((await (await request.get("/api/v1/geo?city=does-not-exist")).json()).data.city).toBeNull();

    const near = await request.get("/api/v1/geo?lat=52.52&lng=13.405");
    expect(near.headers()["cache-control"]).toBe("no-store");
    expect((await near.json()).data.nearest.city.nameEn).toBe("Berlin");
    // The middle of the North Sea is far from every listed city.
    expect((await (await request.get("/api/v1/geo?lat=55&lng=4")).json()).data.nearest).toBeNull();

    for (const bad of ["country=Germany", "lat=91&lng=0", "lat=52", "limit=500", "region=%3Cscript%3E"]) {
      expect((await request.get(`/api/v1/geo?${bad}`)).status(), bad).toBe(422);
    }
  });
});

test.describe("location selector", () => {
  test("business list: search a city, choose it, apply, and the list is filtered", async ({ page }) => {
    await page.goto("/de/businesses");
    await expect(trigger(page)).toHaveAccessibleName("Stadt: Alle Städte");
    await trigger(page).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByPlaceholder("Stadt suchen").fill("ber");
    await dialog(page).getByRole("listbox").getByRole("option", { name: /^Berlin/ }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toContainText("Berlin");
    await expect(page.locator("#f-city")).not.toHaveValue("");

    await page.locator("#directory-filters").getByRole("button", { name: "Suche" }).click();
    await expect(page).toHaveURL(/[?&]city=/);
    await expect(page.getByRole("link", { name: "Kurdistan Rechtsberatung" }).first()).toBeVisible();
  });

  test("keyboard: open, type, arrow keys, Enter to choose, Escape to close and focus returns", async ({ page }) => {
    await page.goto("/de/businesses");
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    const search = dialog(page).getByPlaceholder("Stadt suchen");
    await expect(search).toBeFocused();
    await search.fill("hamburg");
    await expect(dialog(page).getByRole("listbox").getByRole("option", { name: /^Hamburg/ }).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toContainText("Hamburg");

    await trigger(page).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });

  test("the chosen place is saved in this browser only, as ids, and survives a reload", async ({ page }) => {
    await page.goto("/de/businesses");
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
    await trigger(page).click();
    await dialog(page).getByPlaceholder("Stadt suchen").fill("berlin");
    await dialog(page).getByRole("listbox").getByRole("option", { name: /^Berlin/ }).click();
    const stored = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY))!);
    expect(Object.keys(stored).sort()).toEqual(["cityId", "countryCode", "regionId", "savedAt", "v"]);
    expect(stored.countryCode).toBe("DE");
    await page.reload();
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY))!).cityId).toBe(stored.cityId);
  });

  test("shared state: the home page, the business list and the map use the same saved place", async ({ page }) => {
    await page.goto("/de");
    await expect(trigger(page)).toContainText("Alle Städte");
    await trigger(page).click();
    await dialog(page).getByPlaceholder("Stadt suchen").fill("berlin");
    await dialog(page).getByRole("listbox").getByRole("option", { name: /^Berlin/ }).click();
    await expect(trigger(page)).toContainText("Berlin");

    // The business list is filtered without choosing again.
    await page.goto("/de/businesses");
    await expect(page).toHaveURL(/[?&]city=/);
    await expect(trigger(page)).toContainText("Berlin");
    await expect(page.getByRole("link", { name: "Kurdistan Rechtsberatung" }).first()).toBeVisible();

    // The map starts at the same place.
    await page.goto("/de/nearby");
    await expect(page.getByTestId("nearby-city-filter")).not.toHaveValue("");
    await expect(page.getByTestId("nearby-city-filter").locator("option:checked")).toContainText("Berlin");

    // Back on the home page the choice is still there.
    await page.goto("/de");
    await expect(trigger(page)).toContainText("Berlin");
  });

  test("reset clears the saved place everywhere", async ({ page }) => {
    await page.goto("/de");
    await trigger(page).click();
    await dialog(page).getByPlaceholder("Stadt suchen").fill("berlin");
    await dialog(page).getByRole("listbox").getByRole("option", { name: /^Berlin/ }).click();
    await page.goto("/de/businesses");
    await expect(page).toHaveURL(/[?&]city=/);
    await page.getByRole("link", { name: "Zurücksetzen" }).click();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
    await expect(trigger(page)).toContainText("Alle Städte");
    await page.goto("/de/businesses");
    await expect(page).not.toHaveURL(/city=[^&]/);
    await page.goto("/de");
    await expect(trigger(page)).toContainText("Alle Städte");
  });

  test("a saved choice never overrides a city (or all cities) chosen in the address", async ({ page }) => {
    await page.goto("/de");
    await trigger(page).click();
    await dialog(page).getByPlaceholder("Stadt suchen").fill("berlin");
    await dialog(page).getByRole("listbox").getByRole("option", { name: /^Berlin/ }).click();
    const all = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(all).not.toBeNull();
    // A shared link to another city shows that city and keeps the saved place untouched.
    await page.goto("/de/businesses?city=does-not-exist");
    await expect(page).toHaveURL(/city=does-not-exist/);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(all);
  });

  test("use my location picks the nearest known city", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 52.5201, longitude: 13.4049 });
    await page.goto("/de/businesses");
    await trigger(page).click();
    await dialog(page).getByRole("button", { name: "Meinen Standort verwenden" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toContainText("Berlin");
  });

  test("a phone gets a bottom sheet that fits the screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/de/businesses");
    await trigger(page).click();
    const box = (await dialog(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(800);
    expect(box.height).toBeLessThanOrEqual(0.86 * 800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog(page).getByRole("button", { name: "Schließen" }).click();
    await expect(dialog(page)).toBeHidden();
  });

  test("desktop popover opens under the field and stays inside the window", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto("/de/businesses");
    await trigger(page).click();
    const field = (await trigger(page).boundingBox())!;
    const box = (await dialog(page).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(field.y + field.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1366);
  });

  test("Kurdish (right to left): the panel opens inside the window and finds a city by its Kurdish name", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/ckb/businesses");
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await trigger(page).click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1024);
    await panel.getByRole("combobox").first().fill("بەرلین");
    await expect(panel.getByRole("listbox").getByRole("option").filter({ hasText: "بەرلین" }).first()).toBeVisible();
    await panel.getByRole("listbox").getByRole("option").filter({ hasText: "بەرلین" }).first().click();
    await expect(trigger(page)).toContainText("بەرلین");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("the form still submits the chosen city and existing search keeps working", async ({ page }) => {
    await page.goto("/de/businesses");
    await page.locator("#f-q").fill("rechtsberatung");
    await trigger(page).click();
    await dialog(page).getByPlaceholder("Stadt suchen").fill("berlin");
    await dialog(page).getByRole("listbox").getByRole("option", { name: /^Berlin/ }).click();
    await page.locator("#directory-filters").getByRole("button", { name: "Suche" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === "rechtsberatung" && Boolean(url.searchParams.get("city")));
    await expect(page.getByRole("link", { name: "Kurdistan Rechtsberatung" }).first()).toBeVisible();
  });
});
