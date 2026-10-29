/**
 * Search analytics: a visitor's search is counted per day and language (with "found nothing"), personal-looking texts
 * are not stored, bots are not counted, and the dashboard shows the counts to staff with analytics access only.
 */
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const word = `zqx${Date.now().toString(36)}`;

test("searches are counted without personal data and shown in the dashboard", async ({ page, request }) => {
  await page.goto(`/de/search?q=${word}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto(`/de/search?q=${word.toUpperCase()}%20`); // same text after normalization
  await page.goto("/de/search?q=max%40example.org"); // e-mail: never stored
  // A bot's search is not counted.
  await request.get(`/de/search?q=${word}`, { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } });

  await page.goto("/de/login?next=%2Fdr%2Fsearch-analytics");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr\/search-analytics/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Suchanalyse");
  const missing = page.getByTestId("search-missing");
  await expect(missing.getByRole("row").filter({ hasText: word })).toContainText("2");
  await expect(page.getByTestId("search-top")).not.toContainText("example.org");
});

test("the dashboard is not public", async ({ page }) => {
  await page.goto("/dr/search-analytics");
  await expect(page).not.toHaveURL(/\/dr\/search-analytics$/);
});
