import { expect, test } from "./fixtures";

// No OAuth credentials exist in CI, so no social button may be offered and the e-mail forms must be exactly as before.

test("chooser: two clear ways in, and the next target travels along", async ({ page }) => {
  await page.goto("/de/auth?next=%2Fde%2Faccount");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const chooser = page.getByTestId("auth-chooser");
  await expect(chooser.getByRole("link")).toHaveCount(2);
  await expect(chooser.getByRole("link").first()).toHaveAttribute("href", /\/de\/login\?next=%2Fde%2Faccount$/);
  await expect(chooser.getByRole("link").nth(1)).toHaveAttribute("href", /\/de\/register\?next=%2Fde%2Faccount$/);
  await chooser.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/de\/login/);
});

test("chooser: an unsafe next target is dropped", async ({ page }) => {
  await page.goto("/de/auth?next=%2F%2Fevil.example");
  const hrefs = await page.getByTestId("auth-chooser").getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  for (const href of hrefs) expect(href).not.toContain("evil");
});

test("chooser is not indexed", async ({ page }) => {
  await page.goto("/de/auth");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("without provider credentials no social button is shown on login or register", async ({ page }) => {
  await page.goto("/de/login");
  await expect(page.getByTestId("social-buttons")).toHaveCount(0);
  await expect(page.getByLabel("E-Mail", { exact: true })).toBeVisible();
  await page.goto("/de/register");
  await expect(page.getByTestId("social-buttons")).toHaveCount(0);
  await expect(page.getByTestId("email-register")).toHaveCount(0);
  await expect(page.getByLabel("Passwort", { exact: true }).first()).toBeVisible();
});

test("a social error code shows a message, not a raw code", async ({ page }) => {
  await page.goto("/de/login?error=social_no_account");
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await expect(page.locator("p[role=alert]")).not.toContainText("social_");
  await page.goto("/de/register?error=AccessDenied");
  await expect(page.locator("p[role=alert]").first()).not.toContainText("AccessDenied");
});
