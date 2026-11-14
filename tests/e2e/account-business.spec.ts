/**
 * Business registration and management live in the account ("Meine Unternehmen" / کاروبارەکانم), not behind
 * "add advertisement" (Inserieren / ڕیکلام زیاد بکە). The advertisement link opens ad (offer) creation, which first asks
 * for one of the person's businesses; it never opens the business-registration form.
 */
import { expect, test } from "./fixtures";

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const OWNER = { name: "E2E Account Owner", email: `acct-owner-${stamp}@example.org`, password: "owner-pass-12345" };

test("signed out: the account is protected and the ad link does not open business registration", async ({ page }) => {
  await page.goto("/de/account");
  await expect(page).toHaveURL(/\/de\/login\?next=%2Fde%2Faccount/);
  await expect(page.locator('header a[href="/dr/businesses/new"]')).toHaveCount(0);
});

test("owner: My businesses with Add business is in the account; Add advertisement stays separate", async ({ page }) => {
  await page.goto("/de/register");
  const form = page.getByTestId("register-form");
  await form.getByLabel("Name", { exact: true }).fill(OWNER.name);
  await form.getByLabel("E-Mail", { exact: true }).fill(OWNER.email);
  await form.getByLabel("Passwort", { exact: true }).fill(OWNER.password);
  await form.getByLabel("Passwort wiederholen").fill(OWNER.password);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.goto("/de/login?next=%2Fde%2Faccount");
  await page.getByLabel("E-Mail", { exact: true }).fill(OWNER.email);
  await page.getByLabel("Passwort", { exact: true }).fill(OWNER.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/de/account");

  // Account: a clearly labelled "My businesses" section with an "Add business" action.
  const section = page.getByTestId("account-my-businesses");
  await expect(section.getByRole("heading", { name: "Meine Unternehmen" })).toBeVisible();
  await expect(section).toContainText("Sie haben noch kein Unternehmen hinzugefügt.");
  const add = page.getByTestId("account-add-business");
  await expect(add).toBeVisible();
  await expect(add).toHaveAttribute("href", "/dr/businesses/new");

  // Header and mobile menu: "Inserieren" opens ad creation, never the business-registration form.
  await expect(page.locator('header a[href="/dr/businesses/new"]')).toHaveCount(0);
  expect(await page.locator('header a[href="/dr/offers/new"]').count()).toBeGreaterThan(0);

  // Ad creation without a business points back to the account instead of registering one inline.
  await page.goto("/dr/offers/new");
  const chooser = page.getByTestId("offer-choose-business");
  await expect(chooser).toContainText("Um eine Anzeige hinzuzufügen, fügen Sie zuerst in Ihrem Konto ein Unternehmen hinzu.");
  await expect(chooser.getByRole("link")).toHaveAttribute("href", "/de/account#my-businesses");

  // The existing business workflow is reached from the account, unchanged.
  await page.goto("/de/account");
  await page.getByTestId("account-add-business").click();
  await expect(page).toHaveURL(/\/dr\/businesses\/new$/);
  await expect(page.getByTestId("wizard-step-1")).toHaveAttribute("aria-current", "step");
});
