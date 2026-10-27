import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const locales = ["ckb", "kmr", "de", "en", "ar", "tr", "fa"];
const routes = ["for-business", "ai", "locations"];

test("approved page compositions preserve languages, metadata, logo and mobile geometry", async ({ page }) => {
  test.setTimeout(180_000);
  for (const locale of locales) {
    for (const route of routes) {
      await page.goto(`/${locale}/${route}`);
      await expect(page.locator("html")).toHaveAttribute("dir", ["ckb","ar","fa"].includes(locale) ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://www.rega24.com/${locale}/${route}`);
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(8);
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale}/${route} at ${width}`).toBe(true);
        await expect(page.locator('header img[src="/brand/rega-mark-512.webp"]').first()).toBeVisible();
      }
      await expect(page.locator("main")).not.toContainText(/premiumPages\.|Demo only|UI PREVIEW/);
    }
  }
});

test("city cards and categories apply real URL filters without manufacturing listings", async ({ page }) => {
  await page.goto("/de/locations?city=");
  const cityLink = page.locator('#citylist a[href*="city="]').first();
  const href = await cityLink.getAttribute("href");
  expect(href).toBeTruthy();
  await cityLink.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("city")).toBe(new URL(href!, "https://rega.invalid").searchParams.get("city"));
  const category = page.locator('select[name="category"]');
  const id = await category.locator("option").nth(1).getAttribute("value");
  await category.selectOption(id!);
  await page.locator('form[role="search"]').getByRole("button", {name:"Anwenden", exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`category=${id}`));
});

test("three page accessibility and reduced motion", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  for (const route of routes) {
    await page.goto(`/en/${route}`);
    const scan = await new AxeBuilder({page}).include("main").analyze();
    expect(scan.violations).toEqual([]);
    await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
    const dark = await new AxeBuilder({page}).include("main").analyze();
    expect(dark.violations).toEqual([]);
    await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  }
});
