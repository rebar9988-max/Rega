/** CSV import was removed from REGA on purpose: no page, no nav link, no template, for any role. */
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

test("CSV import is gone: /dr/import is 404, no dashboard link, no template", async ({ page }) => {
  await page.goto("/de/login?next=%2Fadmin");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('a[href="/admin/import"]')).toHaveCount(0);

  const res = await page.goto("/admin/import");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("import-form")).toHaveCount(0);

  const sample = await page.request.get("/import-sample.csv");
  expect(sample.status()).toBe(404);
});
