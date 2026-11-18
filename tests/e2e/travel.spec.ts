import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/** Rega24Travel: home tile -> /travel discovery page over the one business directory. */
for (const width of [375, 1440]) {
  test(`travel: home tile opens the travel page (${width}px, Sorani RTL)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ckb");
    const tile = page.getByTestId("home-travel-tile");
    await expect(tile).toBeVisible();
    await expect(tile).toContainText("گەشت و گواستنەوە");
    await expect(page.locator('main a[href$="/businesses/travel-tickets"].rh-tile, main a[href$="/businesses/transport-moving"].rh-tile')).toHaveCount(0);
    const box = await tile.boundingBox();
    expect(box && box.height >= 44 && box.width >= 44).toBeTruthy();
    await tile.click();
    await expect(page).toHaveURL(/\/ckb\/travel$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Rega24\s*Travel/);
    await expect(page.getByText("دۆزینەوەی بازرگانی و خزمەتگوزارییەکانی گەشت و گواستنەوە لە نزیکترین شوێنەکان.")).toBeVisible();
    await expect(page.locator("#t-q")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}

test("travel: category chips come from the real travel categories and filter inside travel only", async ({ page }) => {
  await page.goto("/en/travel");
  const chips = page.getByRole("navigation", { name: "Travel & Transport categories" });
  await expect(chips.getByTestId("travel-chip-all")).toHaveAttribute("aria-current", "true");
  const first = chips.getByRole("link").nth(1);
  await first.click();
  await expect(page).toHaveURL(/\/en\/travel\?category=/);
  await expect(chips.locator('[aria-current="true"]')).toHaveCount(1);
  // A category id from outside travel is ignored: the page stays scoped and never shows another section's listings.
  await page.goto("/en/travel?category=not-a-travel-category");
  await expect(chips.getByTestId("travel-chip-all")).toHaveAttribute("aria-current", "true");
});

test("travel: search, postal code and empty state", async ({ page }) => {
  await page.goto("/en/travel");
  // Seeded demo businesses are food/health/legal: none may leak into the travel results.
  await expect(page.getByText("Kurdistan Rechtsberatung")).toHaveCount(0);
  await page.locator("#t-q").fill("zzzz-no-such-business");
  await page.locator("#t-plz").fill("99999");
  await page.locator('#travel-filters button[type="submit"]').click();
  await expect(page).toHaveURL(/q=zzzz-no-such-business/);
  await expect(page).toHaveURL(/plz=99999/);
  await expect(page.getByText("No results for this search. Change or clear the filters.")).toBeVisible();
  await page.getByTestId("travel-clear").click();
  await expect(page).toHaveURL(/\/en\/travel$/);
});

test("travel: axe (wcag2 A/AA) on the travel page", async ({ page }) => {
  for (const path of ["/ckb/travel", "/de/travel"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`), path).toEqual([]);
  }
});
