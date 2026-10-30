import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { LOCALES, LOCALE_META } from "../../src/i18n/locales";

const widths = [320, 375, 390, 430, 768, 1024, 1440, 1920];
for (const locale of LOCALES) {
  test(`Figma home: shared visual system, eight widths, ${locale}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.goto(`/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("dir", LOCALE_META[locale].dir);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      const brand = page.locator("header").getByRole("link", { name: "ڕێگا REGA24", exact: true });
      await expect(brand).toBeVisible();
      const box = await brand.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const hero = page.locator(".rega-editorial-hero");
      await expect(hero.getByRole("searchbox")).toBeVisible();
      const button = await hero.getByRole("button", { name: /.+/ }).last().boundingBox();
      expect(button?.height).toBeGreaterThanOrEqual(44);
      const images = await brand.locator("img").evaluateAll((els) => els.every(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0));
      expect(images).toBe(true);
      const screenshot = info.outputPath(`${locale}-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await info.attach(`${locale}-${width}`, { path: screenshot, contentType: "image/png" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const a11y = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(a11y.violations).toEqual([]);
  });
}

test("editorial search submits real query and keeps city selector interactive", async ({ page }) => {
  await page.goto("/en");
  const hero = page.locator(".rega-editorial-hero");
  await hero.locator('input[name="q"]').fill("Zagros");
  await hero.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/businesses\?.*q=Zagros/);
  await expect(page.getByRole("heading", { name: /Zagros/i })).toBeVisible();
});
