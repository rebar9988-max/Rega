import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

async function login(page: Page, who: { email: string; password: string }, next = "/dr") {
  await page.goto(`/de/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

test("anonymous visitors are sent to login from /dr and /account", async ({ page }) => {
  await page.goto("/dr");
  await expect(page).toHaveURL(/\/login\?next=%2Fdr/);
  await page.goto("/de/account");
  await expect(page).toHaveURL(/\/de\/login/);
});

test("dashboard API-level protection: mutating endpoints reject anonymous callers", async ({ request }) => {
  const res = await request.post("/api/v1/businesses", { data: { name: "Nope" } });
  expect(res.status()).toBe(401);
});

test("wrong password shows an error and stays on login", async ({ page }) => {
  await login(page, { email: ADMIN.email, password: "definitely-wrong-1" });
  await expect(page.locator("p[role=alert]")).toContainText("falsch");
  await expect(page).toHaveURL(/\/login/);
});

test("login ignores open-redirect targets", async ({ page }) => {
  await login(page, ADMIN, "//evil.example");
  await expect(page).toHaveURL(/localhost:\d+\/de\/account$/);
});

test("admin: full dashboard access, actions are audited, logout works", async ({ page }) => {
  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/dr$/);
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Unternehmen" }).click();
  const row = page.getByRole("row", { name: /Sulaymaniyah Clinic/ });
  await row.getByRole("button", { name: "Hervorhebung entfernen" }).click();
  await expect(page.getByRole("row", { name: /Sulaymaniyah Clinic/ }).getByRole("button", { name: "Hervorheben" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Audit-Protokolle" }).click();
  await expect(page.getByRole("cell", { name: "business.unfeature" }).first()).toBeVisible();

  await page.goto("/de/account");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/de$/);
  await page.goto("/dr");
  await expect(page).toHaveURL(/\/login/);
});

test("employee: sees the dashboard but only actions their role allows", async ({ page }) => {
  await login(page, EMPLOYEE);
  await expect(page).toHaveURL(/\/dr$/);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Audit-Protokolle" })).toHaveCount(0);
  await page.goto("/dr/businesses");
  await expect(page.getByRole("button", { name: "Veröffentlichen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hervorheben" })).toHaveCount(0);
});

test("employee is rejected by the server for privileged API calls", async ({ page }) => {
  await login(page, EMPLOYEE);
  // Wait for sign-in to finish: navigating away early races the session cookie and yields 401 instead of 403.
  await expect(page).toHaveURL(/\/dr$/);
  const res = await page.request.post("/api/v1/categories", { data: { key: "x", slug: "x", nameCkb: "x", nameDe: "x" } });
  expect(res.status()).toBe(403);
});
