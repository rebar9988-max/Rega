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
      // Owner instruction 2026-11-21: phones carry the menu key alone — the banner below shows the mark instead.
      // The brand returns at 768 px and up, where there is no bottom bar to get home from.
      const brand = page.locator("header").getByRole("link", { name: "ڕێگا REGA24", exact: true });
      if (width >= 768) {
        await expect(brand).toBeVisible();
        const box = await brand.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
        const loaded = await brand.locator("img").evaluateAll((els) => els.every(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0));
        expect(loaded).toBe(true);
      } else {
        await expect(brand).toBeHidden();
        const menu = await page.locator("header .rega-header-menu").boundingBox();
        expect(menu && menu.x >= 0 && menu.x + menu.width <= width).toBeTruthy();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const hero = page.locator(".rega-editorial-hero");
      await expect(hero.getByRole("searchbox")).toBeVisible();
      const button = await hero.getByRole("button", { name: /.+/ }).last().boundingBox();
      expect(button?.height).toBeGreaterThanOrEqual(44);
      const screenshot = info.outputPath(`${locale}-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await info.attach(`${locale}-${width}`, { path: screenshot, contentType: "image/png" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const profileLink = page.locator(".rega-home-business h3 a").first();
    await profileLink.focus();
    const focus = await profileLink.evaluate(el => {
      const style = getComputedStyle(el.closest("article")!);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(focus.style).toBe("solid");
    expect(focus.width).toBeGreaterThanOrEqual(2);
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

test("reference v2: category shortcuts, business tabs and the Rega24Travel banner", async ({ page, request }) => {
  await page.goto("/en");
  const hero = page.locator(".rega-editorial-hero");
  // Every visible shortcut must lead to a page available in this deployment.
  const cards = hero.locator("[data-testid^='banner-card-']");
  const jobs = await request.get("/en/jobs");
  const services = await request.get("/en/services");
  expect([200, 404]).toContain(jobs.status());
  expect([200, 404]).toContain(services.status());
  await expect(hero.getByTestId("banner-card-jobs")).toHaveCount(Number(jobs.ok()));
  await expect(hero.getByTestId("banner-card-services")).toHaveCount(Number(services.ok()));
  await expect(cards).toHaveCount(4 + Number(jobs.ok()) + Number(services.ok()));
  for (const href of await cards.evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
    expect(href).toMatch(/^\/en\/(businesses|services|jobs)(\/[a-z0-9-]+)?$/);
  }
  await hero.locator("[data-testid='banner-card-food']").click();
  await expect(page).toHaveURL(/\/en\/businesses(\/[a-z0-9-]+)?$/);

  await page.goto("/en");
  const tabs = page.getByRole("tablist");
  await expect(tabs).toBeVisible();
  const first = tabs.getByRole("tab").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await first.focus();
  await page.keyboard.press("ArrowRight");
  const second = tabs.getByRole("tab").nth(1);
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(second).toBeFocused();
  await expect(page.locator(`#${await second.getAttribute("aria-controls")}`)).toBeVisible();
  // Every rating shown on a card is a real review count; no card shows a rating without reviews.
  for (const label of await page.locator(".rh-rating").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))) {
    expect(label).toMatch(/\d/);
  }

  // Owner 2026-11-18: the red banner now opens Rega24Travel; the map stays on the «نزیک» (Nearby) tab.
  await expect(page.getByRole("link", { name: "Open Map" })).toHaveCount(0);
  await expect(page.getByTestId("home-travel-cta")).toHaveAttribute("href", "/en/travel");
  // The homepage itself does not embed an interactive map.
  await expect(page.locator(".rega-home .maplibregl-map")).toHaveCount(0);
});
