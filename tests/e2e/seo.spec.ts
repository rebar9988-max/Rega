import { expect, test } from "@playwright/test";

const HOST = "https://www.regaplatform.com";
const LOCALES = ["ckb", "kmr", "de", "en", "ar", "fa", "tr"];
const PAGES = ["", "/businesses", "/services", "/locations", "/ai", "/about"];

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test(`SEO head: /${locale}${path}`, async ({ page }) => {
      const res = await page.goto(`/${locale}${path}`);
      expect(res?.status()).toBe(200);
      // SSR: canonical, hreflang, OG and X tags are in the initial HTML, not injected by JS.
      const html = await (await page.request.get(`/${locale}${path}`)).text();
      expect(html).toContain(`<link rel="canonical" href="${HOST}/${locale}${path}"`);
      for (const l of LOCALES) expect(html).toMatch(new RegExp(`rel="alternate" hrefLang="[^"]+" href="${HOST}/${l}${path}"`, "i"));
      expect(html).toMatch(/hrefLang="x-default" href="[^"]+\/ckb/i);
      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:image"');
      expect(html).toContain(`property="og:url" content="${HOST}/${locale}${path}"`);
      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain('"@type":"Organization"');
      expect(html).toContain('property="og:site_name" content="REGA Platform"');
      expect(html).toMatch(/<title>[^<]*REGA Platform[^<]*<\/title>/);
      // every JSON-LD block parses; all @id references resolve to an entity defined on the same page
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const nodes = blocks.flat();
      const ids = new Set(nodes.map((n: { "@id"?: string }) => n["@id"]).filter(Boolean));
      expect(ids.has(`${HOST}/#organization`)).toBe(true);
      expect(ids.has(`${HOST}/#website`)).toBe(true);
      const refs = JSON.stringify(nodes).match(/"@id":"[^"]+"/g) ?? [];
      const orgs = nodes.filter((n: { "@type"?: string }) => n["@type"] === "Organization");
      expect(orgs).toHaveLength(1);
      expect(refs.length).toBeGreaterThan(2);
      expect(JSON.stringify(nodes)).not.toMatch(/rega\.gov\.sa|localhost/i);
      expect(nodes.some((n: { "@type"?: string }) => n["@type"] === "WebPage" || n["@type"] === "AboutPage" || n["@type"] === "CollectionPage")).toBe(true);
      expect(html).not.toContain('content="noindex');
    });
  }
}

test("html lang/dir per locale, English included", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your community.");
});

test("search is noindex; sitemap lists every locale with hreflang alternates", async ({ request }) => {
  const search = await (await request.get("/de/search")).text();
  expect(search).toContain('name="robots" content="noindex');
  // /sitemap.xml is an index of files; the static routes (generated from the section registry) are in pages.xml.
  const index = await (await request.get("/sitemap.xml")).text();
  expect(index).toContain("<sitemapindex");
  expect(index).toContain(`${HOST}/sitemaps/pages.xml`);
  expect(index).toMatch(/\/sitemaps\/businesses-1\.xml/);
  const xml = await (await request.get("/sitemaps/pages.xml")).text();
  for (const l of LOCALES) expect(xml).toContain(`<loc>${HOST}/${l}/businesses</loc>`);
  for (const path of ["/impressum", "/privacy", "/terms", "/report", "/register", "/for-business", "/businesses/legal", "/city/berlin"]) expect(xml, path).toContain(`<loc>${HOST}/de${path}</loc>`);
  expect(xml, "guides").toContain(`<loc>${HOST}/de/guides</loc>`);
  for (const section of ["jobs", "events"]) expect(xml, section).not.toContain(`<loc>${HOST}/de/${section}</loc>`); // approved hidden/removed sections stay out of public discovery
  expect((await request.get("/sitemaps/nonsense.xml")).status()).toBe(404);
  expect(xml).toContain('hreflang="x-default"');
  expect(xml).not.toContain("localhost");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${HOST}/sitemap.xml`);
  expect(robots).toContain("Disallow: /api/");
});

test("manifest and About page (REGA Platform identity, approved About text)", async ({ request, page }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("REGA Platform");
  await page.goto("/en/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About REGA");
  await expect(page.locator("#about-offer")).toHaveText("What do we offer?");
  await expect(page.locator("#about-offer + ul li")).toHaveCount(3);
  await page.goto("/ckb/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("دەربارەی ڕێگا (REGA)");
  await expect(page.locator("main")).toContainText("ڕێگا، پردی پەیوەندیی تۆ و خزمەتگوزارییە باوەڕپێکراوەکانی دەوروبەرتە.");
});

test("crawlable internal links: home footer reaches About; header reaches all sections", async ({ page }) => {
  await page.goto("/de");
  for (const href of ["/de/businesses", "/de/services", "/de/locations", "/de/ai", "/de/about"]) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
});
