/**
 * Digital Operations Center (/dr/operations): owner-only access, real runs of the ten read-only agents against the
 * disposable test database, idempotent/cool-down protection, and proof that no business data changes.
 * HTTP-based agents probe this local test server (OPS_PROBE_ORIGIN), never the live site.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";
import { testDatabaseClient } from "./database-client";

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
}

async function businessSnapshot() {
  const prisma = testDatabaseClient();
  try {
    const rows = await prisma.business.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, verified: true, featured: true, updatedAt: true, deletedAt: true, archivedAt: true } });
    const flag = await prisma.featureFlag.findUnique({ where: { key: "public.aiSearch" }, select: { enabled: true, rollout: true } });
    return JSON.stringify({ rows, flag, categories: await prisma.category.count(), cities: await prisma.city.count() });
  } finally {
    await prisma.$disconnect();
  }
}

test.describe.configure({ mode: "serial" });

test("anonymous visitors get the sign-in form, never the Operations Center", async ({ request }) => {
  const res = await request.get("/dr/operations", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain("data-dr-sign-in");
  expect(html).not.toContain("ops-agents");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
});

test("staff below the owner (EMPLOYEE) can neither see nor open it", async ({ page }) => {
  await login(page, EMPLOYEE);
  await expect(page.locator('a[href="/dr/operations"]')).toHaveCount(0);
  await page.goto("/dr/operations");
  await expect(page.getByTestId("ops-agents")).toHaveCount(0);
});

test("owner: ten agents, a real run, idempotent cool-down, run-all, no data changed", async ({ page }) => {
  test.setTimeout(180_000);
  const before = await businessSnapshot();
  await login(page, ADMIN);
  await page.locator('a[href="/dr/operations"]').first().click();
  await expect(page).toHaveURL(/\/dr\/operations$/);
  const cards = page.getByTestId("ops-agents").locator("[data-agent]");
  await expect(cards).toHaveCount(10);
  await expect(page.getByTestId("ops-policy")).toBeVisible();

  // One agent: the report appears with a status, a Sorani summary and a history row.
  const translation = page.locator('[data-agent="translation-inspector"]');
  await translation.getByTestId("ops-run-translation-inspector").click();
  await expect(page).toHaveURL(/agent=translation-inspector/);
  await expect(translation.getByTestId("ops-status")).not.toHaveAttribute("data-status", "draft");
  await expect(translation.getByTestId("ops-summary")).toHaveAttribute("lang", "ckb");
  await expect(page.getByTestId("ops-history").locator("tbody tr")).toHaveCount(1);

  // Clicking again at once: refused by the cool-down, explained, nothing stored.
  await translation.getByTestId("ops-run-translation-inspector").click();
  await expect(page).toHaveURL(/blocked=cooldown/);
  await expect(page.getByTestId("ops-notice")).toContainText("تازە کاری کردووە");
  await expect(page.getByTestId("ops-history").locator("tbody tr")).toHaveCount(1);

  // Run all: every agent finishes with a real status (the translation agent is still cooling down).
  await page.getByTestId("ops-run-all").click();
  await expect(page).toHaveURL(/ran=\d+/, { timeout: 150_000 });
  await expect(page.getByTestId("ops-notice")).toBeVisible();
  const statuses = await cards.getByTestId("ops-status").evaluateAll((els) => els.map((e) => e.getAttribute("data-status")));
  expect(statuses.filter((s) => s !== "draft").length, `statuses: ${statuses.join(",")}`).toBeGreaterThanOrEqual(8);
  const history = await page.getByTestId("ops-history").locator("tbody tr").count();
  expect(history).toBeGreaterThanOrEqual(10);

  // The business agent lists the queue but decides nothing.
  const business = page.locator('[data-agent="business-inspector"]');
  await business.locator("summary").click();
  await expect(business.locator("details")).toHaveAttribute("open", "");

  // Strictly read-only: businesses, categories, cities and the AI flag are exactly as before.
  expect(await businessSnapshot()).toBe(before);

  // Reports are part of the audit trail.
  const prisma = testDatabaseClient();
  try {
    const rows = await prisma.auditLog.findMany({ where: { action: "ops.report" }, select: { entity: true, actorEmail: true, after: true } });
    expect(rows.length).toBe(history);
    for (const r of rows) {
      expect(r.actorEmail).toBe(ADMIN.email);
      expect(r.entity).toMatch(/^ops:[a-z-]+$/);
      const report = r.after as { status: string; cost_status: string; execution_id: string };
      expect(["PASS", "WARN", "FAIL", "SKIPPED"]).toContain(report.status);
      expect(report.cost_status).toBe("WITHIN_BOUNDED_FREE_CAPS");
    }
    // No execution lock is left behind.
    expect(await prisma.setting.count({ where: { key: { startsWith: "ops.lock." } } })).toBe(0);
  } finally {
    await prisma.$disconnect();
  }
});
