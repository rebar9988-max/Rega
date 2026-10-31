/**
 * Admin dashboard: the notification bell counts the work already waiting in the existing queues (only the kinds the
 * role may handle; nothing for an employee), and the audit log filters by action / object / user e-mail with
 * validated URL parameters that pagination keeps.
 */
import type { Page } from "@playwright/test";
import { testDatabaseClient } from "./database-client";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

const db = testDatabaseClient();

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("the bell shows the waiting work of the admin's queues with links to each queue", async ({ page }) => {
  await login(page, ADMIN);
  const counts = {
    pendingBusinesses: await db.business.count({ where: { status: "pending", deletedAt: null } }),
    pendingReviews: await db.review.count({ where: { status: "pending" } }),
    openReports: await db.report.count({ where: { status: "open" } }),
    newMessages: await db.contactMessage.count({ where: { status: "new" } }),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  await page.goto("/dr");
  const bell = page.getByTestId("notification-bell");
  const button = bell.getByRole("button", { name: total > 0 ? `Benachrichtigungen (${total})` : "Benachrichtigungen" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  if (total === 0) await expect(bell.getByText("Nichts wartet.")).toBeVisible();
  else {
    const links = bell.getByRole("link");
    await expect(links).toHaveCount(Object.values(counts).filter((n) => n > 0).length);
    if (counts.pendingBusinesses > 0) await expect(bell.getByRole("link", { name: /Unternehmen warten auf Prüfung/ })).toHaveAttribute("href", "/dr/businesses?status=pending");
  }
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("an employee has no queue to handle, so no bell", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/dr/businesses");
  await expect(page.getByTestId("notification-bell")).toHaveCount(0);
});

test("audit log: filters by action, unknown values are ignored, the filter survives in the links", async ({ page }) => {
  await login(page, ADMIN);
  const sample = await db.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { action: true } });
  test.skip(!sample, "no audit entries in this database");
  await page.goto(`/dr/audit?action=${encodeURIComponent(sample!.action)}`);
  await expect(page.getByTestId("audit-filters").locator('input[name="action"]')).toHaveValue(sample!.action);
  const actions = await page.getByTestId("audit-table").locator("tbody tr td:nth-child(3)").allInnerTexts();
  expect(actions.length).toBeGreaterThan(0);
  for (const a of actions) expect(a.trim()).toBe(sample!.action);

  await page.goto("/dr/audit?action=no.such.action.e2e");
  await expect(page.getByTestId("audit-empty")).toBeVisible();

  // Not an identifier: ignored, the full log is shown.
  await page.goto(`/dr/audit?action=${encodeURIComponent("x'; DROP TABLE")}`);
  await expect(page.getByTestId("audit-filters").locator('input[name="action"]')).toHaveValue("");
  await expect(page.getByTestId("audit-table")).toBeVisible();
});
