/** Geography workspace (/dr/geography): country → region → city tabs, search, paging, status changes, layout. */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);

async function login(page: Page) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
}

const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe.configure({ mode: "serial" });

test("cities are paged, filtered by the country → region hierarchy and searchable", async ({ page }) => {
  await login(page);
  await page.goto("/dr/geography");
  await expect(page.getByTestId("geo-tab-cities")).toHaveAttribute("aria-current", "page");
  const rows = page.getByTestId("city-row");
  expect(await rows.count()).toBeLessThanOrEqual(25);

  // Regions stay disabled until a country is chosen, then list only that country's regions.
  const region = page.locator("#geo-region");
  await expect(region).toBeDisabled();
  await page.locator("#geo-country").selectOption({ label: "Deutschland" });
  await expect(page).toHaveURL(/country=/);
  await expect(region).toBeEnabled();
  await region.selectOption({ label: "Bayern" });
  await expect(page).toHaveURL(/region=/);
  await expect(rows.first()).toContainText("Bayern");

  // Search applies on its own after typing (debounced) and keeps the hierarchy filters.
  await page.locator("#geo-q").fill("münchen");
  await expect(page).toHaveURL(/q=m%C3%BCnchen/);
  await expect(rows.filter({ hasText: "München" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Filter zurücksetzen" }).first().click();
  await expect(page).toHaveURL(/\/dr\/geography$/);
  await expect(page.locator("#geo-q")).toHaveValue("");
  const pagination = page.getByTestId("geo-pagination");
  await expect(pagination).toBeVisible();
  await pagination.getByRole("link", { name: "2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows).toHaveCount(25);
});

test("a city is deactivated and reactivated only after confirmation", async ({ page }) => {
  await login(page);
  await page.goto("/dr/geography");
  const form = page.getByTestId("city-form");
  await form.locator('select[name="countryId"]').selectOption({ label: "Germany" });
  await form.locator('input[name="nameEn"]').fill(`Geotest ${stamp}`);
  await form.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.locator('input[name="slug"]')).toHaveValue(`geotest-${stamp}`);

  await page.goto(`/dr/geography?q=geotest-${stamp}`);
  const row = page.getByTestId("city-row").filter({ hasText: `Geotest ${stamp}` });
  await expect(row.getByTestId("row-status")).toHaveAttribute("data-status", "published");

  await row.getByTestId(`menu-city-geotest-${stamp}`).click();
  await row.getByTestId("toggle-city").click();
  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("confirm-cancel").click();
  await expect(row.getByTestId("row-status")).toHaveAttribute("data-status", "published");

  await row.getByTestId(`menu-city-geotest-${stamp}`).click();
  await row.getByTestId("toggle-city").click();
  await page.getByTestId("confirm-dialog").getByTestId("confirm-submit").click();
  await expect(page.getByTestId("geo-notice")).toContainText("Deaktiviert");
  await expect(page).toHaveURL(new RegExp(`q=geotest-${stamp}`));
  await expect(row.getByTestId("row-status")).toHaveAttribute("data-status", "draft");

  await row.getByTestId(`menu-city-geotest-${stamp}`).click();
  await row.getByTestId("toggle-city").click();
  await page.getByTestId("confirm-dialog").getByTestId("confirm-submit").click();
  await expect(page.getByTestId("geo-notice")).toContainText("Aktiviert");
  await expect(row.getByTestId("row-status")).toHaveAttribute("data-status", "published");
});

test("country and region tabs; no horizontal overflow from 320 px to desktop, LTR and RTL", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await page.goto("/dr/geography?tab=countries");
  await expect(page.getByTestId("country-DE")).toBeVisible();
  await page.getByTestId("menu-country-DE").click();
  await page.getByRole("link", { name: "Regionen anzeigen" }).click();
  await expect(page.getByTestId("geo-tab-regions")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("region-row").first()).toBeVisible();

  for (const locale of ["de", "ckb"]) {
    await page.context().addCookies([{ name: "REGA_LOCALE", value: locale, domain: new URL(page.url()).hostname, path: "/" }]);
    for (const width of [320, 375, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of ["", "?tab=regions", "?tab=countries"]) {
        await page.goto(`/dr/geography${tab}`);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ckb" ? "rtl" : "ltr");
        expect(await noHorizontalOverflow(page), `${locale} ${width}px ${tab || "cities"}`).toBe(true);
      }
    }
  }
});
