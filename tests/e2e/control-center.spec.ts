import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

async function login(page: Page, who = ADMIN) {
  await page.goto("/de/login?next=%2Fadmin");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("legacy bookmarks preserve query and canonical admin sign-in never renders private modules", async ({ request, page }) => {
  const legacy = await request.get("/dr/businesses?status=pending", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toBe("/admin/businesses?status=pending");
  await page.goto("/admin");
  await expect(page.locator("[data-dr-sign-in]")).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
  expect((await page.request.get("/admin")).headers()["x-robots-tag"]).toContain("noindex");
});

test("Super Admin manages reviewed settings with an audit entry and all modules share the office", async ({ page }) => {
  await login(page);
  await page.goto("/admin/system");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("REGA24 Kontrollzentrum");
  await expect(page.getByRole("link", { name: "Cloudflare", exact: true })).toBeVisible();
  for (const href of ["/admin/businesses", "/admin/users", "/admin/geography", "/admin/categories", "/admin/ai", "/admin/media", "/admin/system", "/admin/audit"]) {
    await expect(page.locator(`aside a[href="${href}"]`)).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Öffentliche Bewertungen deaktivieren", exact: true }).click();
  await expect(page.getByRole("button", { name: "Öffentliche Bewertungen aktivieren", exact: true })).toBeVisible();
  await expect(page.locator("time")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Öffentliche Bewertungen aktivieren", exact: true }).click();
  await expect(page.getByRole("button", { name: "Öffentliche Bewertungen deaktivieren", exact: true })).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.getByText("system.featureflag.update", { exact: true }).first()).toBeVisible();
  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Medien");
});

test("employee direct URL cannot access Super Admin settings or its controls", async ({ page }) => {
  await login(page, EMPLOYEE);
  await expect(page.locator('aside a[href="/admin/system"]')).toHaveCount(0);
  await page.goto("/admin/system");
  await expect(page.getByRole("button", { name: /Öffentliche Bewertungen/ })).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
});

for (const locale of ["en", "ckb"]) for (const width of [360, 1366]) {
  test(`office ${locale} ${width}px: accessible configuration and media pages`, async ({ page, context }, testInfo) => {
    await login(page);
    await context.addCookies([{ name: "REGA_LOCALE", value: locale, domain: "localhost", path: "/" }]);
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/admin/system", "/admin/media"]) {
      await page.goto(path);
      expect(await page.locator("html").getAttribute("dir")).toBe(locale === "ckb" ? "rtl" : "ltr");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${locale}-${width}-${path.split("/").at(-1)}.png`), fullPage: true });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    }
  });
}
