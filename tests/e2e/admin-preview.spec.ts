/** Preview-only (never merged): screenshots of the admin panel at several widths and languages. */
import type { Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

test.skip(!process.env.ADMIN_PREVIEW, "preview only");
test.setTimeout(600_000);
const OUT = "preview-shots";
mkdirSync(OUT, { recursive: true });

async function login(page: Page) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
}

const PLAN: [string, number, string[]][] = [
  ["ckb", 390, ["overview", "list", "menu", "dialog", "nav", "edit"]],
  ["ckb", 1440, ["overview", "list", "menu", "dialog", "edit", "services"]],
  ["ckb", 768, ["list"]],
  ["ckb", 360, ["list"]],
  ["de", 1280, ["list", "overview"]],
  ["de", 430, ["list"]],
  ["en", 1024, ["list"]],
];

test("admin screenshots", async ({ page, context }) => {
  await login(page);
  // Diagnostic: elements wider than a phone screen (German, 393 px) on the main admin pages.
  await context.addCookies([{ name: "REGA_LOCALE", value: "de", url: String(test.info().project.use.baseURL) }]);
  await page.setViewportSize({ width: 393, height: 851 });
  const report: string[] = [];
  for (const path of ["/dr", "/dr/businesses", "/dr/businesses/new"]) {
    await page.goto(path);
    const wide = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1); })
        .slice(0, 12).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} [${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}] "${(el.textContent || "").trim().slice(0, 40)}"`);
    });
    report.push(`${path} scroll=${await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)}`, ...wide);
  }
  writeFileSync(`${OUT}/overflow.txt`, report.join(String.fromCharCode(10)));
  const firstId = await page.evaluate(async () => (await (await fetch("/api/v1/businesses?perPage=1&status=published")).json()).data[0].id);
  for (const [locale, width, shots] of PLAN) {
    await context.addCookies([{ name: "REGA_LOCALE", value: locale, url: String(test.info().project.use.baseURL) }]);
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    const snap = async (name: string, full = true) => page.screenshot({ path: `${OUT}/${locale}-${width}-${name}.png`, fullPage: full });
    for (const shot of shots) {
      if (shot === "overview") { await page.goto("/dr"); await snap(shot); }
      if (shot === "list") { await page.goto("/dr/businesses"); await snap(shot); }
      if (shot === "services") { await page.goto("/dr/services"); await snap(shot, false); }
      if (shot === "menu") { await page.goto("/dr/businesses"); await page.getByTestId("row-actions").nth(1).click(); await snap(shot, false); }
      if (shot === "dialog") { await page.goto("/dr/businesses"); await page.getByTestId("row-actions").nth(1).click(); await page.locator("tbody tr").nth(1).getByTestId("delete-business").click(); await page.waitForTimeout(300); await snap(shot, false); }
      if (shot === "nav") { await page.goto("/dr/businesses"); await page.getByTestId("dr-menu-toggle").click(); await snap(shot, false); }
      if (shot === "edit") { await page.goto(`/dr/businesses/${firstId}`); await snap(shot, false); }
    }
  }
});
