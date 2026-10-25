/**
 * WhatsApp button and business offers, end to end (admin creates the business; ownership is checked with an employee
 * who is not a member). The wa.me link must come only from a valid public number; offers must follow their dates and
 * their switch; the server refuses misleading or impossible offers.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

const stamp = Date.now().toString(36);
const name = `E2E Angebot ${stamp}`;
let businessId = "";
let slug = "";
let offerId = "";

async function login(page: Page, who: { email: string; password: string }, next = "%2Fadmin") {
  await page.goto(`/de/login?next=${next}`);
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

const ymd = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

test.describe.configure({ mode: "serial" });

test("a valid public WhatsApp number is stored in international form and shown as a wa.me button", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  await page.getByLabel("Straße und Hausnummer").fill("Jungfernstieg 7");
  await page.getByLabel("Land").selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Hamburg");
  await page.getByTestId("lat").fill("53.5511");
  await page.getByTestId("lng").fill("9.9937");
  await page.getByTestId("confirm-location").check();

  // Not a phone number: refused by the server, nothing is cleaned up silently.
  await page.getByTestId("whatsapp").fill("https://evil.example/x?y=1");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page.getByTestId("whatsapp")).toHaveAttribute("aria-invalid", "true");

  // A German national number becomes +49 …
  await page.getByTestId("whatsapp").fill("0178 4228269");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("whatsapp")).toHaveValue("+491784228269");
  businessId = page.url().split("?")[0].split("/").pop()!;

  slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/businesses/${slug}`);
  // One WhatsApp button, in the header (the contact card does not repeat it).
  const link = page.getByTestId("whatsapp-button");
  await expect(link).toHaveAttribute("href", "https://wa.me/491784228269");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(page.getByTestId("whatsapp-button-aside")).toHaveCount(0);
});

test("without a WhatsApp number there is no WhatsApp button", async ({ page }) => {
  await login(page, ADMIN, `%2Fadmin%2Fbusinesses%2F${businessId}`);
  await page.goto(`/admin/businesses/${businessId}`);
  await page.getByTestId("whatsapp").fill("");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByTestId("form-notice")).toBeVisible();
  await page.goto(`/de/businesses/${slug}`);
  await expect(page.getByTestId("whatsapp-button")).toHaveCount(0);
  await expect(page.getByTestId("whatsapp-button-aside")).toHaveCount(0);
});

test("offers: misleading or impossible offers are refused; a genuine one is shown while it runs", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/admin/offers/new?business=${businessId}`);
  await page.getByTestId("offer-title").fill("30 % Rabatt auf alles");
  // The text claims a percentage but no percentage discount is declared.
  await page.getByTestId("offer-save").click();
  await expect(page.getByTestId("form-error")).toContainText("Prozentsatz");
  // A different percentage than the declared one.
  await page.getByTestId("offer-discount-type").selectOption("percent");
  await page.getByTestId("offer-discount-value").fill("20");
  await page.getByTestId("offer-save").click();
  await expect(page.getByTestId("form-error")).toContainText("Prozentsatz");
  // 120 % is not a valid discount.
  await page.getByTestId("offer-title").fill("Spezialangebot");
  await page.getByTestId("offer-discount-value").fill("120");
  await page.getByTestId("offer-save").click();
  await expect(page.getByTestId("form-error")).toContainText("gültigen Rabatt");
  // An offer that is already over.
  await page.getByTestId("offer-discount-value").fill("20");
  await page.getByTestId("offer-start").fill("2020-01-01");
  await page.getByTestId("offer-end").fill("2020-01-31");
  await page.getByTestId("offer-save").click();
  await expect(page.getByTestId("form-error")).toContainText("bereits beendet");
  // End before start.
  await page.getByTestId("offer-start").fill(ymd(5));
  await page.getByTestId("offer-end").fill(ymd(2));
  await page.getByTestId("offer-save").click();
  await expect(page.getByTestId("form-error")).toBeVisible();

  // A genuine offer from today on.
  await page.getByTestId("offer-title").fill("20 % Rabatt auf die Erstberatung");
  await page.getByTestId("offer-start").fill(ymd(-1));
  await page.getByTestId("offer-end").fill(ymd(20));
  await page.getByTestId("offer-save").click();
  await expect(page).toHaveURL(/\/admin\/offers\/[^/?]+\?saved=1$/);
  offerId = page.url().split("?")[0].split("/").pop()!;
  await expect(page.getByTestId("offer-state")).toHaveText("Läuft");

  await page.goto(`/de/businesses/${slug}`);
  const offers = page.getByTestId("business-offers");
  await expect(offers).toContainText("20 % Rabatt auf die Erstberatung");
  await expect(offers.getByTestId("offer-discount")).toContainText("Rabatt");
});

test("a future offer is not shown yet; switching an offer off hides it and keeps the record", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/admin/offers/new?business=${businessId}`);
  await page.getByTestId("offer-title").fill("Frühjahrsaktion");
  await page.getByTestId("offer-start").fill(ymd(10));
  await page.getByTestId("offer-end").fill(ymd(20));
  await page.getByTestId("offer-save").click();
  await expect(page.getByTestId("offer-state")).toHaveText("Geplant");
  await page.goto(`/de/businesses/${slug}`);
  await expect(page.getByTestId("business-offers")).not.toContainText("Frühjahrsaktion");

  await page.goto(`/admin/offers/${offerId}`);
  await page.getByTestId("offer-switch").click();
  await expect(page.getByTestId("form-notice")).toContainText("ausgeschaltet");
  await expect(page.getByTestId("offer-state")).toHaveText("Ausgeschaltet");
  await page.goto(`/de/businesses/${slug}`);
  await expect(page.getByTestId("business-offers")).toHaveCount(0);
  // Still in the dashboard, and it can be switched on again while its dates apply.
  await page.goto(`/admin/offers/${offerId}`);
  await page.getByTestId("offer-switch").click();
  await expect(page.getByTestId("offer-state")).toHaveText("Läuft");
});

test("someone who does not manage the business cannot see or open its offers", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, EMPLOYEE);
  expect((await ctx.request.get(`/admin/offers/${offerId}`)).status()).not.toBe(200);
  expect((await ctx.request.get(`/admin/offers/new?business=${businessId}`)).status()).not.toBe(200);
  await ctx.close();
});
