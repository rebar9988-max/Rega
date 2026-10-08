import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const DIR: Record<string, "rtl" | "ltr"> = { ckb: "rtl", kmr: "ltr", de: "ltr", en: "ltr", ar: "rtl", fa: "rtl", tr: "ltr" };
const LANG: Record<string, string> = { ckb: "ckb-IQ", kmr: "kmr", de: "de-DE", en: "en", ar: "ar", fa: "fa-IR", tr: "tr-TR" };
const NATIVE: Record<string, string> = { ckb: "کوردیی ناوەندی", kmr: "Kurmancî", de: "Deutsch", en: "English", ar: "العربية", fa: "فارسی", tr: "Türkçe" };
const MATRIX: [string, string][] = [
  ["ckb", "kmr"], ["ckb", "de"], ["ckb", "en"], ["ckb", "ar"], ["ckb", "fa"], ["ckb", "tr"],
  ["fa", "ckb"], ["fa", "de"], ["fa", "en"], ["fa", "ar"], ["fa", "tr"],
  ["de", "ckb"], ["en", "ckb"], ["ar", "ckb"], ["tr", "ckb"],
];

const trigger = (page: Page) => page.locator("header details > summary");
const menu = (page: Page) => page.locator("header details > ul");
const box = async (page: Page, sel: ReturnType<typeof trigger>) => {
  const b = await sel.boundingBox();
  if (!b) throw new Error("not visible");
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
};

test("Persian is a complete locale: rtl, lang, translated UI, no raw keys", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const res = await page.goto("/fa");
  expect(res?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa-IR");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("دنبال چه هستید؟");
  await expect(page.locator("body")).not.toContainText(/\b(nav|home|common|footer)\.[a-zA-Z]+\b/);
  for (const p of ["/fa/businesses", "/fa/services", "/fa/locations", "/fa/search", "/fa/ai", "/fa/about", "/fa/login"]) {
    expect((await page.goto(p))?.status(), p).toBe(200);
  }
  const html = await (await page.request.get("/fa/businesses")).text();
  expect(html).toContain('rel="canonical" href="https://www.regaplatform.com/fa/businesses"');
  expect(html).toMatch(/hrefLang="fa-IR" href="https:\/\/www\.regaplatform\.com\/fa\/businesses"/i);
  expect(errors, errors.join("\n")).toEqual([]);
});

for (const [from, to] of MATRIX) {
  test(`switch ${from} → ${to}: URL, dir, content, stable anchor`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(`/${from}/businesses`);
    await expect(page.locator("html")).toHaveAttribute("dir", DIR[from]);
    const before = await box(page, trigger(page));
    await trigger(page).click();
    await expect(menu(page)).toBeVisible();
    const menuBefore = await menu(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(menuBefore!.x).toBeGreaterThanOrEqual(0);
    expect(menuBefore!.x + menuBefore!.width).toBeLessThanOrEqual(viewport.width);
    // the menu hangs from the trigger's physical right edge in every language
    expect(Math.abs(menuBefore!.x + menuBefore!.width - (before.x + before.w))).toBeLessThanOrEqual(1);
    // all seven languages, same order, one checkmark on the current one
    await expect(menu(page).locator("li")).toHaveCount(7);
    await expect(menu(page).locator('a[aria-current="true"]')).toHaveCount(1);
    await expect(menu(page).locator('a[aria-current="true"]')).toContainText(NATIVE[from]);

    await menu(page).getByRole("link", { name: new RegExp(NATIVE[to]) }).click();
    await expect(page).toHaveURL(new RegExp(`/${to}/businesses$`));
    await expect(page.locator("html")).toHaveAttribute("lang", LANG[to]);
    await expect(page.locator("html")).toHaveAttribute("dir", DIR[to]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const after = await box(page, trigger(page));
    expect(after, `trigger moved ${from}→${to}`).toEqual(before);
    await trigger(page).click();
    const menuAfter = await menu(page).boundingBox();
    expect(Math.abs(menuAfter!.x - menuBefore!.x), "menu x").toBeLessThanOrEqual(1);
    expect(Math.abs(menuAfter!.y - menuBefore!.y), "menu y").toBeLessThanOrEqual(1);
    expect(Math.abs(menuAfter!.width - menuBefore!.width)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
    void info;
  });
}

test("keyboard: Enter opens, Escape closes and returns focus, selection is announced", async ({ page }) => {
  await page.goto("/de");
  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  await expect(trigger(page)).toHaveAttribute("aria-label", /Sprache: Deutsch/);
  await trigger(page).click();
  await page.mouse.click(5, 300);
  await expect(menu(page)).toBeHidden();
});

test("visual QA: trigger and menu geometry identical in ckb, fa, de, ar (screenshots attached)", async ({ page }, info) => {
  const geo: Record<string, unknown> = {};
  for (const l of ["ckb", "fa", "de", "ar"]) {
    await page.goto(`/${l}`);
    await trigger(page).click();
    await expect(menu(page)).toBeVisible();
    geo[l] = { trigger: await box(page, trigger(page)), menu: await menu(page).boundingBox() };
    await page.screenshot({ path: info.outputPath(`switcher-${l}.png`) });
    await info.attach(`switcher-${l}`, { path: info.outputPath(`switcher-${l}.png`), contentType: "image/png" });
  }
  // Compared to whole pixels: sub-pixel layout noise from different navigation label widths is not a visual difference.
  const whole = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "number" ? Math.round(x) : x));
  const ref = whole(geo["ckb"]);
  for (const l of ["fa", "de", "ar"]) expect(whole(geo[l]), `${l} geometry`).toBe(ref);
});
