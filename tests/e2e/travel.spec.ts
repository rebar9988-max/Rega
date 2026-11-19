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

test("travel: home banner opens Rega24Travel; the map CTA is gone", async ({ page }) => {
  await page.goto("/ckb");
  await expect(page.locator('main a[href$="/nearby"].rh-mapbanner-cta')).toHaveCount(0);
  const cta = page.getByTestId("home-travel-cta");
  await expect(cta).toContainText("Rega24Travel");
  const box = await cta.boundingBox();
  expect(box && box.height >= 44).toBeTruthy();
  await cta.click();
  await expect(page).toHaveURL(/\/ckb\/travel$/);
});

test("travel: banner service shortcuts open the travel page filtered to that category", async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ckb");
    const banner = page.getByTestId("home-travel-banner");
    await expect(banner.getByRole("link")).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    for (const link of await banner.locator(".rtb-service").all()) {
      const box = await link.boundingBox();
      expect(box && box.width >= 44 && box.height >= 44).toBeTruthy();
    }
  }
  await page.getByTestId("travel-shortcut-taxi-transfer").click();
  await expect(page).toHaveURL(/\/ckb\/travel\?category=/);
  await expect(page.getByTestId("travel-category")).not.toHaveValue("");
});

test("travel: the category pill filters inside travel only", async ({ page }) => {
  await page.goto("/en/travel");
  const select = page.getByTestId("travel-category");
  await expect(select).toHaveValue("");
  const value = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(value!);
  await expect(page).toHaveURL(new RegExp(`/en/travel\\?.*category=${value}`));
  // A category id from outside travel is ignored: the page stays scoped.
  await page.goto("/en/travel?category=not-a-travel-category");
  await expect(page.getByTestId("travel-category")).toHaveValue("");
});

test("travel: one field for name or PLZ, and the empty state", async ({ page }) => {
  await page.goto("/en/travel");
  // Seeded demo businesses are food/health/legal: none may leak into the travel results.
  await expect(page.getByText("Kurdistan Rechtsberatung")).toHaveCount(0);
  await page.locator("#t-q").fill("99999");
  await page.locator('#travel-filters button[type="submit"]').click();
  await expect(page).toHaveURL(/q=99999/);
  await expect(page.getByText("No results for this search. Change or clear the filters.")).toBeVisible();
  await page.getByTestId("travel-clear").click();
  await expect(page).toHaveURL(/\/en\/travel$/);
  await page.locator("#t-q").fill("zzzz-no-such-business");
  await page.locator('#travel-filters button[type="submit"]').click();
  await expect(page.getByText("No results for this search. Change or clear the filters.")).toBeVisible();
});

test("travel: axe (wcag2 A/AA) on the travel page", async ({ page }) => {
  for (const path of ["/ckb/travel", "/de/travel"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`), path).toEqual([]);
  }
});
