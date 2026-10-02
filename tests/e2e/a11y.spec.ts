/**
 * Accessibility pass with axe-core on the main public pages (light theme, desktop). Fails on serious/critical issues that
 * are not colour contrast; contrast findings are listed in the test output for the designers (the colour palette is fixed).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const PAGES = ["/de", "/ckb", "/de/businesses", "/de/business/zagros-restaurant", "/de/contact", "/de/register", "/de/login", "/de/for-business", "/de/impressum", "/de/privacy", "/de/report", "/ar/about", "/de/ai"];

for (const path of PAGES) {
  test(`axe: ${path}`, async ({ page }, info) => {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((v) => (v.impact === "serious" || v.impact === "critical"));
    const contrast = serious.filter((v) => v.id === "color-contrast");
    const other = serious.filter((v) => v.id !== "color-contrast");
    if (contrast.length) info.annotations.push({ type: "contrast", description: contrast.flatMap((v) => v.nodes.map((n) => n.target.join(" "))).slice(0, 8).join(" | ") });
    expect(other.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`), path).toEqual([]);
  });
}
