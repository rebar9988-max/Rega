import { expect, test } from "@playwright/test";

/**
 * The business profile is one shared, data-driven page for every business and every category (legal, food, health
 * demo listings here, and every listing created later): same actions, no duplicated information, no empty sections,
 * no sideways scrolling in any language or on small phones.
 */
const SLUGS = ["kurdistan-rechtsberatung", "zagros-restaurant", "sulaymaniyah-clinic"];
const LOCALES = ["de", "ckb", "kmr", "en", "ar", "fa", "tr"];

const overflowX = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("every business in every language uses the same profile: identity, actions, no sideways scroll", async ({ page }) => {
  for (const slug of SLUGS) {
    for (const locale of LOCALES) {
      const res = await page.goto(`/${locale}/business/${slug}`);
      expect(res?.status(), `${locale}/${slug}`).toBe(200);
      await expect(page.getByTestId("business-profile").getByRole("heading", { level: 1 })).toBeVisible();
      const actions = page.getByTestId("business-actions");
      await expect(actions.getByTestId("share-button")).toBeVisible();
      // Exactly one primary (red) action.
      expect(await actions.locator(".bg-brand").count(), `${locale}/${slug}`).toBe(1);
      expect(await overflowX(page), `${locale}/${slug}`).toBeLessThanOrEqual(0);
    }
  }
});

test("small phones (320, 375, 430 px) keep every action reachable without sideways scrolling", async ({ page }) => {
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 800 });
    for (const locale of ["ckb", "de"]) {
      await page.goto(`/${locale}/business/kurdistan-rechtsberatung`);
      expect(await overflowX(page), `${locale} @${width}`).toBeLessThanOrEqual(0);
      // In RTL an overflowing header is not scrollable but cut off at the left edge: the logo must be fully on screen.
      const logo = await page.locator("header").getByRole("link", { name: "Rega24" }).boundingBox();
      expect(logo && logo.x >= 0 && logo.x + logo.width <= width, `logo ${locale} @${width}`).toBeTruthy();
      for (const action of await page.getByTestId("business-actions").locator("a, button").all()) {
        const box = await action.boundingBox();
        expect(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width, `${locale} @${width}`).toBeTruthy();
      }
    }
  }
});

test("information is shown once: phone, about text, ratings, opening state", async ({ page }) => {
  await page.goto("/de/business/kurdistan-rechtsberatung");
  const article = page.locator("article");
  // The phone number is displayed in one place (the call button carries the action, not the number).
  const phone = (await page.getByRole("complementary").locator('a[href^="tel:"]').textContent())?.trim();
  expect(phone).toBeTruthy();
  await expect(article.getByText(phone!, { exact: true })).toHaveCount(1);
  // The description is not repeated in the header.
  const about = (await page.locator("section[aria-labelledby=about]").innerText()).split("\n")[1]?.slice(0, 40);
  if (about) expect((await article.innerText()).split(about).length - 1).toBe(1);
  // No "no ratings" placeholder in the header next to the reviews section's own empty state.
  await expect(page.getByTestId("business-profile").getByText("Noch keine Bewertungen")).toHaveCount(0);
  // An empty services list is not shown as a section.
  await expect(article.getByText("Noch keine Dienstleistungen veröffentlicht.")).toHaveCount(0);
  // The open state of the main location appears once.
  expect(await page.getByTestId("open-state").count()).toBeLessThanOrEqual(1);
});

test("share copies the page link where the device has no share sheet", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permission is Chromium-only");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/de/business/zagros-restaurant");
  await page.evaluate(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
  await page.getByTestId("share-button").click();
  await expect(page.getByTestId("share-button").getByRole("status")).toHaveText("Link kopiert");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/de\/business\/zagros-restaurant$/);
});

test("directions offer the map apps with the business destination filled in, no location request", async ({ page, context }) => {
  await context.clearPermissions();
  for (const locale of ["de", "ckb"]) {
    await page.goto(`/${locale}/business/kurdistan-rechtsberatung`);
    await page.getByTestId("directions-button").click();
    const menu = page.getByTestId("directions-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId("directions-google")).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=52.52,13.405");
    await expect(menu.getByTestId("directions-apple")).toHaveAttribute("href", "https://maps.apple.com/?daddr=52.52,13.405");
    await expect(menu.getByTestId("directions-waze")).toHaveAttribute("href", "https://waze.com/ul?ll=52.52,13.405&navigate=yes");
    await expect(menu.getByTestId("directions-google")).toHaveAttribute("target", "_blank");
    // The menu stays on screen in RTL and LTR.
    const box = await menu.boundingBox();
    const width = page.viewportSize()!.width;
    expect(box && box.x >= 0 && box.x + box.width <= width, locale).toBeTruthy();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  }
});

test("the address is shown once, next to the actions", async ({ page }) => {
  await page.goto("/de/business/kurdistan-rechtsberatung");
  await expect(page.getByTestId("business-address")).toContainText("Karl-Marx-Allee 12");
  await expect(page.locator("article").getByText("Karl-Marx-Allee 12")).toHaveCount(1);
});
