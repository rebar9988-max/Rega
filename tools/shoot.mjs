// Captures source-design and production screenshots for side-by-side review.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.env.OUT || "shots/run";
const PROD = process.env.PROD_URL || "https://www.rega24.com";
const SOURCE = "http://localhost:4173";

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

const SOURCE_SCREENS = ["home", "directory", "detail", "map", "travel", "saved", "auth", "account", "owner", "admin"];
// Source screen -> production route (public routes only; account/owner/admin need a real sign-in).
const PROD_ROUTES = { home: "", directory: "/businesses", search: "/search", map: "/nearby", travel: "/travel", saved: "/saved", auth: "/login", register: "/register", business: "/for-business" };

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, file) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(400);
  await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 72 });
  console.log("saved", file);
}

const browser = await chromium.launch();
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const dir = `${OUT}/${vpName}`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ ...vp, reducedMotion: "reduce" });
  const page = await ctx.newPage();

  // Source design (in-memory screens).
  for (const lang of ["en", "ku"]) {
    await page.goto(SOURCE, { waitUntil: "networkidle" });
    await page.evaluate((l) => window.__rega.setLanguage(l), lang);
    for (const s of SOURCE_SCREENS) {
      try {
        await page.evaluate((id) => window.__rega.setScreen(id), s);
        await pause(1200);
        await shot(page, `${dir}/source-${lang}-${s}.jpg`);
      } catch (e) { console.log("source failed", lang, s, e.message); }
    }
  }

  // Production.
  for (const loc of ["en", "ckb"]) {
    for (const [name, route] of Object.entries(PROD_ROUTES)) {
      try {
        await page.goto(`${PROD}/${loc}${route}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
        await pause(1500);
        await shot(page, `${dir}/prod-${loc}-${name}.jpg`);
      } catch (e) { console.log("prod failed", loc, name, e.message); }
    }
  }
  await ctx.close();
}
await browser.close();
