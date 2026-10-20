// TEMPORARY diagnostic (removed before merge): why do signed-in pages not reach network idle for the admin account?
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

async function trace(page: Page, who: { email: string; password: string }, label: string) {
  const log: string[] = [];
  const t0 = Date.now();
  const path = (u: string) => u.replace(/^http:\/\/localhost:\d+/, "");
  page.on("request", (r) => { if (!r.url().includes("/_next/static")) log.push(`${Date.now() - t0} > ${r.method()} ${path(r.url())}`); });
  page.on("requestfinished", async (r) => { if (!r.url().includes("/_next/static")) log.push(`${Date.now() - t0} < ${(await r.response())?.status()} ${path(r.url())}`); });
  page.on("requestfailed", (r) => log.push(`${Date.now() - t0} x ${r.failure()?.errorText} ${path(r.url())}`));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(`console.${m.type()}: ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => log.push(`pageerror ${e.message.slice(0, 160)}`));
  await page.goto("/de/login?next=%2Fde%2Faccount");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  log.push(`${Date.now() - t0} -- submit`);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/de\/account$/);
  log.push(`${Date.now() - t0} -- on account`);
  await page.waitForTimeout(3000);
  log.push(`${Date.now() - t0} -- goto businesses`);
  await page.goto("/de/businesses", { waitUntil: "commit" });
  await page.waitForTimeout(6000);
  log.push(`${Date.now() - t0} -- end`);
  expect(`${label}\n${log.join("\n")}`).toBe("");
}

test("debug admin", async ({ page }) => { await trace(page, ADMIN, "ADMIN"); });
test("debug employee", async ({ page }) => { await trace(page, EMPLOYEE, "EMPLOYEE"); });
