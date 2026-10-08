// Read-only production browser check: opens the live site in a real Chromium (desktop + mobile), checks the public
// journeys and the approved red/white UI, and saves full-page screenshots. Never signs in, never submits a form,
// never writes data. Usage: BASE_URL=https://www.regaplatform.com node scripts/health/browser-check.mjs
import { chromium, devices } from "@playwright/test";
import { mkdirSync, appendFileSync } from "node:fs";

const BASE = (process.env.BASE_URL || "https://www.regaplatform.com").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "browser-check";
const UA_SUFFIX = " rega-ci-browser-check/1.0 (+github-actions)";
mkdirSync(OUT, { recursive: true });

const failures = [];
const lines = [];
const note = (ok, label, detail = "") => {
  lines.push(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/** Pages every visitor reaches without an account; [path, expected html dir]. */
const PAGES = [
  ["/ckb", "rtl"], ["/de", "ltr"], ["/en", "ltr"], ["/ar", "rtl"],
  ["/de/businesses", "ltr"], ["/ckb/businesses", "rtl"], ["/de/services", "ltr"], ["/de/nearby", "ltr"], ["/ckb/nearby", "rtl"],
  ["/de/search?q=a", "ltr"], ["/de/ai", "ltr"], ["/de/for-business", "ltr"], ["/de/register", "ltr"], ["/de/login", "ltr"],
  ["/de/impressum", "ltr"], ["/de/privacy", "ltr"], ["/de/terms", "ltr"], ["/de/about", "ltr"],
];
const FOREIGN_CITIES = ["Stockholm", "London", "Paris", "Amsterdam", "Wien", "Erbil"];

const browser = await chromium.launch();
try {
  for (const [vp, opts] of [["desktop", { viewport: { width: 1366, height: 900 } }], ["mobile", devices["Pixel 5"]]]) {
    const baseUA = opts.userAgent || "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
    const ctx = await browser.newContext({ ...opts, userAgent: baseUA + UA_SUFFIX });
    const page = await ctx.newPage();
    for (const [path, dir] of PAGES) {
      const label = `${vp} ${path}`;
      try {
        const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const status = res?.status() ?? 0;
        const facts = await page.evaluate(() => ({
          dir: document.documentElement.dir,
          h1: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? "",
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        }));
        note(status >= 200 && status < 400, `${label} HTTP`, String(status));
        note(facts.dir === dir, `${label} dir=${dir}`, facts.dir);
        note(facts.h1.length > 0, `${label} has an h1`, facts.h1);
        note(facts.overflow <= 1, `${label} no horizontal scroll`, `${facts.overflow}px`);
        await page.screenshot({ path: `${OUT}/${vp}${path.replace(/[/?=&]/g, "_")}.png`, fullPage: true });
      } catch (error) {
        note(false, `${label} loads`, String(error).split("\n")[0]);
      }
    }

    // Approved design markers (also prove the current release is the one being served).
    await page.goto(`${BASE}/de`, { waitUntil: "domcontentloaded" });
    note(await page.getByTestId("home-ai-entry").isVisible(), `${vp} home: compact AI entry`);
    note(await page.locator("main form[role=search]").first().isVisible(), `${vp} home: search form`);
    if (vp === "mobile") {
      note(await page.getByTestId("bottom-nav").isVisible(), "mobile: bottom tab bar");
    } else {
      const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
      note(await nav.locator('a[href="/de/nearby"]').isVisible(), "desktop: header links Nearby");
      note(await nav.locator('a[href="/de/ai"]').isVisible(), "desktop: header links the assistant");
    }

    // Germany city discovery: no foreign city in the public business city filter.
    await page.goto(`${BASE}/de/businesses`, { waitUntil: "domcontentloaded" });
    const cities = await page.locator("#f-city option").allTextContents();
    const foreign = cities.filter((c) => FOREIGN_CITIES.some((f) => c.trim().startsWith(f)));
    note(cities.length > 1, `${vp} directory: city options present`, `${cities.length - 1} cities`);
    note(foreign.length === 0, `${vp} directory: Germany-only cities`, foreign.join(", "));

    // A real business profile, reached from the directory (skipped honestly when nothing is published yet).
    // Results stream in after the filters (Suspense): wait for them instead of reading the first HTML chunk.
    const first = page.locator('main a[href*="/business/"]').first();
    await first.waitFor({ timeout: 15_000 }).catch(() => {});
    if (await first.count()) {
      const href = await first.getAttribute("href");
      const res = await page.goto(BASE + href, { waitUntil: "domcontentloaded" });
      note((res?.status() ?? 0) === 200, `${vp} profile ${href}`, String(res?.status()));
      await page.screenshot({ path: `${OUT}/${vp}_profile.png`, fullPage: true });
    } else {
      const count = (await page.locator("main [aria-live=polite]").first().textContent().catch(() => ""))?.trim();
      lines.push(`info ${vp} directory has no published business to open (result line: "${count}")`);
    }

    // The dashboard is never public.
    const dr = await page.goto(`${BASE}/dr`, { waitUntil: "domcontentloaded" });
    note(!new URL(page.url()).pathname.startsWith("/dr") || (dr?.status() ?? 0) >= 400, `${vp} /dr requires sign-in`, page.url());
    await ctx.close();
  }
} finally {
  await browser.close();
}

const report = lines.join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Production browser check (${BASE})\n\n\`\`\`\n${report}\n\`\`\`\n`);
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
