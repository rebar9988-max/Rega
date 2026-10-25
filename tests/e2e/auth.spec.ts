import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

async function login(page: Page, who: { email: string; password: string }, next = "/admin") {
  await page.goto(`/de/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

test("anonymous visitors get the dashboard sign-in at /dr and login for /account", async ({ page }) => {
  await page.goto("/admin");
  // /dr signs administrators in with an e-mail code; the password sign-in stays one link away.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "چوونەژوورەوەی بەڕێوەبەر" })).toBeVisible();
  await expect(page.getByRole("link", { name: "چوونەژوورەوە بە وشەی نهێنی" })).toHaveAttribute("href", /\/login\?next=%2Fadmin/);
  // Nothing of the dashboard is rendered for an anonymous visitor.
  await expect(page.locator("aside, nav[aria-label]")).toHaveCount(0);
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
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Unternehmen" }).click();
  // Pin / unpin lives in the row's action menu (the existing "featured" flag).
  const row = page.getByRole("row", { name: /Sulaymaniyah Clinic/ });
  await row.getByTestId("row-actions").click();
  await row.getByRole("button", { name: "Lösen", exact: true }).click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "unpinned");
  const again = page.getByRole("row", { name: /Sulaymaniyah Clinic/ });
  await again.getByTestId("row-actions").click();
  await expect(again.getByRole("button", { name: "Anheften", exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Audit-Protokolle" }).click();
  await expect(page.getByRole("cell", { name: "business.unfeature" }).first()).toBeVisible();

  await page.goto("/de/account");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/de$/);
  await page.goto("/admin");
  // Signed out: /dr shows its own sign-in, never the dashboard.
  await expect(page.getByRole("heading", { name: "چوونەژوورەوەی بەڕێوەبەر" })).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
});

test("employee: sees the dashboard but only actions their role allows", async ({ page }) => {
  await login(page, EMPLOYEE);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Audit-Protokolle" })).toHaveCount(0);
  await page.goto("/admin/businesses");
  // Not even inside the action menus: the controls are not rendered for this role.
  for (const control of ["pin-business", "unpin-business", "delete-business"]) await expect(page.getByTestId(control)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Prüfen & veröffentlichen" })).toHaveCount(0);
});

test("employee is rejected by the server for privileged API calls", async ({ page }) => {
  await login(page, EMPLOYEE);
  // Wait for sign-in to finish: navigating away early races the session cookie and yields 401 instead of 403.
  await expect(page).toHaveURL(/\/admin$/);
  const res = await page.request.post("/api/v1/categories", { data: { key: "x", slug: "x", nameCkb: "x", nameDe: "x" } });
  expect(res.status()).toBe(403);
});
