// TEMPORARY diagnostic (removed before merge): does GET /api/auth/session answer from the browser?
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { EMPLOYEE } from "./global-setup";

async function probe(page: Page, label: string, init: string) {
  return page.evaluate(async ([l, i]) => {
    const t = performance.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch("/api/auth/session", { ...(JSON.parse(i) as RequestInit), signal: ctl.signal });
      const body = (await res.text()).slice(0, 60);
      return `${l}: ${res.status} in ${Math.round(performance.now() - t)}ms ct=${res.headers.get("content-type")} body=${body}`;
    } catch (e) {
      return `${l}: ERROR ${String(e).slice(0, 80)} after ${Math.round(performance.now() - t)}ms`;
    } finally { clearTimeout(timer); }
  }, [label, init] as const);
}

test("debug session endpoint", async ({ page, browser }) => {
  const log: string[] = [];
  await page.goto("/de/login?next=%2Fde%2Faccount");
  await page.getByLabel("E-Mail", { exact: true }).fill(EMPLOYEE.email);
  await page.getByLabel("Passwort", { exact: true }).fill(EMPLOYEE.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/de\/account$/);
  await page.waitForTimeout(10_000); // let the page's own ping finish or be stuck
  log.push(await probe(page, "A default", "{}"));
  log.push(await probe(page, "B no-store+json", JSON.stringify({ credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } })));
  log.push(await probe(page, "C credentials only", JSON.stringify({ credentials: "same-origin" })));
  const t = Date.now();
  const r = await page.request.get("/api/auth/session", { timeout: 8000 }).catch((e) => ({ status: () => `ERR ${String(e).slice(0, 60)}` }));
  log.push(`D page.request: ${r.status()} in ${Date.now() - t}ms`);
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${test.info().project.use.baseURL}/de/login`);
  log.push(await probe(anon, "E anonymous", "{}"));
  expect(log.join("\n")).toBe("");
});
