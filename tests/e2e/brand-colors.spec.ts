import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

// Exercise actual Tailwind output, scoped light surfaces and dark-mode inheritance.
for (const locale of ["en", "ckb"]) {
  for (const theme of ["light", "dark"]) {
    for (const width of [390, 1366]) {
      test(`brand contrast: ${locale}/${theme}/${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/register`);
        await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
        await page.evaluate(() => document.fonts.ready);
        const values = await page.evaluate(() => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d")!;
          const rgb = (color: string) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
          };
          const luminance = (color: number[]) => color.map((c) => {
            const v = c / 255;
            return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
          }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
          const contrast = (a: number[], b: number[]) => {
            const x = luminance(a), y = luminance(b);
            return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
          };
          const lightScope = document.createElement("div");
          lightScope.className = "figma";
          document.body.append(lightScope);
          const values = [document.body, lightScope].map((scope) => {
            const probe = document.createElement("span");
            scope.append(probe);
            const color = (token: string) => {
              probe.style.color = `var(--${token})`;
              return rgb(getComputedStyle(probe).color);
            };
            const primary = color("brand");
            const ratios = {
              action: contrast(primary, color("brand-ink")),
              hover: contrast(color("brand-hover"), color("brand-ink")),
              link: contrast(color("brand-text"), color("surface")),
              soft: contrast(color("brand-text"), color("brand-soft")),
              focus: contrast(color("ring"), color("surface")),
              control: contrast(color("brand-control"), color("surface")),
              thumb: contrast(color("brand-control"), [255, 255, 255]),
            };
            probe.remove();
            return { primary, ratios };
          });
          lightScope.remove();
          return values;
        });
        for (const scope of values) {
          expect(scope.primary).toEqual([250, 7, 13]);
          for (const [state, ratio] of Object.entries(scope.ratios)) {
            expect(ratio, state).toBeGreaterThanOrEqual(["focus", "control", "thumb"].includes(state) ? 3 : 4.5);
          }
        }
        expect(await page.locator("html").getAttribute("dir")).toBe(locale === "ckb" ? "rtl" : "ltr");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const result = await new AxeBuilder({ page }).withTags(["wcag2aa", "wcag21aa"]).analyze();
        const brandContrast = result.violations.filter((v) => v.id === "color-contrast")
          .flatMap((v) => v.nodes.filter((n) => n.html.includes("brand")).map((n) => n.target));
        expect(brandContrast).toEqual([]);
        const manifest = await (await page.request.get("/manifest.webmanifest")).json();
        expect(manifest.theme_color).toBe("#fa070d");
        await page.screenshot({ path: info.outputPath(`brand-${locale}-${theme}-${width}.png`), fullPage: true });
        await info.attach("contrast-ratios", { body: JSON.stringify(values, null, 2), contentType: "application/json" });
      });
    }
  }
}
