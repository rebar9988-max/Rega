import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { assertSafeDatabase } from "./global-setup";

const locales = ["ckb", "kmr", "de", "en", "ar", "tr", "fa"] as const;
const stamp = Date.now().toString(36);
const password = "rega-business-test-12345";
const email = `business-workspace-${stamp}@example.org`;
const otherEmail = `business-other-${stamp}@example.org`;
const readerEmail = `business-reader-${stamp}@example.org`;
const businessName = `E2E Workspace ${stamp}`;
let otherBusinessId: string;
let ownId: string;

async function login(page: Page, address = email) {
  await page.goto("/de/business-owner");
  await page.getByLabel("E-Mail", { exact: true }).fill(address);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/dr\/business-owner$/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await assertSafeDatabase(process.env.DATABASE_URL!);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    for (const [address, role] of [[email, "BUSINESS_OWNER"], [otherEmail, "BUSINESS_OWNER"], [readerEmail, "USER"]] as const) {
      await db.user.create({ data: { email: address, role, name: "E2E Workspace", emailVerified: new Date(), passwordHash, locale: "de" } });
    }
    const other = await db.user.findUniqueOrThrow({ where: { email: otherEmail } });
    const category = await db.category.findUniqueOrThrow({ where: { key: "legal" } });
    const b = await db.business.create({ data: { name: `E2E Private Other ${stamp}`, slug: `e2e-private-other-${stamp}`, categoryId: category.id,
      createdById: other.id, members: { create: { userId: other.id, role: "EMPLOYEE" } } } });
    otherBusinessId = b.id;
  } finally { await db.$disconnect(); }
});

for (const locale of locales) {
  test(`business auth preserves its destination and direction in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto(`/${locale}/business-owner?add=1`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=%2Fdr%2Fbusinesses%2Fnew$`));
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("dir", ["ckb", "ar", "fa"].includes(locale) ? "rtl" : "ltr");
    const tabs = page.locator('main nav');
    await tabs.locator('a[href*="/register?"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/register\\?next=%2Fdr%2Fbusinesses%2Fnew$`));
    await expect(page.locator('input[name="next"]')).toHaveValue("/dr/businesses/new");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/business-auth-${locale}.png`, fullPage: true });
  });
}

test("desktop and mobile navigation enter one business workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/de");
  await page.locator("header").getByRole("link", { name: "Geschäftskonto", exact: true }).click();
  await expect(page).toHaveURL(/\/de\/login\?next=%2Fdr%2Fbusiness-owner$/);
  await page.goto("/de");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menü" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu.getByRole("link").first()).toHaveText("Geschäftskonto");
  await menu.getByRole("link", { name: "Geschäftskonto", exact: true }).click();
  await expect(page).toHaveURL(/\/de\/login\?next=%2Fdr%2Fbusiness-owner$/);
});

test("empty workspace, canonical creation and atomic membership use the existing form", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("business-owner-home")).toContainText("Willkommen");
  await expect(page.getByTestId("owner-businesses")).toHaveCount(0);
  await page.getByTestId("owner-add-business").click();
  await expect(page).toHaveURL(/\/dr\/businesses\/new$/);
  await page.getByLabel("Name", { exact: true }).fill(businessName);
  await page.getByLabel("Kategorie").selectOption({ label: "Recht" });
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("draft-saved")).toBeVisible();
  // Draft creation commits both the real business and the creator's existing membership model.
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const records = await db.business.findMany({ where: { name: businessName }, include: { members: { include: { user: true } } } });
    expect(records).toHaveLength(1);
    ownId = records[0].id;
    expect(records[0].status).toBe("draft");
    expect(records[0].verified).toBe(false);
    expect(records[0].members).toHaveLength(1);
    expect(records[0].members[0].user.email).toBe(email);
    expect(records[0].members[0].isActive).toBe(true);
  } finally { await db.$disconnect(); }
  await page.goto("/de/business-owner");
  await expect(page.getByTestId("owner-businesses")).toContainText(businessName);
  await expect(page.getByTestId("owner-businesses")).not.toContainText("Private Other");
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/business-dashboard-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('header summary[aria-label="Menü"]').click();
  await page.getByRole("navigation", { name: "Menü", exact: true }).getByRole("link", { name: "Meine Unternehmen", exact: true }).click();
  await expect(page).toHaveURL(/\/dr\/businesses$/);
  await expect(page.locator('header summary[aria-label="Menü"]').locator("..")).not.toHaveAttribute("open", "");
  await page.goto(`/dr/businesses/${ownId}`);
  for (const width of [320, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/business-form-${width}.png`, fullPage: true });
  }
});

test("another owner cannot read or mutate this owner's business; USER gains no permissions", async ({ page }) => {
  await login(page, otherEmail);
  await expect(page.getByTestId("owner-businesses")).not.toContainText(businessName);
  await expect(page.getByTestId("owner-businesses")).toContainText("Private Other");
  await page.goto(`/dr/businesses/${ownId}`);
  await expect(page.locator("main")).not.toContainText(businessName);
  const denied = await page.request.patch(`/api/v1/businesses/${ownId}`, { data: { name: "Not allowed" } });
  expect(denied.status()).toBe(403);
  // Membership cannot be requested by submitting someone else's owner identifier.
  const selfApprove = await page.request.patch(`/api/v1/businesses/${otherBusinessId}`, { data: { verified: true } });
  expect(selfApprove.status()).toBe(403);
  await page.context().clearCookies();
  await login(page, readerEmail);
  await expect(page.getByTestId("business-owner-home")).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("Verwaltungszugriff");
  const forbidden = await page.request.post("/api/v1/businesses", { data: { name: "Denied", ownerId: ownId } });
  expect(forbidden.status()).toBe(403);
});

test("workspace language links keep a valid canonical URL", async ({ page }) => {
  await login(page);
  await page.locator('summary[aria-label^="Sprache"]').click();
  await page.locator('header a[href="/ckb/business-owner"]').click();
  await expect(page).toHaveURL(/\/dr\/business-owner$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toHaveText("پانێڵی خاوەنکار");
});
