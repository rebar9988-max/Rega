/** Admin tools that let the platform grow without code: geography, CMS pages, reports and the contact inbox. */
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

test.describe.configure({ mode: "serial" });

test("admin adds a city; it is selectable with a (0) count and gets a slug", async ({ page }) => {
  await login(page);
  await page.goto("/dr/geography");
  const form = page.getByTestId("city-form");
  await form.locator('select[name="countryId"]').selectOption({ label: "Germany" });
  await form.locator('input[name="nameEn"]').fill(`Teststadt ${stamp}`);
  await form.locator('input[name="lat"]').fill("50.1");
  await form.locator('input[name="lng"]').fill("8.7");
  await form.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByRole("status")).toContainText("Gespeichert");
  await expect(page.locator('input[name="slug"]')).toHaveValue(`teststadt-${stamp}`);
  await page.goto("/de/businesses");
  await expect(page.locator('select[name="city"] option', { hasText: `Teststadt ${stamp} (0)` })).toHaveCount(1);
});

test("CMS page: written per language, published, rendered with language fallback; drafts are not public", async ({ page }) => {
  await login(page);
  const slug = `e2e-seite-${stamp}`;
  await page.goto("/dr/pages/new");
  const form = page.getByTestId("page-form");
  await form.locator('input[name="slug"]').fill(slug);
  await form.locator('select[name="status"]').selectOption("draft");
  await form.locator('input[name="titleDe"]').fill("E2E Seite");
  await form.locator('textarea[name="bodyDe"]').fill("## Überschrift\n\nErster Absatz.\n\n- Punkt A\n- Punkt B");
  await form.locator('input[name="titleEn"]').fill("E2E page");
  await form.locator('textarea[name="bodyEn"]').fill("English paragraph.");
  await form.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toContainText("Gespeichert");
  // Draft: not public.
  expect((await page.request.get(`/de/p/${slug}`)).status()).toBe(404);
  // Publish.
  await page.locator('select[name="status"]').selectOption("published");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toContainText("Gespeichert");
  await page.goto(`/de/p/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Seite");
  await expect(page.getByRole("heading", { level: 2, name: "Überschrift" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Punkt B" })).toBeVisible();
  // Turkish has no text: falls back to English (the chain of the locale config), with the page's own lang/dir.
  await page.goto(`/tr/p/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E page");
  // In the sitemap.
  const sitemap = await (await page.request.get("/sitemaps/pages.xml")).text();
  expect(sitemap).toContain(`/de/p/${slug}`);
});

// The contact page no longer has a message form (96a00d3: phone, email and WhatsApp only), so no new contact messages
// arrive from the site; the content-report flow below is unchanged.
test("content reports reach the dashboard and can be handled", async ({ page }) => {
  // A visitor reports content.
  await page.goto("/de/report");
  const report = page.getByTestId("report-form");
  await report.getByLabel("Adresse des Inhalts (URL)").fill(`https://www.regaplatform.com/de/businesses/e2e-${stamp}`);
  await report.getByLabel("Begründung: Warum ist dieser Inhalt problematisch?").fill(`E2E Meldung ${stamp}: irreführende Angaben`);
  await report.getByLabel("Ihr Name").fill("E2E Melder");
  await report.getByLabel("Ihre E-Mail-Adresse").fill("melder@example.org");
  await report.getByLabel("Ich bestätige in gutem Glauben", { exact: false }).check();
  await report.getByRole("button", { name: "Meldung senden" }).click();
  await expect(page.getByTestId("report-sent")).toBeVisible();

  await login(page);
  await page.goto("/dr/reports");
  const row = page.getByTestId("report-row").filter({ hasText: `E2E Meldung ${stamp}` });
  await expect(row).toContainText("Offen");
  await row.getByPlaceholder("Notiz").fill("Geprüft, Angaben korrigiert");
  await row.locator("select").selectOption({ label: "Maßnahme: erledigt" });
  await row.getByRole("button", { name: "Anwenden" }).click();
  await expect(page.getByTestId("report-row").filter({ hasText: `E2E Meldung ${stamp}` })).toContainText("Maßnahme ergriffen");
});

test("moderation inboxes are closed to employees and owners", async ({ page }) => {
  await page.goto("/de/login");
  await page.getByLabel("E-Mail", { exact: true }).fill("employee@example.org");
  await page.getByLabel("Passwort", { exact: true }).fill("employee-pass-123");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  for (const path of ["/dr/reports", "/dr/messages", "/dr/pages", "/dr/geography"]) {
    await page.goto(path);
    await expect(page.getByTestId("report-row")).toHaveCount(0);
    await expect(page.locator("form[action]").filter({ hasText: "Speichern" })).toHaveCount(0);
  }
});
