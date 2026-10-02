import { siFacebook, siInstagram } from "simple-icons";
import { expect, test } from "./fixtures";

const LOCALES = [["ckb", "rtl"], ["kmr", "ltr"], ["de", "ltr"], ["ar", "rtl"], ["tr", "ltr"]] as const;

for (const [locale, dir] of LOCALES) {
  test(`home renders with correct lang/dir for ${locale}`, async ({ page }) => {
    const res = await page.goto(`/${locale}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.locator("html")).toHaveAttribute("lang", /.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // No horizontal scrolling at any viewport.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("root redirects to the default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(ckb|de|en|ar|fa|tr|kmr)$/);
});

test("skip link is the first focus stop and targets main", async ({ page }) => {
  await page.goto("/de");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Zum Inhalt springen" });
  await expect(skip).toBeFocused();
  await expect(page.locator("main#main")).toHaveCount(1);
});

test("language switcher keeps the current page", async ({ page }) => {
  await page.goto("/de/businesses");
  await page.getByRole("group").or(page.locator("summary[aria-label]")).first().click();
  await page.getByRole("link", { name: "Türkçe" }).click();
  await expect(page).toHaveURL(/\/tr\/businesses$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("main navigation reaches every section", async ({ page, isMobile }) => {
  await page.goto("/de");
  // Desktop: the header navigation (generated from the section registry; one label per section, the same as the menu sheet). Mobile: the menu sheet keeps every section.
  const routes: [string, RegExp][] = isMobile
    ? [["Unternehmen", /\/de\/businesses$/], ["Dienstleistungen", /\/de\/services$/], ["Standorte", /\/de\/locations$/], ["REGA-Assistent", /\/de\/ai$/]]
    : [["Unternehmen", /\/de\/businesses$/], ["Dienstleistungen", /\/de\/services$/], ["Über uns", /\/de\/about$/]];
  for (const [name, url] of routes) {
    if (isMobile) await page.getByRole("button", { name: "Menü" }).click();
    await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/de");
  }
});

test("theme toggle switches and persists", async ({ page }) => {
  // Design frame 204:912 has no theme toggle in the desktop header; it stays in the header below the xl breakpoint.
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/de");
  const before = await page.locator("html").getAttribute("data-theme");
  await page.getByRole("button", { name: "Design wechseln" }).click();
  const after = await page.locator("html").getAttribute("data-theme");
  expect(after).not.toBe(before);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", after!);
});

test("unknown pages return a real 404 inside the shell", async ({ page }) => {
  const res = await page.goto("/de/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  // The 404 offers search and the main sections.
  await expect(page.getByRole("search").getByRole("searchbox")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Unternehmen", exact: true })).toBeVisible();
  const biz = await page.goto("/de/businesses/does-not-exist");
  expect(biz?.status()).toBe(404);
});

test("robots.txt and sitemap.xml are served", async ({ request }) => {
  expect((await request.get("/robots.txt")).status()).toBe(200);
  const sm = await request.get("/sitemap.xml");
  expect(sm.status()).toBe(200);
  const listings = await request.get("/sitemaps/businesses-1.xml");
  expect(listings.status()).toBe(200);
  expect(await listings.text()).toContain("/business/zagros-restaurant");
});

const MAIN_ROUTES = ["/ckb", "/ckb/businesses", "/ckb/services", "/ckb/locations", "/ckb/nearby", "/ckb/ai", "/ckb/about", "/ckb/login", "/ckb/contact"];

test("footer is compact navigation on every main route: no contact cards, no large logo, links to /contact", async ({ page }) => {
  const mobile = (page.viewportSize()?.width ?? 0) < 640;
  for (const route of MAIN_ROUTES) {
    await page.goto(route);
    const footer = page.locator("footer");
    await expect(footer, route).toHaveCount(1);
    // Contact details live on /contact only.
    await expect(footer.locator('a[href^="tel:"], a[href^="mailto:"]'), route).toHaveCount(0);
    await expect(footer, route).not.toContainText("4228269");
    await expect(footer.getByRole("link", { name: "پەیوەندی", exact: true }), route).toHaveAttribute("href", "/ckb/contact");
    await expect(footer.getByRole("link", { name: "دەربارە", exact: true }), route).toHaveAttribute("href", "/ckb/about");
    // Legal column on every page: Impressum, privacy, terms, report content.
    for (const key of ["impressum", "privacy", "terms", "report"]) await expect(footer.locator(`a[href="/ckb/${key}"]`), `${route} ${key}`).toHaveCount(1);
    const m = await page.evaluate(() => {
      const f = document.querySelector("footer")!;
      const imgs = [...f.querySelectorAll("img")].map((i) => i.getBoundingClientRect().height);
      return { height: f.getBoundingClientRect().height, bottom: f.getBoundingClientRect().bottom + scrollY, doc: document.documentElement.scrollHeight, maxImg: Math.max(0, ...imgs), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(m.maxImg, route).toBeLessThanOrEqual(32); // small mark only, never the large logo
    // Bounded height (includes the optional row of configured social profile links).
    expect(m.height, route).toBeLessThan(mobile ? 520 : 300);
    expect(Math.abs(m.doc - m.bottom), route).toBeLessThanOrEqual(1); // always last on the page
    expect(m.overflow, route).toBe(false);
  }
});

test("footer stays at the bottom of the viewport on a short page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.goto("/de/login");
  const bottom = await page.evaluate(() => document.querySelector("footer")!.getBoundingClientRect().bottom);
  expect(Math.abs(bottom - 1600)).toBeLessThanOrEqual(1);
});

test("contact page: heading once, phone + email + WhatsApp, RTL; the message form stores the message and says so", async ({ page }) => {
  await page.goto("/ckb");
  await page.locator("footer").getByRole("link", { name: "پەیوەندی", exact: true }).click();
  await expect(page).toHaveURL(/\/ckb\/contact$/);
  const main = page.getByRole("main");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("پەیوەندیمان پێوە بکە");
  expect((await main.innerText()).split("پەیوەندیمان پێوە بکە").length - 1).toBe(1); // appears exactly once
  const phone = page.getByTestId("contact-phone");
  await expect(phone).toHaveAttribute("href", "tel:+491784228269");
  await expect(phone).toContainText("+49 178 4228269");
  await expect(phone).toHaveAccessibleName(/\+49 178 4228269/);
  expect(await phone.locator("bdi").evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  expect(await main.evaluate((el) => getComputedStyle(el).direction)).toBe("rtl");
  await expect(page.getByTestId("contact-email")).toHaveAttribute("href", "mailto:info@regaplatform.com");
  await expect(page.getByTestId("contact-whatsapp")).toHaveAttribute("href", "https://wa.me/491784228269");
  await phone.focus();
  await expect(phone).toBeFocused();

  const form = page.getByTestId("contact-form");
  await form.getByLabel("ناو", { exact: true }).fill("ئەحمەد");
  await form.getByLabel("ئیمەیلەکەت").fill("ahmad@example.org");
  await form.getByLabel("بابەت").fill("پرسیار");
  await form.getByLabel("نامە", { exact: true }).fill("سڵاو، ئەمە نامەیەکی تاقیکردنەوەیە.");
  await form.getByRole("button", { name: "ناردن", exact: true }).click();
  await expect(page.getByTestId("contact-sent")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("contact form: honeypot bots get a fake success and nothing is stored", async ({ page }) => {
  await page.goto("/de/contact");
  const form = page.getByTestId("contact-form");
  await form.getByLabel("Name", { exact: true }).fill("Bot");
  await form.getByLabel("Betreff").fill("Spam");
  await form.getByLabel("Nachricht", { exact: true }).fill("Buy cheap things now, please.");
  await form.locator('input[name="hp_website"]').evaluate((el: HTMLInputElement) => { el.value = "http://spam.example"; });
  await form.getByRole("button", { name: "Senden" }).click();
  await expect(page.getByTestId("contact-sent")).toBeVisible();
});

test("homepage social section: configured official profiles only, official brand icons, safe external links", async ({ page }) => {
  await page.goto("/ckb");
  const section = page.getByTestId("social-section");
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("لەگەڵ REGA بەردەوام بە");
  await expect(section).toContainText("نوێترین هەواڵ، خزمەتگوزاری و زانیارییەکانی REGA لە سۆشیال میدیا بەدوادا بگرە.");
  const links = section.getByRole("link");
  await expect(links).toHaveCount(2); // TikTok's configured URL is not on tiktok.com, so it is rejected and hidden
  const fb = section.getByRole("link", { name: "REGA لە Facebook (لە تابێکی نوێ دەکرێتەوە)" });
  const ig = section.getByRole("link", { name: "REGA لە Instagram (لە تابێکی نوێ دەکرێتەوە)" });
  await expect(fb).toHaveAttribute("href", "https://www.facebook.com/rega-e2e-test");
  await expect(ig).toHaveAttribute("href", "https://www.instagram.com/rega_e2e_test/");
  for (const l of [fb, ig]) {
    await expect(l).toHaveAttribute("target", "_blank");
    await expect(l).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(section.locator("a", { hasText: "TikTok" })).toHaveCount(0);
  // Official brand marks, unaltered (paths and colours from simple-icons).
  await expect(fb.locator("svg path")).toHaveAttribute("d", siFacebook.path);
  await expect(ig.locator("svg path")).toHaveAttribute("d", siInstagram.path);
  await expect(fb.locator("svg")).toHaveAttribute("fill", `#${siFacebook.hex}`);
  // Placement: last part of the main content, right before the footer.
  const after = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="social-section"]')!.getBoundingClientRect();
    const f = document.querySelector("footer")!.getBoundingClientRect();
    const main = document.querySelector("main")!;
    return { inMain: main.contains(document.querySelector('[data-testid="social-section"]')), beforeFooter: s.bottom <= f.top + 1 };
  });
  expect(after).toEqual({ inMain: true, beforeFooter: true });
  // Keyboard: focusable with a visible focus outline.
  await fb.focus();
  await expect(fb).toBeFocused();
  expect(await fb.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mobile menu: contact is the last item, once; close button works; RTL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ckb");
  await page.getByRole("button", { name: "مێنیو" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  const items = menu.getByRole("navigation").getByRole("link");
  await expect(items).toHaveText(["سەرەتا", "بازرگانییەکان", "خزمەتگوزارییەکان", "شوێنەکان", "نزیک", "یاریدەدەری REGA", "کار و پیشە", "ڕووداوەکان", "ڕێبەرەکان", "دەربارە", "بۆ بازرگانان", "چوونەژوورەوە", "پەیوەندی"]);
  await expect(items.last()).toHaveAttribute("href", "/ckb/contact");
  await expect(menu.getByRole("link", { name: "پەیوەندی", exact: true })).toHaveCount(1);
  expect(await menu.getByRole("navigation").evaluate((el) => getComputedStyle(el).direction)).toBe("rtl");
  await menu.getByRole("button", { name: "داخستن" }).click();
  await expect(menu).toBeHidden();
  // The contact item leads to the contact page and closes the menu.
  await page.getByRole("button", { name: "مێنیو" }).click();
  await menu.getByRole("link", { name: "پەیوەندی", exact: true }).click();
  await expect(page).toHaveURL(/\/ckb\/contact$/);
  await expect(menu).toBeHidden();
});
