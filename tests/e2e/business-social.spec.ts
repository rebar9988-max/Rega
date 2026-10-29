import bcrypt from "bcryptjs";
import { encode } from "fast-png";
import { mkdir } from "node:fs/promises";
import { testDatabaseClient } from "./database-client";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { ADMIN } from "./global-setup";

// The global setup refuses production and non-test databases before any test writes.
test.use({ baseURL: `https://127.0.0.1:${Number(process.env.E2E_PORT ?? 3111) + 1}`, ignoreHTTPSErrors: true });
const db = testDatabaseClient();
const stamp = `${Date.now().toString(36)}-${process.pid}`;
const accounts = {
  facebookUrl: "https://www.facebook.com/rega-e2e-business",
  instagramUrl: "https://www.instagram.com/rega_e2e_business/",
  tiktokUrl: "https://www.tiktok.com/@rega_e2e_business",
  snapchatUrl: "https://www.snapchat.com/add/rega_e2e_business",
};
const labels = ["Facebook", "Instagram", "TikTok", "Snapchat"];
const owner = { email: `social-owner-${stamp}@example.org`, password: "social-owner-test-password" };
const stranger = { email: `social-stranger-${stamp}@example.org`, password: "social-stranger-test-password" };

async function login(page: Page, who = ADMIN) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/dr(?:\/businesses)?$/);
}
async function read(id: string) {
  return db.business.findUniqueOrThrow({ where: { id } });
}

test.afterAll(async () => { await db.$disconnect(); });

test("existing Add and Edit forms persist all platforms, preserve failed input, replace and remove accounts", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/dr/businesses/new");
  const name = `E2E Social form ${stamp}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  await page.getByLabel("Straße und Hausnummer").fill("Social Test Street 12");
  await page.getByLabel("Stadt", { exact: true }).fill("Berlin");
  for (const [field, value] of Object.entries(accounts)) await page.locator(`input[name=${field}]`).fill(value);
  const instagram = page.locator("input[name=instagramUrl]");
  await instagram.fill("https://instagram.com.evil.example/account");
  await instagram.blur();
  await expect(instagram).toHaveAttribute("aria-invalid", "true");
  const invalidState = await new AxeBuilder({ page })
    .include('[data-testid="business-social-fields"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  console.info(JSON.stringify({ scope: "business-social-form-invalid", violations: invalidState.violations.length, incomplete: invalidState.incomplete.length }));
  expect(invalidState.violations, "social URL feedback contrast and semantics").toEqual([]);
  await instagram.fill(accounts.instagramUrl);
  // Server-side validation failure in an unrelated field keeps every social input intact.
  await page.getByLabel("E-Mail", { exact: true }).fill("invalid-email");
  await page.locator("form").filter({ has: page.locator("input[name=name]") }).evaluate((form) => { (form as HTMLFormElement).noValidate = true; });
  await page.getByTestId("save").click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  for (const [field, value] of Object.entries(accounts)) await expect(page.locator(`input[name=${field}]`)).toHaveValue(value);
  await page.getByLabel("E-Mail", { exact: true }).fill("");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("form-notice")).toHaveText("Gespeichert.");
  const id = page.url().split("?")[0].split("/").pop()!;
  expect(await read(id)).toMatchObject(accounts);
  await page.reload();
  for (const [field, value] of Object.entries(accounts)) await expect(page.locator(`input[name=${field}]`)).toHaveValue(value);
  await page.locator("input[name=instagramUrl]").fill("https://www.instagram.com/replaced_account/");
  await page.locator("input[name=facebookUrl]").fill("");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("form-notice")).toBeVisible();
  await expect.poll(async () => ({ name: (await read(id)).name, facebookUrl: (await read(id)).facebookUrl, instagramUrl: (await read(id)).instagramUrl, tiktokUrl: (await read(id)).tiktokUrl, snapchatUrl: (await read(id)).snapchatUrl })).toEqual({ name, facebookUrl: null, instagramUrl: "https://www.instagram.com/replaced_account/", tiktokUrl: accounts.tiktokUrl, snapchatUrl: accounts.snapchatUrl });
  // Persistence can precede the server-action response. Wait until the form finishes saving before editing again.
  await expect(page.getByTestId("save")).toBeEnabled();
  for (const field of Object.keys(accounts)) await page.locator(`input[name=${field}]`).fill("");
  await page.getByTestId("save").click();
  await expect.poll(async () => (await read(id)).instagramUrl).toBeNull();
  await page.reload();
  for (const field of Object.keys(accounts)) {
    expect((await read(id))[field as keyof typeof accounts]).toBeNull();
    await expect(page.locator(`input[name=${field}]`)).toHaveValue("");
  }
});

test("API create accepts zero, one and four links; server rejects malicious URLs and enforces ownership", async ({ page, browser, request }) => {
  test.setTimeout(90_000);
  const actors = await Promise.all([owner, stranger].map((who) => db.user.create({ data: { email: who.email, role: "BUSINESS_OWNER", locale: "de", emailVerified: new Date(), passwordHash: bcrypt.hashSync(who.password, 10) } })));
  await login(page, owner);
  const categoryId = (await db.category.findUniqueOrThrow({ where: { key: "legal" } })).id;
  const ids: string[] = [];
  for (const [n, social] of [{}, { instagramUrl: accounts.instagramUrl }, accounts].entries()) {
    const response = await page.request.post("/api/v1/businesses", { data: { name: `E2E Social API ${stamp}-${n}`, categoryId, ...social } });
    expect(response.status()).toBe(201);
    const saved = (await response.json()).data;
    ids.push(saved.id);
    for (const field of Object.keys(accounts)) expect((await read(saved.id))[field as keyof typeof accounts]).toBe((social as Record<string, string>)[field] ?? null);
  }
  const id = ids[2];
  expect(await db.businessMember.count({ where: { businessId: id, userId: actors[0].id, isActive: true } })).toBe(1);
  expect((await page.request.patch(`/api/v1/businesses/${id}`, { data: { facebookUrl: "https://www.facebook.com/updated.account" } })).status()).toBe(200);
  const before = await read(id);
  for (const value of ["not a url", "http://www.instagram.com/business", "javascript:alert(1)", "data:text/html,bad", "https://instagram.com.evil.example/business", "https://www.instagram.com@evil.example/business", "https://evil.example/business", "https://www.instagram.com/", `https://www.instagram.com/${"a".repeat(2200)}`]) {
    expect((await page.request.patch(`/api/v1/businesses/${id}`, { data: { instagramUrl: value } })).status(), value.slice(0, 100)).toBe(422);
  }
  expect((await read(id)).instagramUrl).toBe(before.instagramUrl);
  // The same signed-in owner loses mutation access immediately when membership is revoked.
  const untouched = await read(id);
  await db.businessMember.updateMany({ where: { businessId: id, userId: actors[0].id }, data: { isActive: false } });
  try {
    expect((await page.request.patch(`/api/v1/businesses/${id}`, { data: { instagramUrl: "https://www.instagram.com/revoked/" } })).status()).toBe(403);
    expect(await read(id)).toEqual(untouched);
  } finally {
    await db.businessMember.updateMany({ where: { businessId: id, userId: actors[0].id }, data: { isActive: true } });
  }
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await login(other, stranger);
  expect((await other.request.patch(`/api/v1/businesses/${id}`, { data: { instagramUrl: "https://www.instagram.com/unauthorized/" } })).status()).toBe(403);
  expect((await request.patch(`/api/v1/businesses/${id}`, { data: { instagramUrl: "https://www.instagram.com/anonymous/" } })).status()).toBe(401);
  expect((await read(id)).instagramUrl).toBe(before.instagramUrl);
  await otherContext.close();
});

test("public saved links have authentic icons, safe exact destinations, correct hierarchy and responsive RTL/LTR geometry", async ({ page, browser }) => {
  test.setTimeout(300_000);
  await login(page);
  const template = await db.business.findUniqueOrThrow({ where: { slug: "kurdistan-rechtsberatung" }, include: { locations: { where: { isPrimary: true }, take: 1 } } });
  const location = template.locations[0];
  const business = await db.business.create({ data: { name: `E2E Social public ${stamp}`, slug: `e2e-social-public-${stamp}`, categoryId: template.categoryId, description: "E2E social test business description.", status: "published", verified: true, ...accounts, locations: { create: { addressLine1: location.addressLine1, cityId: location.cityId, countryCode: location.countryCode, latitude: location.latitude, longitude: location.longitude, coordsVerifiedAt: new Date(), isPrimary: true } } } });
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  try {
    // Genuine test uploads exercise the existing media system; nothing reaches production.
    await page.goto(`/dr/businesses/${business.id}`);
    for (const [field, color] of [["coverUrl", [190, 195, 205]], ["logoUrl", [160, 20, 35]]] as const) {
      const buffer = Buffer.from(encode({ width: 4, height: 3, data: new Uint8Array(Array.from({ length: 12 }, () => [...color, 255]).flat()) }));
      await page.getByTestId(`upload-${field}`).setInputFiles({ name: `${field}.png`, mimeType: "image/png", buffer });
      await page.getByTestId("image-editor").getByRole("button", { name: "Bild bestätigen" }).click();
      await expect(page.getByTestId("image-editor")).toHaveCount(0);
    }
    await page.getByTestId("save").click();
    await expect.poll(async () => Boolean((await read(business.id)).coverUrl && (await read(business.id)).logoUrl)).toBe(true);
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440, 1920]) {
      await publicPage.setViewportSize({ width, height: 900 });
      for (const locale of ["ckb", "ar", "fa", "de", "en", "kmr", "tr", "nl", "fr", "it", "sv"]) {
        expect((await publicPage.goto(`/${locale}/business/${business.slug}`, { waitUntil: "domcontentloaded" }))?.status()).toBe(200);
        const section = publicPage.getByTestId("business-social-links");
        await expect(section).toBeVisible();
        expect(await publicPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${locale} ${width}`).toBeLessThanOrEqual(0);
        expect(await publicPage.locator("html").getAttribute("dir")).toBe(["ckb", "ar", "fa"].includes(locale) ? "rtl" : "ltr");
        for (const [i, href] of Object.values(accounts).entries()) {
          const link = section.getByRole("link").nth(i);
          await expect(link).toHaveAttribute("href", href);
          await expect(link).toHaveAttribute("target", "_blank");
          await expect(link).toHaveAttribute("rel", /noopener/);
          await expect(link).toHaveAttribute("rel", /noreferrer/);
          await expect(link).toHaveAttribute("aria-label", new RegExp(labels[i]));
          await expect(link.locator("svg path")).toHaveCount(1);
          await expect(link).toContainText(labels[i]);
          const box = (await link.boundingBox())!;
          expect(box.height, `${locale} ${width} ${labels[i]}`).toBeGreaterThanOrEqual(44);
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          await link.focus();
          await expect(link).toBeFocused();
        }
        if ([390, 1440].includes(width)) {
          const accessibility = await new AxeBuilder({ page: publicPage })
            .include('[data-testid="business-profile"]')
            .include('[data-testid="business-social-links"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          console.info(JSON.stringify({ scope: "business-profile-and-social", locale, width, violations: accessibility.violations.length, incomplete: accessibility.incomplete.length }));
          expect(accessibility.violations, `profile accessibility ${locale} ${width}`).toEqual([]);
        }
        if (process.env.E2E_ARTIFACT_DIR && [390, 1440].includes(width)) {
          await publicPage.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
          await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true });
          await publicPage.screenshot({ path: `${process.env.E2E_ARTIFACT_DIR}/profile-${locale}-${width}-${test.info().project.name}.png`, fullPage: true });
        }
        expect(await publicPage.evaluate(() => {
          const social = document.querySelector('[data-testid="business-social-links"]')!;
          const about = document.querySelector('section[aria-labelledby="about"]')!;
          return Boolean(social.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING);
        })).toBe(true);
      }
    }
    expect((await page.request.patch(`/api/v1/businesses/${business.id}`, { data: { facebookUrl: "", tiktokUrl: "", snapchatUrl: "" } })).status()).toBe(200);
    await publicPage.reload();
    await expect(publicPage.getByTestId("business-social-links").getByRole("link")).toHaveCount(1);
    await expect(publicPage.getByTestId("business-social-links").getByRole("link")).toHaveAttribute("href", accounts.instagramUrl);
    expect((await page.request.patch(`/api/v1/businesses/${business.id}`, { data: { instagramUrl: "" } })).status()).toBe(200);
    await publicPage.reload();
    await expect(publicPage.getByTestId("business-social-links")).toHaveCount(0);
    const body = await (await publicPage.request.get(`/api/v1/businesses/${business.slug}`)).json();
    for (const field of Object.keys(accounts)) expect(body.data[field]).toBeNull();
  } finally {
    await publicContext.close();
    // This published fixture shares the reference business's coordinates. Keep it out of
    // later directory/map tests, including when an assertion fails, without deleting rows.
    await db.business.update({ where: { id: business.id }, data: { status: "archived", deletedAt: new Date() } });
  }
});
