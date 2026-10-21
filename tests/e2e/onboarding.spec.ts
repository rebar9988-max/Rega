/**
 * Business-owner onboarding, end to end: register -> create a listing -> submit for review -> an admin approves it ->
 * it is public. Runs with EMAIL_PROVIDER=none, where no confirmation mail can be sent: the account stays unconfirmed and
 * submitting is refused (docs/adr/0005); the test then confirms the address directly in the database, standing in for
 * the click on the mail link. The token flows themselves are covered by unit tests of the token module.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";
import { UNCONFIRMED_NOTICE, confirmEmailOf } from "./confirm-email";

const stamp = Date.now().toString(36);
const OWNER = { name: "E2E Owner", email: `owner-${stamp}@example.org`, password: "owner-pass-12345" };

async function login(page: Page, email: string, password: string, next = "%2Fdr") {
  await page.goto(`/de/login?next=${next}`);
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * The owner's three-step form. Step 1 (basics) and step 2 (location) are filled here; the caller continues on step 3.
 * Next stores the progress as a draft on the server.
 */
async function fillOwnerSteps(page: Page, name: string, opts: { german?: boolean } = {}) {
  await page.goto("/dr/businesses/new");
  await expect(page.getByTestId("wizard-step-1")).toHaveAttribute("aria-current", "step");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  if (opts.german) {
    await page.getByText("Optionale Angaben", { exact: true }).click();
    await page.getByLabel("Deutsch", { exact: true }).check();
  }
  await page.getByLabel("Straße und Hausnummer").fill("Oranienstraße 1");
  await page.getByLabel("Land").selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Berlin");
  await page.getByLabel("Postleitzahl").fill("10999");
  await page.getByTestId("find-location").click();
  await expect(page.getByTestId("geocode-hits")).toBeVisible();
  await page.getByTestId("confirm-location").check();
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("wizard-step-2")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("draft-saved")).toBeVisible();
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("wizard-step-3")).toHaveAttribute("aria-current", "step");
}

test.describe.configure({ mode: "serial" });

test("for-business page: free statement, steps, verified explanation, register CTA; no pricing", async ({ page }) => {
  await page.goto("/de/for-business");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Für Unternehmen");
  await expect(page.getByTestId("free-statement")).toContainText("komplett kostenlos");
  await expect(page.getByRole("main")).toContainText("Rega Verified");
  await expect(page.getByRole("main")).not.toContainText(/€|\bEUR\b|Preis|Premium/);
  await page.getByTestId("cta-register").click();
  await expect(page).toHaveURL(/\/de\/register\?next=%2Fdr%2Fbusinesses%2Fnew$/);
});

test("header 'add listing' goes to /for-business when logged out", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/de");
  await expect(page.locator("header").locator('a[href="/de/for-business"]').first()).toBeVisible();
});

test("registration validates: terms are required, passwords must match and be long enough", async ({ page }) => {
  await page.goto("/de/register");
  const form = page.getByTestId("register-form");
  await form.getByLabel("Name", { exact: true }).fill(OWNER.name);
  await form.getByLabel("E-Mail", { exact: true }).fill(OWNER.email);
  await form.getByLabel("Passwort", { exact: true }).fill("kurz");
  await form.getByLabel("Passwort wiederholen").fill("kurz");
  await form.getByRole("button", { name: "Konto erstellen" }).click();
  // Native validation stops a too-short password before the server is called.
  await expect(page).toHaveURL(/\/de\/register$/);
  expect(await form.getByLabel("Passwort", { exact: true }).evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);
  await form.getByLabel("Passwort", { exact: true }).fill(OWNER.password);
  await form.getByLabel("Passwort wiederholen").fill(OWNER.password + "x");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(form.getByRole("alert")).toContainText("stimmen nicht überein");
});

test("owner registers, creates a listing, submits it; an admin approves; it is public", async ({ page, browser }) => {
  // 1. Register.
  await page.goto("/de/register");
  const form = page.getByTestId("register-form");
  await form.getByLabel("Name", { exact: true }).fill(OWNER.name);
  await form.getByLabel("E-Mail", { exact: true }).fill(OWNER.email);
  await form.getByLabel("Passwort", { exact: true }).fill(OWNER.password);
  await form.getByLabel("Passwort wiederholen").fill(OWNER.password);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Konto erstellen" }).click();
  // No mail provider: the account exists but is NOT marked confirmed, and the visitor is told why.
  await expect(page.getByRole("status")).toContainText(UNCONFIRMED_NOTICE);

  // 2. Sign in, create a listing in the dashboard.
  await login(page, OWNER.email, OWNER.password);
  await expect(page).toHaveURL(/\/dr\/businesses$/); // owners land on their listings, not on platform totals
  const name = `E2E Inserat ${stamp}`;
  // Owners cannot publish: only "submit for review" exists.
  await fillOwnerSteps(page, name, { german: true });
  await expect(page.getByRole("button", { name: "Speichern und veröffentlichen" })).toHaveCount(0);
  await expect(page.getByTestId("wizard-review")).toContainText(name);
  // Unconfirmed address: submitting for review is refused.
  await page.getByTestId("submit-review").click();
  await expect(page.getByTestId("form-error")).toContainText("E-Mail-Adresse");
  await confirmEmailOf(OWNER.email);
  await page.getByTestId("submit-review").click();
  await expect(page.getByTestId("form-notice")).toContainText("zur Prüfung eingereicht");
  await expect(page.getByTestId("business-status")).toHaveText("Ausstehend");
  const editUrl = page.url().split("?")[0];
  const id = editUrl.split("/").pop()!;

  // Pending listings are not public.
  const hidden = await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json();
  expect(hidden.data.some((b: { name: string }) => b.name === name)).toBe(false);

  // 3. An owner cannot reach admin pages or self-verify through the API.
  expect((await page.request.get("/dr/users")).status()).not.toBe(200);
  const patch = await page.request.patch(`/api/v1/businesses/${id}`, { data: { verified: true, featured: true } });
  expect(patch.status()).toBe(403);
  const publish = await page.request.patch(`/api/v1/businesses/${id}`, { data: { status: "published" } });
  expect(publish.status()).toBe(403);

  // 4. An admin sees it as pending and approves it.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN.email, ADMIN.password);
  // The owner's attempt to verify / feature themselves was ignored.
  const stored = await (await admin.request.get(`/api/v1/businesses/${id}`)).json();
  expect(stored.data.verified).toBe(false);
  expect(stored.data.featured).toBe(false);
  await admin.goto(`/dr/businesses?status=pending&q=${encodeURIComponent(name)}`);
  const row = admin.locator("tr", { hasText: name });
  await expect(row.getByTestId("row-status")).toHaveText("Ausstehend");
  await row.getByTestId("moderation").getByRole("button", { name: "Prüfen & veröffentlichen" }).click();
  await expect(admin.locator("tr", { hasText: name })).toHaveCount(0, { timeout: 15_000 }); // no longer pending
  await admin.goto(`/dr/businesses?q=${encodeURIComponent(name)}`);
  await expect(admin.locator("tr", { hasText: name }).getByTestId("row-status")).toHaveText("Veröffentlicht");
  await adminCtx.close();

  // 5. Public now.
  await page.goto(`/de/businesses?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("main").getByRole("link", { name })).toBeVisible();
});

test("an admin can return a pending listing for changes", async ({ page, browser }) => {
  await login(page, OWNER.email, OWNER.password);
  const name = `E2E Rückgabe ${stamp}`;
  await fillOwnerSteps(page, name);
  await page.getByTestId("submit-review").click();
  await expect(page.getByTestId("business-status")).toHaveText("Ausstehend");

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN.email, ADMIN.password);
  await admin.goto(`/dr/businesses?status=pending&q=${encodeURIComponent(name)}`);
  const row = admin.locator("tr", { hasText: name });
  await row.getByPlaceholder("Grund (für den Inhaber)").fill("Bitte Öffnungszeiten ergänzen");
  await row.getByRole("button", { name: "Zur Überarbeitung zurück" }).click();
  await expect(admin.locator("tr", { hasText: name })).toHaveCount(0, { timeout: 15_000 });
  await admin.goto(`/dr/businesses?q=${encodeURIComponent(name)}`);
  await expect(admin.locator("tr", { hasText: name }).getByTestId("row-status")).toHaveText("Entwurf");
  await adminCtx.close();
});

test("owner wizard: Next needs a confirmed map pin, Back keeps what was typed, the draft is saved once, WhatsApp is checked", async ({ page }) => {
  await login(page, OWNER.email, OWNER.password);
  const name = `E2E Schritte ${stamp}`;
  await page.goto("/dr/businesses/new");
  // Step 1 needs a name and a category.
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("step-error")).toBeVisible();
  await expect(page.getByTestId("wizard-step-1")).toHaveAttribute("aria-current", "step");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  // All essential information is now on step 1; media is step 2, review is step 3.
  await page.getByLabel("Straße und Hausnummer").fill("Oranienstraße 1");
  await page.getByLabel("Stadt", { exact: true }).fill("Berlin");
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("step-error")).toBeVisible();
  await expect(page.getByTestId("wizard-step-1")).toHaveAttribute("aria-current", "step");
  await page.getByTestId("find-location").click();
  await expect(page.getByTestId("geocode-hits")).toBeVisible();
  await page.getByTestId("confirm-location").check();
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("wizard-step-2")).toHaveAttribute("aria-current", "step");
  await page.getByTestId("wizard-back").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
  await expect(page.getByLabel("Straße und Hausnummer")).toHaveValue("Oranienstraße 1");
  // Step 3: a WhatsApp number must be a real international number.
  await page.getByTestId("whatsapp").fill("https://evil.example/x");
  await expect(page.getByTestId("whatsapp-hint")).toContainText("gültige Nummer");
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("form-error")).toBeVisible(); // the server refuses it too
  await page.getByTestId("whatsapp").fill("0178 4228269");
  await expect(page.getByTestId("whatsapp-hint")).toContainText("+491784228269");
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("draft-saved")).toBeVisible();
  // Saving the draft again (and the earlier Next) never created a second listing.
  await page.goto(`/dr/businesses?q=${encodeURIComponent(name)}`);
  await expect(page.locator("tr", { hasText: name })).toHaveCount(1);
});

test("an owner sees only their own listings", async ({ page }) => {
  await login(page, OWNER.email, OWNER.password);
  await page.goto("/dr/businesses");
  await expect(page.locator("tbody")).not.toContainText("Zagros Restaurant");
  await expect(page.locator("tbody")).toContainText("E2E Inserat");
});
