import bcrypt from "bcryptjs";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
import { testDatabaseClient } from "./database-client";

test("owner account: business dashboard hides, shows again and deletes own business; tabs, a11y and sign-out keep the account", async ({ page }, info) => {
  const db = testDatabaseClient();
  const email = "figma-owner@example.org";
  const password = "figma-owner-local-test-123";
  const stamp = `${Date.now()}-${info.project.name}`.replace(/[^a-z0-9-]/gi, "");
  let businessId: string | undefined;
  try {
    const user = await db.user.upsert({ where: { email }, update: { status: "active", role: "BUSINESS_OWNER", passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() }, create: { email, name: "E2E Figma owner", role: "BUSINESS_OWNER", status: "active", passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() } });
    const business = await db.business.create({ data: {
      name: `E2E Owner ${stamp}`, slug: `e2e-owner-${stamp}`, searchText: `e2e owner ${stamp}`, status: "draft", createdById: user.id,
      locations: { create: { addressLine1: "Local test address", countryCode: "DE", isPrimary: true } },
      members: { create: { userId: user.id, role: "EMPLOYEE" } },
    } });
    businessId = business.id;

    await page.goto("/de/login?next=%2Fde%2Faccount");
    await page.getByLabel("E-Mail", { exact: true }).fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/de\/account$/);

    // Owners land on their own business dashboard (first tab), reachable only from the account.
    await expect(page.getByTestId("tab-business")).toHaveAttribute("aria-current", "page");
    const card = page.getByTestId("owner-business").filter({ hasText: business.name });
    await expect(card).toHaveAttribute("data-status", "draft");
    await expect(page.locator('main a[href="/dr/businesses/new"]')).toBeVisible();
    await expect(card.locator(`a[href="/dr/businesses/${business.id}"]`)).toBeVisible();

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const screenshot = info.outputPath(`owner-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await info.attach(`owner-${width}`, { path: screenshot, contentType: "image/png" });
    }
    const a11y = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(a11y.violations).toEqual([]);

    // Hide (asks first), then show again: back on the account with a visible confirmation.
    await card.getByTestId("owner-hide").click();
    await page.locator("dialog[open]").getByTestId("confirm-submit").click();
    await expect(page).toHaveURL(/\/de\/account\?tab=business&visibility=hidden/);
    await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "hidden");
    await expect(card).toHaveAttribute("data-status", "archived");
    await card.getByTestId("owner-unhide").click();
    await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "restoredDraft");
    await expect(card).toHaveAttribute("data-status", "draft");

    // Delete own business: the existing soft delete (record kept, restorable by an administrator).
    await card.getByTestId("owner-delete").click();
    await page.locator("dialog[open]").getByTestId("confirm-submit").click();
    await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "deleted");
    await expect(card).toHaveCount(0);
    const after = await db.business.findUniqueOrThrow({ where: { id: business.id }, select: { deletedAt: true } });
    expect(after.deletedAt).not.toBeNull();

    // Profile and security tabs; sign-out lives in one place (security).
    await page.getByTestId("tab-profile").click();
    await expect(page).toHaveURL(/tab=profile/);
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    await page.getByTestId("tab-security").click();
    await expect(page.getByTestId("email-status")).toBeVisible();
    await expect(page.locator('main a[href="/de/forgot-password"]')).toBeVisible();
    const a11ySecurity = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(a11ySecurity.violations).toEqual([]);
    await page.getByRole("button", { name: "Abmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/de$/);
    await page.goto("/de/account");
    await expect(page).toHaveURL(/\/de\/login\?/);
    expect(await db.user.count({ where: { email } })).toBe(1);
  } finally {
    // Test fixture only (local disposable database): remove the business this test created.
    if (businessId) await db.business.delete({ where: { id: businessId } }).catch(() => undefined);
    await db.$disconnect();
  }
});

test("another owner cannot delete a business they do not manage", async ({ page }) => {
  const db = testDatabaseClient();
  const email = "figma-owner-2@example.org";
  const password = "figma-owner-local-test-456";
  let businessId: string | undefined;
  try {
    await db.user.upsert({ where: { email }, update: { status: "active", role: "BUSINESS_OWNER", passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() }, create: { email, name: "E2E second owner", role: "BUSINESS_OWNER", status: "active", passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() } });
    const stamp = `${Date.now()}`;
    const foreign = await db.business.create({ data: { name: `E2E foreign ${stamp}`, slug: `e2e-foreign-${stamp}-${test.info().project.name}`, searchText: `e2e foreign ${stamp}`, status: "draft" } });
    businessId = foreign.id;
    await page.goto("/de/login?next=%2Fde%2Faccount");
    await page.getByLabel("E-Mail", { exact: true }).fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/de\/account$/);
    await expect(page.getByTestId("owner-business").filter({ hasText: foreign.name })).toHaveCount(0);
    await expect(page.getByTestId("owner-empty")).toBeVisible();
    expect((await db.business.findUniqueOrThrow({ where: { id: foreign.id }, select: { deletedAt: true } })).deletedAt).toBeNull();
  } finally {
    if (businessId) await db.business.delete({ where: { id: businessId } }).catch(() => undefined);
    await db.$disconnect();
  }
});
