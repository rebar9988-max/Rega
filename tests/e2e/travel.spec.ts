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

test("travel: home artwork keeps its framing and aligns the single CTA", async ({ page }) => {
  for (const [locale, width] of [["ckb", 375], ["en", 1440]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/${locale}`);
    const banner = page.getByTestId("home-travel-banner");
    const image = banner.getByRole("img");
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("naturalWidth", 1536);
    await expect(image).toHaveJSProperty("naturalHeight", 864);
    const imageBox = (await image.boundingBox())!;
    expect(imageBox.width / imageBox.height).toBeCloseTo(16 / 9, 2);
    await expect(banner.getByRole("link")).toHaveCount(1);
    const cta = banner.getByRole("link");
    const box = (await cta.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect((box.x - imageBox.x) / imageBox.width).toBeCloseTo(0.052, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/travel$`));
  }
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

test("travel: transport filter, nearby map and travel registration entry points", async ({ page }) => {
  await page.goto("/en/travel");
  await expect(page.getByTestId("travel-nearby")).toHaveAttribute("href", "/en/nearby?category=travel");
  await expect(page.getByTestId("travel-register")).toHaveAttribute("href", "/dr/businesses/new?travel=1");
  await page.getByTestId("travel-transport").selectOption("van");
  await expect(page).toHaveURL(/\/en\/travel\?.*transport=van/);
  await expect(page.getByTestId("travel-transport")).toHaveValue("van");
  // The nearby map accepts the Rega24Travel scope as one category choice.
  const res = await page.request.get("/api/v1/nearby?lat=50.94&lng=6.96&category=travel");
  expect(res.status()).toBe(200);
});

/** Premium banner and photo service cards (owner reference 2026-11-19): real photos load, layout fits, cards filter. */
for (const [width, path] of [[375, "/ckb/travel"], [1440, "/ckb/travel"], [375, "/en/travel"]] as const) {
  test(`travel: banner photo, start button and photo cards (${width}px ${path})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    const hero = page.locator(".rt-banner-photo img");
    await expect(hero).toBeVisible();
    expect(await hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(hero).toHaveAttribute("alt", "");
    const start = page.getByTestId("travel-start");
    await expect(start).toHaveAttribute("href", "#t-q");
    const box = await start.boundingBox();
    expect(box && box.height >= 44).toBeTruthy();

    const cards = page.locator('[data-testid^="travel-card-"]');
    await expect(cards).toHaveCount(4);
    for (const img of await page.locator(".rt-cat-photo img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

    await page.getByTestId("travel-card-taxi-transfer").click();
    await expect(page).toHaveURL(/\/travel\?category=/);
    await expect(page.getByTestId("travel-category")).not.toHaveValue("");
    await expect(page.getByTestId("travel-card-taxi-transfer")).toHaveAttribute("aria-current", "true");
  });
}
