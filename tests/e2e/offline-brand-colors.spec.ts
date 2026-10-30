import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["en", "ckb"]) for (const theme of ["light", "dark"]) for (const width of [390, 1366]) {
  test(`offline brand: ${locale}/${theme}/${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    const html = await (await page.request.get("/offline.html")).text();
    // The service worker returns this standalone file at the failed locale URL, without React or another CSS request.
    await page.route(`**/${locale}/offline-color-probe`, (route) => route.fulfill({ contentType: "text/html", body: html }));
    await page.addInitScript((value) => localStorage.setItem("rega-theme", value), theme);
    await page.goto(`/${locale}/offline-color-probe`);
    expect(await page.locator("html").getAttribute("dir")).toBe(locale === "ckb" ? "rtl" : "ltr");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim())).toBe(manifest.theme_color);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const ratios: Record<string, number> = {};
    for (const state of ["normal", "hover", "focus"]) {
      if (state === "hover") await page.locator("button").hover();
      if (state === "focus") { await page.mouse.move(0, 0); await page.locator("button").focus(); }
      ratios[state] = await page.locator("button").evaluate((el) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        const lum = (color: string) => {
          ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((c) => {
            const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
          }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        };
        const style = getComputedStyle(el), a = lum(style.color), b = lum(style.backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      expect(ratios[state], state).toBeGreaterThanOrEqual(4.5);
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`offline-${locale}-${theme}-${width}.png`), fullPage: true });
    await info.attach("offline-contrast", { body: JSON.stringify(ratios), contentType: "application/json" });
  });
}
