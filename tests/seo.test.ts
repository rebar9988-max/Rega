import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES, LOCALE_META } from "../src/i18n/locales";
import { webPageJsonLd, organizationJsonLd, pageAlternates, pageMetadata, parseSocialUrl, socialProfiles } from "../src/lib/seo";

test("hreflang alternates cover every locale plus x-default, all on the same path", () => {
  const a = pageAlternates("de", "/businesses/x");
  assert.equal(a.canonical, "/de/businesses/x");
  const langs = a.languages as Record<string, string>;
  for (const l of LOCALES) assert.equal(langs[LOCALE_META[l].htmlLang], `/${l}/businesses/x`);
  assert.equal(langs["x-default"], "/ckb/businesses/x");
  assert.ok(LOCALES.includes("en" as never), "English is a supported locale");
});

test("page metadata is complete: canonical, Open Graph and X card", () => {
  const m = pageMetadata({ locale: "en", path: "/services", title: "Services", description: "d" });
  assert.equal((m.openGraph as { url: string }).url, "https://www.regaplatform.com/en/services");
  assert.equal((m.twitter as { card: string }).card, "summary_large_image");
  assert.equal(m.robots, undefined);
  assert.deepEqual(pageMetadata({ locale: "en", title: "t", noindex: true }).robots, { index: false, follow: true });
});

test("social URLs: only https on the platform's own domain", () => {
  assert.equal(parseSocialUrl("https://www.facebook.com/regaplatform", ["facebook.com"]), "https://www.facebook.com/regaplatform");
  assert.equal(parseSocialUrl("http://facebook.com/x", ["facebook.com"]), null);
  assert.equal(parseSocialUrl("https://facebook.com.evil.example/x", ["facebook.com"]), null);
  assert.equal(parseSocialUrl("javascript:alert(1)", ["facebook.com"]), null);
  assert.equal(parseSocialUrl("", ["facebook.com"]), null);
  assert.equal(parseSocialUrl(undefined, ["facebook.com"]), null);
});

test("nothing is invented: no configuration means no profiles and no sameAs", () => {
  assert.deepEqual(socialProfiles({}), []);
  const [org] = organizationJsonLd("ckb", "d", {}) as Record<string, unknown>[];
  assert.equal(org["@type"], "Organization");
  assert.ok(!("sameAs" in org));
  assert.equal(org.url, "https://www.regaplatform.com/");
  assert.equal(org.name, "REGA Platform");
});

test("configured profiles feed Organization.sameAs on the canonical domain", () => {
  const env = { SOCIAL_INSTAGRAM_URL: "https://www.instagram.com/rega", SOCIAL_YOUTUBE_URL: "https://youtube.com/@rega", SOCIAL_TIKTOK_URL: "https://evil.example/x" };
  assert.deepEqual(socialProfiles(env).map((p) => p.key), ["instagram", "youtube"]);
  const [org, site] = organizationJsonLd("de", "d", env) as Record<string, unknown>[];
  assert.deepEqual(org.sameAs, ["https://www.instagram.com/rega", "https://youtube.com/@rega"]);
  assert.equal((site.potentialAction as { target: { urlTemplate: string } }).target.urlTemplate, "https://www.regaplatform.com/de/search?q={search_term_string}");
});

test("entity graph: one Organization @id, referenced (not duplicated) by WebSite and WebPage", () => {
  const [org, site] = organizationJsonLd("en", "d", {}) as Record<string, unknown>[];
  assert.equal(org["@id"], "https://www.regaplatform.com/#organization");
  assert.equal(org.name, "REGA Platform");
  assert.equal(org.alternateName, "ڕێگا");
  assert.equal(site.name, "REGA Platform");
  assert.deepEqual(site.publisher, { "@id": org["@id"] });
  const [page, crumbs] = webPageJsonLd({ locale: "de", path: "/businesses", name: "Unternehmen", crumbs: [{ name: "Start", path: "" }, { name: "Unternehmen", path: "/businesses" }] }) as Record<string, unknown>[];
  assert.equal(page["@id"], "https://www.regaplatform.com/de/businesses#webpage");
  assert.deepEqual(page.isPartOf, { "@id": site["@id"] });
  assert.deepEqual(page.publisher, { "@id": org["@id"] });
  assert.equal(crumbs["@type"], "BreadcrumbList");
  const items = crumbs.itemListElement as { position: number; item: string }[];
  assert.deepEqual(items.map((i) => i.position), [1, 2]);
  assert.ok(items.every((i) => i.item.startsWith("https://www.regaplatform.com/de")));
});

test("no schema points at the unrelated Saudi authority", () => {
  const env = { SOCIAL_FACEBOOK_URL: "https://www.rega.gov.sa/x" };
  assert.deepEqual(socialProfiles(env), []);
  const blob = JSON.stringify(organizationJsonLd("ckb", "d", env));
  assert.ok(!/rega\.gov\.sa|Real Estate General Authority/i.test(blob));
});

import { readFileSync } from "node:fs";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, fitDescription } from "../src/lib/seo";

const catalogue = (l: string) => JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8")) as Record<string, Record<string, string>>;

test("fitDescription: short texts get the tagline, long ones are cut at a word with an ellipsis, good ones are untouched", () => {
  const tag = "The Kurdish portal for Germany and Europe";
  const short = fitDescription("Kurdish lawyers in Köln.", tag);
  assert.ok(short.endsWith(`${tag}.`) && short.length <= DESCRIPTION_MAX);
  const long = fitDescription("word ".repeat(60), tag);
  assert.ok(long.length <= DESCRIPTION_MAX && long.endsWith("…") && !long.endsWith(" …"));
  const ok = "x".repeat(130);
  assert.equal(fitDescription(ok, tag), ok);
});

test("every indexable page has its own 120–155 character description in every locale, never the home description", () => {
  for (const l of LOCALES) {
    const m = catalogue(l);
    const tag = m.footer.tagline;
    const pages: Record<string, string> = {
      businesses: m.pageMeta.businesses, services: m.pageMeta.services, locations: m.pageMeta.locations, nearby: m.pageMeta.nearby, ai: m.pageMeta.ai, about: m.pageMeta.about, register: m.pageMeta.register,
      forBusiness: m.pageMeta.forBusiness, contact: m.pageMeta.contact, report: m.pageMeta.report,
      categoryPage: m.pageMeta.categoryPage.replace("{name}", "Legal"), cityPage: m.pageMeta.cityPage.replace("{name}", "Köln"),
      cityCategoryPage: m.pageMeta.cityCategoryPage.replace("{category}", "Legal").replace("{city}", "Köln"),
      businessFallback: m.pageMeta.businessFallback.replace("{name}", "Zagros Restaurant").replace("{place}", "Köln"),
      serviceFallback: m.pageMeta.serviceFallback.replace("{name}", "Erstberatung").replace("{provider}", "Kurdistan Rechtsberatung"),
    };
    const seen = new Map<string, string>();
    for (const [key, text] of Object.entries(pages)) {
      const d = fitDescription(text, tag);
      assert.ok(d.length >= DESCRIPTION_MIN - 8 && d.length <= DESCRIPTION_MAX, `${l}/${key}: ${d.length} characters`);
      assert.notEqual(d, m.meta.description, `${l}/${key} reuses the home description`);
      assert.ok(!seen.has(d), `${l}/${key} duplicates ${seen.get(d)}`);
      seen.set(d, key);
    }
  }
});
