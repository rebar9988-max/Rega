import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

for (const locale of ["en", "ckb", "de", "ar"]) {
  test(`premium header: controls, geometry and accessibility ${locale}`, async ({ page }, info) => {
    await page.goto(`/${locale}`);
    const header = page.locator("header");
    await expect(header).not.toContainText("ڕێگا");
    for (const [width, height] of [[320, 900], [390, 900], [768, 900], [1024, 900], [1440, 900], [1920, 900], [390, 600], [844, 390]]) {
      await page.setViewportSize({ width, height });
      // Owner instruction 2026-11-21: below 768 px the header is the menu key alone — the search pill and the
      // language switcher are hidden there and the switch lives in the sheet instead (asserted after this loop).
      const pillShown = width >= 768;
      if (pillShown) await expect(header.getByRole("searchbox")).toBeVisible();
      else await expect(header.getByRole("searchbox")).toBeHidden();
      const controls = header.locator(".rega-header-controls");
      const box = await controls.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      if (pillShown) {
        await header.locator(".rega-header-pill summary").click();
        await expect(header.locator(".rega-header-pill details > ul")).toBeVisible();
        const menu = await header.locator(".rega-header-pill details > ul").boundingBox();
        expect(menu!.y + menu!.height).toBeLessThanOrEqual(height);
        await page.keyboard.press("Escape");
      }
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
    await sheet.locator("summary").click();
    await expect(sheet.locator("details > ul")).toBeVisible();
    await expect(sheet.locator("details > ul li")).toHaveCount(11);
    await sheet.getByRole("button").first().click();
    await expect(sheet).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });

    const result = await new AxeBuilder({ page }).include("header").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await header.getByRole("searchbox").fill("Zagros");
    await header.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/search\\?q=Zagros`));
    await expect(page.getByRole("main").getByRole("searchbox")).toHaveValue("Zagros");
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
