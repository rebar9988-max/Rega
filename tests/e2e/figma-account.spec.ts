import bcrypt from "bcryptjs";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
import { testDatabaseClient } from "./database-client";

test("owner account: responsive real actions, pending filter and sign-out preserve the account", async ({ page }, info) => {
  const db = testDatabaseClient();
  const email = "figma-owner@example.org";
  const password = "figma-owner-local-test-123";
  try {
    await db.user.upsert({ where: { email }, update: { status: "active", role: "BUSINESS_OWNER", passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() }, create: { email, name: "E2E Figma owner", role: "BUSINESS_OWNER", status: "active", passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() } });
    await page.goto("/de/login?next=%2Fde%2Faccount");
    await page.getByLabel("E-Mail", { exact: true }).fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/de\/account$/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('main a[href="/dr/businesses"]')).toBeVisible();
      const screenshot = info.outputPath(`owner-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await info.attach(`owner-${width}`, { path: screenshot, contentType: "image/png" });
    }
    const a11y = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(a11y.violations).toEqual([]);
    await page.locator('main a[href="/dr/businesses?status=pending"]').click();
    await expect(page).toHaveURL(/\/dr\/businesses\?status=pending$/);
    await page.goto("/de/account");
    await page.getByRole("button", { name: "Abmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/de$/);
    await page.goto("/de/account");
    await expect(page).toHaveURL(/\/de\/login\?/);
    expect(await db.user.count({ where: { email } })).toBe(1);
  } finally { await db.$disconnect(); }
});
