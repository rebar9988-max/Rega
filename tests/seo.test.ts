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
