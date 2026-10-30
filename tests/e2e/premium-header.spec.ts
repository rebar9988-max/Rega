import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

for (const locale of ["en", "ckb", "de", "ar"]) {
  test(`premium header: controls, geometry and accessibility ${locale}`, async ({ page }, info) => {
    await page.goto(`/${locale}`);
    const header = page.locator("header");
    await expect(header).not.toContainText("ڕێگا");
    for (const [width, height] of [[320, 900], [390, 900], [768, 900], [1024, 900], [1440, 900], [1920, 900], [390, 600], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await expect(header.getByRole("searchbox")).toBeVisible();
      const controls = header.locator(".rega-header-controls");
      const box = await controls.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      await header.locator("summary").click();
      await expect(header.locator("details > ul")).toBeVisible();
      const menu = await header.locator("details > ul").boundingBox();
      expect(menu!.y + menu!.height).toBeLessThanOrEqual(height);
      await page.keyboard.press("Escape");
      await header.locator(".rega-header-menu").click();
      await expect(header.locator("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(header.locator(".rega-header-menu")).toBeFocused();
      if (height === 900 && [390, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`${locale}-${width}.png`), fullPage: true });
    }
    const result = await new AxeBuilder({ page }).include("header").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await header.getByRole("searchbox").fill("Zagros");
    await header.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/search\\?q=Zagros`));
    await expect(page.getByRole("main").getByRole("searchbox")).toHaveValue("Zagros");
  });
}
