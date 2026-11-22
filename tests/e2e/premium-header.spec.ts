import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

for (const locale of ["en", "ckb", "de", "ar"]) {
  test(`premium header: controls, geometry and accessibility ${locale}`, async ({ page }, info) => {
    await page.goto(`/${locale}`);
    const header = page.locator("header");
    await expect(header).not.toContainText("ڕێگا");
    for (const [width, height] of [[320, 900], [390, 900], [768, 900], [1024, 900], [1440, 900], [1920, 900], [390, 600], [844, 390]]) {
      await page.setViewportSize({ width, height });
      const controls = header.locator(".rega-header-controls");
      const box = await controls.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      await header.locator(".rega-header-pill summary").click();
      const languageMenu = header.locator(".rega-header-pill details > ul");
      await expect(languageMenu).toBeVisible();
      const menu = await languageMenu.boundingBox();
      expect(menu!.x).toBeGreaterThanOrEqual(0);
      expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
      expect(menu!.y + menu!.height).toBeLessThanOrEqual(height);
      await page.keyboard.press("Escape");
      await header.locator(".rega-header-menu").click();
      await expect(header.locator("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(header.locator(".rega-header-menu")).toBeFocused();
      if (height === 900 && [390, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`${locale}-${width}.png`), fullPage: true });
    }
    // On a phone the language switch is reachable in the menu sheet and lists every language.
    await page.setViewportSize({ width: 390, height: 900 });
    await header.locator(".rega-header-menu").click();
    const sheet = header.locator("dialog");
    await expect(sheet).toBeVisible();
    const langs = sheet.locator("[data-testid='language-list'] a");
    await expect(langs).toHaveCount(11);
    await expect(langs.first()).toBeVisible();
    await sheet.getByRole("button").first().click();
    await expect(sheet).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });

    const result = await new AxeBuilder({ page }).include("header").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await header.locator(".rega-reference-updates").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}#home-latest$`));
    await page.locator(".rega-reference-cta").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}#home-search$`));
    const form = page.locator("#home-search");
    await form.getByRole("searchbox").fill("Zagros");
    await form.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/businesses\\?.*q=Zagros`));
    await page.goto(`/${locale}`);
    await header.locator(".rega-reference-account").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
    await expect(header.locator(".rega-header-pill")).toHaveCount(0);
    await expect(header.locator(".rega-header-brand")).toHaveCount(0);
    await expect(header.locator(".rega-header-menu")).toBeVisible();
  });
}

test("inner pages keep only the compact menu at phone and desktop widths", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/ckb/nearby", "/ckb/ai", "/de/businesses"]) {
      await page.goto(route);
      const header = page.locator("header.rega-header");
      await expect(header.locator(".rega-header-pill, .rega-header-brand, .rega-header-secondary")).toHaveCount(0);
      await expect(header.locator(".rega-header-menu")).toBeVisible();
    }
  }
});
