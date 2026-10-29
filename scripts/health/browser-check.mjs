// Read-only production browser check: opens the live site in a real Chromium (desktop + mobile), checks the public
// journeys and the approved red/white UI, and saves full-page screenshots. Never signs in, never submits a form,
// never writes data. Usage: BASE_URL=https://www.rega24.com node scripts/health/browser-check.mjs
import { chromium, devices } from "@playwright/test";
import { mkdirSync, appendFileSync, readFileSync } from "node:fs";

const BASE = (process.env.BASE_URL || "https://www.rega24.com").replace(/\/$/, "");
const OUT = process.env.OUT_DIR || "browser-check";
const UA_SUFFIX = " rega-ci-browser-check/1.0 (+github-actions)";
// Read the checked-out release's canonical token, rather than maintaining another primary constant.
const expectedBrand = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8")
  .match(/--brand:\s*(#[\da-f]{6})/i)?.[1].toLowerCase();
if (!expectedBrand) throw new Error("Canonical brand token missing from the verified release");
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


/** Opens the location panel (retrying until the page has hydrated). Returns the dialog locator. */
async function openPicker(page) {
  const dialog = page.getByRole("dialog", { name: /.+/ }).filter({ has: page.getByRole("listbox") });
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator("#f-city-search").click();
    if (await dialog.first().isVisible({ timeout: 3000 }).catch(() => false)) return dialog.first();
  }
  return null;
}

/**
 * Location filter (read-only): the geo API, the searchable selector, the saved place shared by the home page and the
 * list, nearest-city detection with a granted position, the phone bottom sheet and Kurdish RTL. Nothing is submitted
 * and nothing is stored outside this throw-away browser context.
 */
async function checkLocationFilter(browser, ctx, page, vp, opts) {
  const tag = `${vp} location`;
  const out = [];
  const rec = (ok, label, detail = "") => {
    note(ok, `${tag}: ${label}`, detail);
    out.push(`${ok ? "ok" : "FAIL"} ${tag}: ${label}${detail ? ` (${detail})` : ""}`);
  };
  try {
    // API
    const list = await ctx.request.get(`${BASE}/api/v1/geo?country=DE`);
    const body = list.ok() ? (await list.json()).data : null;
    rec(list.status() === 200 && Boolean(body), "API /api/v1/geo?country=DE", String(list.status()));
    if (body) {
      rec(body.countries.some((c) => c.code === "DE"), "API lists Germany");
      rec(body.cities.length > 0 && body.cities.length <= 40, "API city list is bounded", `${body.cities.length} cities, ${body.regions.length} regions`);
      rec(body.cities.every((c) => c.countryCode === "DE"), "API cities are German");
    }
    const bad = await ctx.request.get(`${BASE}/api/v1/geo?country=Germany`);
    rec(bad.status() === 422, "API rejects an invalid country", String(bad.status()));
    const near = await ctx.request.get(`${BASE}/api/v1/geo?lat=52.52&lng=13.405`);
    const nearest = near.ok() ? (await near.json()).data?.nearest : null;
    rec(near.ok() && nearest?.city?.nameEn === "Berlin", "API nearest city to central Berlin", nearest ? `${nearest.city.nameEn}, ${nearest.km} km` : String(near.status()));
    rec((near.headers()["cache-control"] || "").includes("no-store"), "API nearest answer is not cached");

    // Selector on the business list
    await page.goto(`${BASE}/de/businesses`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    // Diagnosis: which elements stick out of the viewport on the list page (reported, never changed here).
    const sticking = (label) => page.evaluate(({ label, width }) => {
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).position === "fixed") continue;
        if (r.right > width + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).split(/\s+/).slice(0, 3).join(".")} L${Math.round(r.left)} R${Math.round(r.right)}`);
      }
      const d = document.documentElement;
      return `${label}: scrollWidth ${d.scrollWidth}, clientWidth ${d.clientWidth}, innerWidth ${innerWidth}, viewport ${Math.round(visualViewport?.width ?? 0)}; sticking out: ${out.length ? out.slice(0, 8).join(" | ") : "none"}`;
    }, { label, width: page.viewportSize().width });
    out.push(`info ${tag}: ${await sticking("before opening")}`);
    const dialog = await openPicker(page);
    rec(Boolean(dialog), "selector opens");
    if (dialog) {
      out.push(`info ${tag}: ${await sticking("sheet open")}`);
      const box = await dialog.boundingBox();
      const view = page.viewportSize();
      // Measured against the layout viewport the browser actually uses: when another part of the page is wider than the
      // screen (reported by the "sticking out" lines above) a fixed sheet is as wide as that layout viewport.
      const layout = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
      if (vp === "mobile") rec(Boolean(box && Math.round(box.y + box.height) === layout.h && Math.round(box.width) === layout.w && box.x >= 0), "phone bottom sheet is flush with the bottom and spans the layout viewport", box ? `${Math.round(box.width)}x${Math.round(box.height)} in ${layout.w}x${layout.h}` : "");
      else rec(Boolean(box && view && box.x >= 0 && box.x + box.width <= view.width), "desktop panel stays inside the window");
      await dialog.locator("input").first().fill("ber");
      const berlin = dialog.getByRole("listbox").getByRole("option", { name: /^Berlin/ }).first();
      await berlin.waitFor({ timeout: 10_000 }).catch(() => {});
      rec(await berlin.isVisible(), "search finds Berlin");
      if (await berlin.isVisible()) await berlin.click();
      await page.locator("#f-city-search").filter({ hasText: "Berlin" }).waitFor({ timeout: 5000 }).catch(() => {});
      rec((await page.locator("#f-city-search").textContent())?.includes("Berlin") === true, "chosen city shown in the field");
      rec((await page.locator("#f-city").inputValue()) !== "", "form value carries the city id");
      const stored = await page.evaluate(() => localStorage.getItem("rega-location"));
      let keys = "";
      try { keys = Object.keys(JSON.parse(stored)).sort().join(","); } catch { /* not stored */ }
      rec(keys === "cityId,countryCode,regionId,savedAt,v", "saved place holds ids only", keys || "nothing stored");
      // Shared state: the home page and the list pick it up without choosing again.
      await page.goto(`${BASE}/de`, { waitUntil: "domcontentloaded" });
      await page.locator("#f-city-search").filter({ hasText: "Berlin" }).waitFor({ timeout: 8000 }).catch(() => {});
      rec((await page.locator("#f-city-search").textContent())?.includes("Berlin") === true, "home page shows the saved city");
      await page.goto(`${BASE}/de/businesses`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/[?&]city=/, { timeout: 8000 }).catch(() => {});
      rec(/[?&]city=[^&]/.test(page.url()), "business list applies the saved city", page.url().replace(BASE, ""));
      // Reset to all cities clears the saved place.
      await page.goto(`${BASE}/de/businesses?city=`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => localStorage.getItem("rega-location") === null, null, { timeout: 8000 }).catch(() => {});
      rec((await page.evaluate(() => localStorage.getItem("rega-location"))) === null, "all cities clears the saved place");
    }

    // Nearest-city detection with a granted position (a fresh context so nothing is saved yet)
    const geoCtx = await browser.newContext({ ...opts, userAgent: (opts.userAgent || "Mozilla/5.0 (X11; Linux x86_64) Chrome/125.0 Safari/537.36") + UA_SUFFIX, geolocation: { latitude: 52.5201, longitude: 13.4049 }, permissions: ["geolocation"] });
    const gp = await geoCtx.newPage();
    await gp.goto(`${BASE}/de/businesses`, { waitUntil: "domcontentloaded" });
    await gp.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const gd = await openPicker(gp);
    if (gd) {
      await gd.getByRole("button", { name: /Standort/ }).click();
      await gp.locator("#f-city-search").filter({ hasText: "Berlin" }).waitFor({ timeout: 10_000 }).catch(() => {});
      rec((await gp.locator("#f-city-search").textContent())?.includes("Berlin") === true, "use my location selects the nearest city");
    } else rec(false, "selector opens for location detection");
    await geoCtx.close();

    // Kurdish, right to left
    await page.goto(`${BASE}/ckb/businesses`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const kd = await openPicker(page);
    rec(Boolean(kd), "Kurdish selector opens");
    if (kd) {
      const kb = await kd.boundingBox();
      const view = page.viewportSize();
      rec(Boolean(kb && view && kb.x >= 0 && kb.x + kb.width <= view.width + 1), "Kurdish panel stays inside the window");
      rec((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, "Kurdish page has no horizontal scroll with the panel open");
      await page.keyboard.press("Escape");
    }

    // Privacy text names the storage key
    await page.goto(`${BASE}/de/privacy`, { waitUntil: "domcontentloaded" });
    rec((await page.locator("main").innerText()).includes("rega-location"), "privacy page names the rega-location storage key");
  } catch (error) {
    rec(false, "location checks ran to the end", String(error).split("\n")[0]);
  }
  // One notice per viewport so the results can be read from the run's annotations.
  console.log(`::notice title=${tag}::${out.join("%0A")}`);
}

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
          brand: getComputedStyle(document.documentElement).getPropertyValue("--brand").trim().toLowerCase(),
          scopedBrands: Array.from(document.querySelectorAll(".figma"), (el) =>
            getComputedStyle(el).getPropertyValue("--brand").trim().toLowerCase()),
        }));
        note(status >= 200 && status < 400, `${label} HTTP`, String(status));
        note(facts.dir === dir, `${label} dir=${dir}`, facts.dir);
        note(facts.h1.length > 0, `${label} has an h1`, facts.h1);
        note(facts.overflow <= 1, `${label} no horizontal scroll`, `${facts.overflow}px`);
        note(facts.brand === expectedBrand && facts.scopedBrands.every((color) => color === expectedBrand),
          `${label} official primary red`, facts.brand);
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

    await checkLocationFilter(browser, ctx, page, vp, opts);

    // The dashboard is never public.
    const dr = await page.goto(`${BASE}/dr`, { waitUntil: "domcontentloaded" });
    // Either it sends the visitor away, or /dr shows only its own sign-in form (e-mail code), never the dashboard.
    const drSignIn = (await page.locator("[data-dr-sign-in]").count()) === 1 && (await page.locator("aside").count()) === 0;
    note(!new URL(page.url()).pathname.startsWith("/dr") || (dr?.status() ?? 0) >= 400 || drSignIn, `${vp} /dr requires sign-in`, page.url());
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
