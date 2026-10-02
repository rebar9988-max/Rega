/** Reviews: signed-in users only, one per user per business, hidden until a moderator approves, owners cannot review themselves. */
import type { Page } from "@playwright/test";
import pg from "pg";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";
import { UNCONFIRMED_NOTICE, confirmEmailOf } from "./confirm-email";

const stamp = Date.now().toString(36);
const USER = { name: "E2E Rezensent", email: `rev-${stamp}@example.org`, password: "reviewer-pass-123" };
const BUSINESS = "/de/business/sulaymaniyah-clinic";

async function login(page: Page, email: string, password: string) {
  await page.goto("/de/login");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe.configure({ mode: "serial" });

test("guests see the reviews section with a sign-in prompt and no form", async ({ page }) => {
  await page.goto(BUSINESS);
  const section = page.getByTestId("reviews");
  await expect(section.getByRole("heading", { name: "Bewertungen" })).toBeVisible();
  await expect(section.getByRole("link", { name: "Anmelden, um zu bewerten" })).toBeVisible();
  await expect(page.getByTestId("review-form")).toHaveCount(0);
});

test("a user reviews; it is hidden until approved; editing replaces the old review; the rating updates after approval", async ({ page, browser }) => {
  await page.goto("/de/register");
  const reg = page.getByTestId("register-form");
  await reg.getByLabel("Name", { exact: true }).fill(USER.name);
  await reg.getByLabel("E-Mail", { exact: true }).fill(USER.email);
  await reg.getByLabel("Passwort", { exact: true }).fill(USER.password);
  await reg.getByLabel("Passwort wiederholen").fill(USER.password);
  await reg.locator('input[value="user"]').check();
  await reg.getByRole("checkbox", { name: /Ich akzeptiere/ }).check();
  await reg.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("status")).toContainText(UNCONFIRMED_NOTICE);
  await login(page, USER.email, USER.password);

  await page.goto(BUSINESS);
  const form = page.getByTestId("review-form");
  // Unconfirmed address: reviewing is refused; after confirmation (the mail link) it works.
  await form.locator('label[for="rating-4"]').click();
  await form.getByLabel("Kommentar (optional)").fill("Freundlich und pünktlich.");
  await form.getByRole("button", { name: "Bewertung senden" }).click();
  await expect(form.getByRole("alert")).toContainText("E-Mail-Adresse");
  await confirmEmailOf(USER.email);
  await page.goto(BUSINESS);
  await form.locator('label[for="rating-4"]').click();
  await form.getByLabel("Kommentar (optional)").fill("Freundlich und pünktlich.");
  await form.getByRole("button", { name: "Bewertung senden" }).click();
  await expect(page.getByTestId("review-sent")).toBeVisible();

  // Not public yet (a guest does not see it), the author sees that it is pending.
  const guest = await browser.newContext();
  const g = await guest.newPage();
  await g.goto(BUSINESS);
  await expect(g.getByTestId("review").filter({ hasText: "Freundlich und pünktlich." })).toHaveCount(0);
  await guest.close();
  await page.goto(BUSINESS);
  await expect(page.getByTestId("review-form")).toContainText("wartet auf Prüfung");

  // Editing replaces the review (still one per user).
  await page.getByTestId("review-form").locator('label[for="rating-5"]').click();
  await page.getByTestId("review-form").getByLabel("Kommentar (optional)").fill(`Sehr gut ${stamp}.`);
  await page.getByTestId("review-form").getByRole("button", { name: "Bewertung senden" }).click();
  await expect(page.getByTestId("review-sent")).toBeVisible();

  // A moderator approves it.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN.email, ADMIN.password);
  await admin.goto("/dr/reviews");
  const rows = admin.getByTestId("review-row").filter({ hasText: USER.email });
  await expect(rows).toHaveCount(1); // one review per user, even after the edit
  await expect(rows.first()).toContainText(`Sehr gut ${stamp}.`);
  await rows.first().getByRole("button", { name: "Freigeben" }).click();
  await expect(admin.getByTestId("review-row").filter({ hasText: USER.email })).toHaveCount(0);
  await adminCtx.close();

  // Public now, with the aggregate.
  await page.goto(BUSINESS);
  await expect(page.getByTestId("review").filter({ hasText: `Sehr gut ${stamp}.` })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("5,0");
  // Each review has a report link that prefills the review's address.
  await page.getByTestId("review").first().getByRole("link", { name: "Diese Bewertung melden" }).click();
  await expect(page).toHaveURL(/\/de\/report\?url=.*review-/);
});

test("members of a business cannot review it; invalid input is refused by the server", async ({ page }) => {
  await login(page, USER.email, USER.password);
  await page.goto(BUSINESS);
  const form = page.getByTestId("review-form");
  // Invalid rating (tampered value): refused.
  await form.locator('label[for="rating-3"]').click();
  await form.evaluate((f: HTMLFormElement) => { (f.querySelector('input[name="rating"]:checked') as HTMLInputElement).value = "9"; });
  await form.getByRole("button", { name: "Bewertung senden" }).click();
  await expect(form.getByRole("alert")).toContainText("Pflichtfelder");

  // Make the user a member of the business: the review is refused.
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const row = (await client.query(`select u.id as uid, b.id as bid from "User" u, "Business" b where u.email = $1 and b.slug = 'sulaymaniyah-clinic'`, [USER.email])).rows[0];
  await client.query(`insert into "BusinessMember" (id, "businessId", "userId", role, "isActive") values ($1, $2, $3, 'EMPLOYEE', true)`, [`m-${stamp}`, row.bid, row.uid]);
  try {
    await page.goto(BUSINESS);
    await page.getByTestId("review-form").locator('label[for="rating-2"]').click();
    await page.getByTestId("review-form").getByRole("button", { name: "Bewertung senden" }).click();
    await expect(page.getByTestId("review-form").getByRole("alert")).toContainText("eigenes Unternehmen");
  } finally {
    await client.query(`delete from "BusinessMember" where id = $1`, [`m-${stamp}`]);
    await client.end();
  }
});
