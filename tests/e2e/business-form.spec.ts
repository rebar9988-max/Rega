/**
 * Business form upgrade: optional e-mail / website, the four optional social profiles (validated, shown only when
 * saved), structured opening hours (split, overnight, closed days, copy) and the mobile / RTL layout of the owner steps.
 * Runs on desktop and on a phone (Pixel 5); every record is created by this file.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);

async function login(page: Page) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function basics(page: Page, name: string, city: { street: string; city: string; lat: string; lng: string }) {
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  await page.getByLabel("Straße und Hausnummer").fill(city.street);
  await page.locator('select[name="countryCode"]').selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill(city.city);
  await page.getByTestId("lat").fill(city.lat);
  await page.getByTestId("lng").fill(city.lng);
  await page.getByTestId("confirm-location").check();
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("without e-mail, website or social profiles a business is saved and its profile shows no empty contact entries", async ({ page }, info) => {
  await login(page);
  const name = `E2E Ohne Kontakt ${info.project.name} ${stamp}`;
  await basics(page, name, { street: "Am Markt 3", city: "Bremen", lat: "53.0759", lng: "8.8073" });
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/business/${slug}`);
  await expect(page.getByTestId("business-profile")).toBeVisible();
  await expect(page.getByTestId("business-social")).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Website besuchen" })).toHaveCount(0);
});

test("social profiles: each optional, unsafe links refused, saved links shown on the profile and removable", async ({ page }, info) => {
  await login(page);
  const name = `E2E Sozial ${info.project.name} ${stamp}`;
  await basics(page, name, { street: "Am Markt 5", city: "Bremen", lat: "53.0761", lng: "8.8075" });
  await page.getByTestId("email").fill("kontakt@example.org");
  await page.getByTestId("website").fill("example.org");
  // A lookalike domain is refused by the server too; what was typed stays in the form.
  await page.getByTestId("social-facebook").fill("https://facebook.com.evil.example/kebab");
  await expect(page.getByTestId("social-error-facebook")).toBeVisible();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page.getByTestId("social-facebook")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
  await page.getByTestId("social-facebook").fill("facebook.com/e2e.kebab");
  await page.getByTestId("social-instagram").fill("@e2e.kebab");
  await page.getByTestId("social-tiktok").fill("https://www.tiktok.com/@e2ekebab?lang=de");
  await page.getByTestId("social-snapchat").fill("https://snapchat.com/add/e2ekebab");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  // Stored in canonical form.
  await expect(page.getByTestId("social-facebook")).toHaveValue("https://www.facebook.com/e2e.kebab");
  await expect(page.getByTestId("social-tiktok")).toHaveValue("https://www.tiktok.com/@e2ekebab");
  await expect(page.getByTestId("website")).toHaveValue("https://example.org/");
  const editUrl = page.url().split("?")[0];

  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/business/${slug}`);
  const social = page.getByTestId("business-social");
  for (const [p, href] of [["facebook", "https://www.facebook.com/e2e.kebab"], ["instagram", "https://www.instagram.com/e2e.kebab"], ["tiktok", "https://www.tiktok.com/@e2ekebab"], ["snapchat", "https://www.snapchat.com/add/e2ekebab"]]) {
    const link = social.getByTestId(`social-${p}`);
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
  await expect(page.locator('a[href="mailto:kontakt@example.org"]')).toHaveCount(1);

  // Removing three of them leaves only Instagram.
  await page.goto(editUrl);
  for (const p of ["facebook", "tiktok", "snapchat"]) await page.getByTestId(`social-clear-${p}`).click();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await page.goto(`/de/business/${slug}`);
  await expect(page.getByTestId("business-social").getByRole("link")).toHaveCount(1);
  await expect(page.getByTestId("business-social").getByTestId("social-instagram")).toBeVisible();
});

test("opening hours: closed day, split and overnight hours are stored in the existing format and kept when reopened", async ({ page }, info) => {
  await login(page);
  const name = `E2E Zeiten ${info.project.name} ${stamp}`;
  await basics(page, name, { street: "Am Markt 7", city: "Bremen", lat: "53.0763", lng: "8.8077" });
  await page.getByTestId("hours-start").click();
  // Monday split, copied to the weekdays; Friday overnight; Sunday stays closed.
  await page.getByTestId("hours-from-mon-0").fill("10:00");
  await page.getByTestId("hours-to-mon-0").fill("14:00");
  await page.getByTestId("hours-add-mon").click();
  await page.getByTestId("hours-from-mon-1").fill("17:00");
  await page.getByTestId("hours-to-mon-1").fill("22:00");
  await page.getByTestId("hours-copy-weekdays").click();
  await expect(page.getByTestId("hours-thu")).toHaveValue("10:00–14:00, 17:00–22:00");
  await page.getByTestId("hours-remove-fri-1").click();
  await page.getByTestId("hours-from-fri-0").fill("20:00");
  await page.getByTestId("hours-to-fri-0").fill("02:00");
  await page.getByTestId("hours-row-sat").getByRole("switch").check();
  await expect(page.getByTestId("hours-sat")).toHaveValue("09:00–17:00");
  await expect(page.getByTestId("hours-sun")).toHaveValue("closed");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("hours-mon")).toHaveValue("10:00–14:00, 17:00–22:00");
  await expect(page.getByTestId("hours-fri")).toHaveValue("20:00–02:00");
  await expect(page.getByTestId("hours-sun")).toHaveValue("closed");
  await expect(page.getByTestId("hours-row-sun").getByRole("switch")).not.toBeChecked();

  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/business/${slug}`);
  await expect(page.getByTestId("opening-hours")).toContainText("17:00–22:00");
  await expect(page.getByTestId("opening-hours")).toContainText("20:00–02:00");
});

test("category details: the same form offers each category its own optional details; only offered ones are saved and shown", async ({ page }, info) => {
  await login(page);
  const name = `E2E Details ${info.project.name} ${stamp}`;
  await basics(page, name, { street: "Am Markt 9", city: "Bremen", lat: "53.0765", lng: "8.8079" });
  // Legal offers consultations, not delivery; every category offers the universal details.
  const box = page.getByTestId("category-features");
  await expect(box.getByTestId("feature-freeConsultation")).toBeVisible();
  await expect(box.getByTestId("feature-wheelchair")).toBeVisible();
  await expect(box.getByTestId("feature-delivery")).toHaveCount(0);
  await box.getByTestId("feature-wheelchair").check();
  await box.getByTestId("feature-freeConsultation").check();
  // Switching category keeps the shared choice and offers that category's own details.
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Gastronomie" });
  await expect(box.getByTestId("feature-delivery")).toBeVisible();
  await expect(box.getByTestId("feature-wheelchair")).toBeChecked();
  await box.getByTestId("feature-halal").check();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("feature-halal")).toBeChecked();
  await expect(page.getByTestId("feature-wheelchair")).toBeChecked();

  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/business/${slug}`);
  const shown = page.getByTestId("business-features");
  await expect(shown).toContainText("Halal");
  await expect(shown).toContainText("Rollstuhlgerecht");
  // Consultation belongs to the legal category only: it was not stored for a restaurant.
  await expect(shown).not.toContainText("Erstberatung");
});

for (const locale of ["de", "ckb"] as const) {
  test(`the form fits a 320 px phone without horizontal scrolling (${locale})`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "phone layout");
    await login(page);
    await page.setViewportSize({ width: 320, height: 720 });
    // The dashboard follows the saved language choice; Sorani renders right-to-left.
    await page.context().addCookies([{ name: "REGA_LOCALE", value: locale, url: new URL(page.url()).origin }]);
    await page.goto("/dr/businesses/new");
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ckb" ? "rtl" : "ltr");
    await page.getByTestId("hours-start").click();
    await page.getByTestId("hours-add-mon").click();
    // Staff see every section on one page: walk through all of them.
    for (const id of ["sec-basics", "sec-contact", "sec-social", "sec-location", "sec-hours", "sec-media"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id}`)).toBeVisible();
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    }
  });
}
