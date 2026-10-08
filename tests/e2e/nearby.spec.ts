import { expect, test } from "./fixtures";

const BERLIN = { latitude: 52.5201, longitude: 13.4049 };

test("nearby API: distance-sorted, radius-bounded, validated", async ({ request }) => {
  const res = await request.get("/api/v1/nearby?lat=52.52&lng=13.405&radius=10");
  expect(res.status()).toBe(200);
  const body = await res.json();
  const slugs = body.data.map((i: { business: { slug: string } }) => i.business.slug);
  expect(slugs).toContain("kurdistan-rechtsberatung");
  expect(slugs).not.toContain("zagros-restaurant"); // Erbil is ~3,000 km away
  expect(body.data[0].distanceKm).toBeLessThan(1);
  expect(body.data[0]).not.toHaveProperty("openingHours");
  expect(body.data[0].business).not.toHaveProperty("createdById");
  for (const bad of ["lat=999&lng=0", "lat=52&lng=13&radius=7", "lat=abc&lng=13", "lat=52&lng=13&page=999", "lat=52&lng=13&category=%27;drop"]) {
    const r = await request.get(`/api/v1/nearby?${bad}`);
    expect(r.status(), bad).toBe(422);
  }
  const far = await (await request.get("/api/v1/nearby?lat=36.191&lng=44.009&radius=25")).json();
  expect(far.data.map((i: { business: { slug: string } }) => i.business.slug)).toEqual(["zagros-restaurant"]);
});

test.describe("with location permission", () => {
  test.use({ geolocation: BERLIN, permissions: ["geolocation"] });
  test("Near Me finds nearby businesses with distance, filters and map/list views", async ({ page }) => {
    await page.goto("/de/nearby");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("In der Nähe");
    await page.getByTestId("nearby-locate").click();
    await expect(page.getByTestId("nearby-place")).toContainText("Ihrem Standort");
    const results = page.getByTestId("nearby-results");
    await expect(results).toContainText("Kurdistan Rechtsberatung");
    await expect(page.getByTestId("nearby-distance").first()).toContainText("km");
    await page.getByTestId("nearby-q").fill("zzzz-nothing");
    await expect(page.getByTestId("nearby-empty")).toBeVisible();
    await page.getByTestId("nearby-q").fill("");
    await expect(results).toContainText("Kurdistan Rechtsberatung");
    await stubBasemap(page);
    await page.getByTestId("nearby-view-map").click();
    await expect(page.getByTestId("discovery-map")).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
    // The visitor's own (shared) position is shown on the map.
    await expect(page.getByRole("img", { name: "Ihr Standort" })).toBeAttached();
  });

  test("map view: accessible markers, preview card, list selection, Escape, search this area", async ({ page }) => {
    await stubBasemap(page);
    await page.goto("/de/nearby");
    await page.getByTestId("nearby-locate").click();
    await expect(page.getByTestId("nearby-results")).toContainText("Kurdistan Rechtsberatung");
    await page.getByTestId("nearby-view-map").click();
    const map = page.getByTestId("discovery-map");
    await expect(map).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
    const pin = map.getByRole("button", { name: "Kurdistan Rechtsberatung" });
    // Nearby businesses may be clustered: open clusters until the marker itself is shown.
    for (let i = 0; i < 6 && !(await pin.isVisible()); i++) {
      const cluster = map.getByRole("button", { name: /Orte – zum Vergrößern klicken/ }).first();
      if (await cluster.isVisible()) { await cluster.click(); await page.waitForTimeout(700); } else await page.waitForTimeout(300);
    }
    await expect(pin).toBeVisible();
    await pin.click();
    const preview = page.getByTestId("map-preview");
    await expect(preview).toContainText("Kurdistan Rechtsberatung");
    await expect(preview).toContainText("Recht"); // category from the database
    await expect(preview.getByRole("link", { name: "Details ansehen" })).toHaveAttribute("href", "/de/business/kurdistan-rechtsberatung");
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    // Keyboard: the marker is a real button.
    await pin.focus();
    await page.keyboard.press("Enter");
    await expect(preview).toBeVisible();
    await preview.getByRole("button", { name: "Schließen" }).click();
    await expect(preview).toHaveCount(0);
    // On large screens the results sit beside the map; selecting one opens its preview.
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await page.getByTestId("nearby-map-list").getByRole("button", { name: /Kurdistan Rechtsberatung/ }).click();
      await expect(preview).toBeVisible();
      await page.keyboard.press("Escape");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Moving the map offers a new search there. (On touch screens one finger scrolls the page and two fingers move
    // the map, so this is exercised with a mouse on desktop.)
    if (test.info().project.name !== "desktop") return;
    // The drag uses viewport coordinates: bring the whole map on screen first (its centre must not be below the fold).
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 250, box.y + box.height / 2 - 150, { steps: 12 });
    await page.mouse.up();
    await page.getByTestId("map-search-area").click();
    await expect(page.getByTestId("nearby-place")).toHaveText("In diesem Gebiet");
  });

  test("map fallback: a basemap outage shows a clean message and the list keeps working", async ({ page }) => {
    await page.route("https://tiles.openfreemap.org/**", (r) => r.abort());
    await page.goto("/de/nearby");
    await page.getByTestId("nearby-locate").click();
    await expect(page.getByTestId("nearby-results")).toContainText("Kurdistan Rechtsberatung");
    await page.getByTestId("nearby-view-map").click();
    await expect(page.getByTestId("map-fallback")).toContainText("Karte konnte nicht geladen werden", { timeout: 25_000 });
    await page.getByTestId("nearby-view-list").click();
    await expect(page.getByTestId("nearby-results")).toContainText("Kurdistan Rechtsberatung");
  });
});

/** Tests never depend on the external basemap: serve a minimal MapLibre style instead. */
async function stubBasemap(page: import("@playwright/test").Page) {
  await page.route("https://tiles.openfreemap.org/**", (r) => r.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eceee9" } }] }),
  }));
}

test("map mode API: every match in range in one response, with category, no internal fields", async ({ request }) => {
  const res = await request.get("/api/v1/nearby?lat=52.52&lng=13.405&radius=10&mode=map");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.meta.pages).toBe(1);
  const item = body.data.find((i: { business: { slug: string } }) => i.business.slug === "kurdistan-rechtsberatung");
  expect(item.category?.nameDe).toBe("Recht");
  expect(item.business).not.toHaveProperty("services");
  expect(item.business).not.toHaveProperty("createdById");
  expect((await request.get("/api/v1/nearby?lat=52.52&lng=13.405&mode=all")).status()).toBe(422);
});

test("place search: typing a German city name offers to search there (RTL)", async ({ page }) => {
  await page.goto("/ckb/nearby");
  await expect(page.getByTestId("nearby-city")).toHaveValue("");
  // The search box belongs to the results view: it appears once the visitor has chosen a location.
  await page.getByTestId("nearby-city").selectOption({ label: "هامبورگ" });
  await expect(page.getByTestId("nearby-place")).toContainText("هامبورگ");
  await page.getByTestId("nearby-q").fill("بەرل");
  await page.getByTestId("nearby-place-matches").getByRole("button", { name: /بەرلین/ }).click();
  await expect(page.getByTestId("nearby-place")).toContainText("بەرلین");
  await expect(page.getByTestId("nearby-results")).toContainText("ڕاوێژکاری یاسایی کوردستان");
});

test("business detail shows its locations on an interactive map", async ({ page }) => {
  await stubBasemap(page);
  await page.goto("/de/businesses/kurdistan-rechtsberatung");
  const shell = page.getByTestId("places-map-shell");
  await shell.scrollIntoViewIfNeeded();
  const map = page.getByTestId("discovery-map");
  await expect(map).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  await map.getByRole("button", { name: /Kurdistan Rechtsberatung|Hauptsitz|Standort/ }).first().click();
  await expect(page.getByTestId("map-preview").getByRole("link", { name: "Route" })).toHaveAttribute("href", /google\.com\/maps\/dir\/\?api=1&destination=52\.52,13\.405/);
});

test.describe("without location permission", () => {
  test.use({ permissions: [] });
  test("denied permission falls back to choosing a city; no city is preselected (RTL)", async ({ page, context }) => {
    await context.clearPermissions();
    await page.addInitScript(() => {
      // Simulate the visitor refusing the permission prompt.
      navigator.geolocation.getCurrentPosition = (_ok, err) => err?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "denied" } as GeolocationPositionError);
    });
    await page.goto("/ckb/nearby");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("nearby-city")).toHaveValue(""); // no default city
    await page.getByTestId("nearby-locate").click();
    await expect(page.getByTestId("nearby-notice")).toBeVisible();
    await page.getByTestId("nearby-city").selectOption({ label: "بەرلین" });
    await expect(page.getByTestId("nearby-results")).toContainText("ڕاوێژکاری یاسایی کوردستان");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test("only published providers appear; draft and deleted ones never do", async ({ request }) => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const slugs = ["e2e-nearby-draft", "e2e-nearby-deleted"];
  try {
    for (const [i, slug] of slugs.entries()) {
      await prisma.business.upsert({
        where: { slug }, update: {},
        create: {
          slug, name: slug, status: i === 0 ? "draft" : "published", deletedAt: i === 1 ? new Date() : null,
          locations: { create: { addressLine1: "Alexanderplatz 1", countryCode: "DE", latitude: 52.5219, longitude: 13.4132, isPrimary: true } },
        },
      });
    }
    const body = await (await request.get("/api/v1/nearby?lat=52.52&lng=13.405&radius=5")).json();
    const found = body.data.map((i: { business: { slug: string } }) => i.business.slug);
    for (const s of slugs) expect(found).not.toContain(s);
    expect(found).toContain("kurdistan-rechtsberatung");
  } finally {
    await prisma.business.deleteMany({ where: { slug: { in: slugs } } }); // test database only
    await prisma.$disconnect();
  }
});

test("city picker lists only German public-market cities, with none preselected", async ({ page }) => {
  await page.goto("/de/nearby");
  const select = page.getByTestId("nearby-city");
  await expect(select).toHaveValue("");
  const labels = (await select.locator("option").allTextContents()).slice(1); // skip placeholder
  expect(labels.length).toBeGreaterThan(0);
  expect(labels).toContain("Berlin");
  for (const foreign of ["Erbil", "Sulaimaniyya", "London", "Paris", "Amsterdam", "Stockholm", "Wien"]) {
    expect(labels).not.toContain(foreign);
  }
});

test.describe("location unavailable", () => {
  test("position unavailable shows a clear selection state", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, err) => err?.({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "unavailable" } as GeolocationPositionError);
    });
    await page.goto("/en/nearby");
    await page.getByTestId("nearby-locate").click();
    await expect(page.getByTestId("nearby-notice")).toContainText("could not be determined");
    await expect(page.getByTestId("nearby-city")).toHaveValue("");
    await expect(page.getByTestId("nearby-results")).toHaveCount(0); // nothing is shown until the visitor chooses
  });

  test("browser without geolocation: only the city picker is offered", async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true }); });
    await page.goto("/en/nearby");
    await page.getByTestId("nearby-locate").click();
    await expect(page.getByTestId("nearby-notice")).toContainText("does not support location");
    await expect(page.getByTestId("nearby-locate")).toHaveCount(0);
    await page.getByTestId("nearby-city").selectOption({ label: "Berlin" });
    await expect(page.getByTestId("nearby-results")).toContainText("Kurdistan Rechtsberatung");
  });
});
