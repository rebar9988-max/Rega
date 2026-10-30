/**
 * Optional social profiles inside the phone card of the business profile, end to end: the admin enters them in the
 * business form (links or @usernames, refused when they are not on the platform's own domain), the profile shows a
 * button only for each platform that was entered, and without any the phone card stays compact (no divider, no row).
 * Also covers the profile's About / Hours / Reviews tabs and the back button on the cover.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);
const name = `E2E Sozial ${stamp}`;
let businessId = "";
let slug = "";

async function login(page: Page, next = "%2Fdr") {
  await page.goto(`/de/login?next=${next}`);
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe.configure({ mode: "serial" });

test("social links are validated per platform and stored as https profile links", async ({ page }) => {
  await login(page);
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  await page.getByLabel("Straße und Hausnummer").fill("Markt 1");
  await page.locator('select[name="countryCode"]').selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Hamburg");
  await page.getByTestId("lat").fill("53.5511");
  await page.getByTestId("lng").fill("9.9937");
  await page.getByTestId("confirm-location").check();
  await page.locator('input[name="phone"]').fill("+49 228 317620");

  // A foreign domain is refused, on the page and by the server.
  await page.getByTestId("social-instagram").fill("@rega24");
  await page.getByTestId("social-facebook").fill("https://evil.example/facebook.com");
  await expect(page.getByTestId("social-facebook")).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();

  await page.getByTestId("social-facebook").fill("");
  await page.getByTestId("social-snapchat").fill("https://www.snapchat.com/add/rega24");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("social-instagram")).toHaveValue("https://www.instagram.com/rega24");
  await expect(page.getByTestId("social-snapchat")).toHaveValue("https://www.snapchat.com/add/rega24");
  businessId = page.url().split("?")[0].split("/").pop()!;
  slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
});

test("the phone card shows the number and only the entered platforms, below a divider", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/ckb/business/${slug}`);
  const card = page.getByTestId("business-contact");
  await expect(card.locator('a[href^="tel:"]')).toContainText("+49 228 317620");
  const social = card.getByTestId("business-social");
  await expect(social.getByRole("link")).toHaveCount(2);
  await expect(social.getByTestId("social-link-instagram")).toHaveAttribute("href", "https://www.instagram.com/rega24");
  await expect(social.getByTestId("social-link-snapchat")).toHaveAttribute("href", "https://www.snapchat.com/add/rega24");
  await expect(social.getByTestId("social-link-instagram")).toHaveAttribute("rel", /noopener/);
  await expect(social.getByTestId("social-link-instagram")).toHaveAttribute("target", "_blank");
  await expect(card.getByTestId("social-link-facebook")).toHaveCount(0);
  await expect(card.getByTestId("social-link-tiktok")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Tabs: About first; Hours and Reviews on click and with the arrow keys (reading direction).
  await expect(page.getByTestId("business-panel-about")).toBeVisible();
  await page.getByTestId("business-tab-hours").click();
  await expect(page.getByTestId("business-panel-hours")).toBeVisible();
  await expect(page.getByTestId("business-panel-about")).toBeHidden();
  await page.keyboard.press("ArrowLeft"); // RTL: the next tab is on the left
  await expect(page.getByTestId("business-tab-reviews")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("business-panel-reviews")).toBeVisible();

  // The back button sits on the cover's reading-start side (right in RTL) and leads to the directory.
  const back = page.getByTestId("business-back");
  const box = await back.boundingBox();
  expect(box && box.x > 375 / 2).toBeTruthy();
  await expect(back).toHaveAttribute("href", "/ckb/businesses");
});

test("without social links the phone card has no divider and no social row", async ({ page }) => {
  await login(page, `%2Fdr%2Fbusinesses%2F${businessId}`);
  await page.goto(`/dr/businesses/${businessId}`);
  await page.getByTestId("social-instagram").fill("");
  await page.getByTestId("social-snapchat").fill("");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByTestId("form-notice")).toBeVisible();
  await page.goto(`/de/business/${slug}`);
  await expect(page.getByTestId("business-contact").locator('a[href^="tel:"]')).toBeVisible();
  await expect(page.getByTestId("business-social")).toHaveCount(0);
  await expect(page.getByTestId("business-contact").locator(".border-t")).toHaveCount(0);
});
