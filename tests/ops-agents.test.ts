import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeBusinesses, type BusinessRow } from "../src/lib/ops/analyzers/business";
import { analyzeCategories, type CategoryRow } from "../src/lib/ops/analyzers/category";
import { analyzeLocations, distanceKm } from "../src/lib/ops/analyzers/location";
import { analyzeTranslations, flatten, placeholders } from "../src/lib/ops/analyzers/translation";
import { analyzeSecurity, type SecurityFacts } from "../src/lib/ops/analyzers/security";
import { analyzePerformance, analyzeQa, type QaTarget } from "../src/lib/ops/analyzers/web";
import { analyzeAnalytics, analyzeContent, externalLinks, type ContentRow } from "../src/lib/ops/analyzers/content";
import { analyzeAi, type AiFacts } from "../src/lib/ops/analyzers/ai";
import { summarize as summarizeSearches } from "../src/lib/search-analytics-core";
const summarize7 = (rows: Parameters<typeof summarizeSearches>[0]) => summarizeSearches(rows, 7);
import { summarize } from "../src/lib/ops/core";
import type { ProbeResult } from "../src/lib/ops/probe";
import type { Inspection } from "../src/lib/ops/types";
import { LOCALES, LOCALE_META, DEFAULT_LOCALE } from "../src/config/locales";
import { SUPER_ADMIN_EMAILS } from "../src/lib/rbac";

const now = new Date("2026-10-29T12:00:00Z");
const result = (i: Inspection, code: string) => i.checks.find((c) => c.code === code)?.result;
const city = (code = "DE", isActive = true) => ({ isActive, country: { code } });
const loc = (over: Partial<BusinessRow["locations"][number]> = {}) => ({ isPrimary: true, addressLine1: "Hauptstr. 1", countryCode: "DE", cityId: "berlin", latitude: 52.5, longitude: 13.4, coordsVerifiedAt: now, city: city(), ...over });
const biz = (over: Partial<BusinessRow> = {}): BusinessRow => ({
  id: over.slug ?? "b", slug: "zagros", name: "Zagros", status: "published", categoryId: "food", email: "info@zagros.de", phone: "+49 30 123456", whatsapp: "+4930123456", website: "https://zagros.de",
  updatedAt: now, category: { isActive: true, deletedAt: null, sectionKey: "businesses" }, locations: [loc()], ...over,
});

test("business inspector: complete listings pass, and it never decides anything", () => {
  const i = analyzeBusinesses([biz(), biz({ slug: "other", name: "Other", phone: "+49 40 999999", whatsapp: null, website: "https://other.de" })], now);
  assert.equal(summarize(i).status, "PASS");
  assert.ok(i.evidence.some((e) => /no approval or rejection/.test(e)));
});

test("business inspector: pending queue, stale and incomplete submissions", () => {
  const old = new Date(now.getTime() - 10 * 86_400_000);
  const i = analyzeBusinesses([
    biz({ slug: "fresh", status: "pending" }),
    biz({ slug: "old", status: "pending", updatedAt: old, phone: null, email: null, whatsapp: null, website: null, name: "Old place" }),
    biz({ slug: "nocat", status: "pending", categoryId: null, category: null, name: "No cat" }),
  ], now);
  assert.equal(result(i, "business.pending_queue"), "info");
  assert.equal(i.checks.find((c) => c.code === "business.pending_queue")!.count, 3);
  assert.equal(result(i, "business.pending_stale"), "warn");
  const incomplete = i.checks.find((c) => c.code === "business.required_info")!;
  assert.deepEqual(incomplete.items!.map((x) => x.label).sort(), ["nocat", "old"]);
  assert.equal(result(i, "business.category_assignment"), "warn");
});

test("business inspector: probable duplicates by normalized name+city, phone and website", () => {
  const i = analyzeBusinesses([
    biz({ slug: "zagros-1", name: "Zagros Restaurant" }),
    biz({ slug: "zagros-2", name: "  zagros   RESTAURANT ", phone: "+49 40 777777", whatsapp: null, website: null }),
    biz({ slug: "x", name: "X", phone: "030 123456", whatsapp: null, website: "https://www.zagros.de/menu" }),
  ], now);
  const dup = i.checks.find((c) => c.code === "business.probable_duplicates")!;
  assert.equal(dup.result, "warn");
  assert.ok(dup.items!.some((g) => g.label.includes("zagros-1") && g.label.includes("zagros-2")));
  assert.ok(dup.items!.length >= 2, "name+city group and phone/website group");
  // Social-network hosts are shared by unrelated businesses: never a duplicate signal.
  const social = analyzeBusinesses([biz({ slug: "a", name: "A", phone: null, whatsapp: null, website: "https://facebook.com/a" }), biz({ slug: "b2", name: "B", phone: null, whatsapp: null, website: "https://facebook.com/b" })], now);
  assert.equal(result(social, "business.probable_duplicates"), "pass");
});

test("business inspector: country/city mismatch, coordinates and links", () => {
  const i = analyzeBusinesses([
    biz({ slug: "wrong-country", locations: [loc({ countryCode: "IQ", city: city("DE") })] }),
    biz({ slug: "null-island", name: "N", phone: null, whatsapp: null, website: null, locations: [loc({ latitude: 0, longitude: 0 })] }),
    biz({ slug: "bad-links", name: "L", phone: null, whatsapp: "12345", website: "javascript:alert(1)", email: "nope" }),
    biz({ slug: "local", name: "Lo", phone: null, whatsapp: null, website: "http://127.0.0.1/admin" }),
  ], now);
  assert.equal(result(i, "business.country_city"), "fail");
  assert.equal(result(i, "business.coordinates"), "fail");
  const links = i.checks.find((c) => c.code === "business.links")!;
  assert.deepEqual(links.items!.map((x) => x.label).sort(), ["bad-links", "local"]);
  assert.equal(summarize(i).status, "FAIL");
});

const cat = (over: Partial<CategoryRow>): CategoryRow => ({ id: over.slug ?? "c", key: over.slug ?? "c", slug: "food", parentId: null, sectionKey: "businesses", isActive: true, deletedAt: null, nameCkb: "خواردن", nameKmr: "Xwarin", nameDe: "Essen", nameEn: "Food", nameAr: "طعام", nameFa: "غذا", nameTr: "Yemek", translationLocales: ["fr", "sv", "nl", "it"], publicBusinesses: 1, ...over });

test("category inspector: slugs, duplicates, translations, tree integrity and filtering", () => {
  assert.equal(summarize(analyzeCategories([cat({ slug: "food" }), cat({ slug: "hair", nameCkb: "قژ", nameDe: "Friseur", nameEn: "Hair" })])).status, "PASS");
  const i = analyzeCategories([
    cat({ slug: "food" }),
    cat({ slug: "food-2", nameEn: "FOOD", nameCkb: "x", nameDe: "y" }),
    cat({ slug: "Bad Slug", nameEn: "Bad", nameCkb: "b", nameDe: "b" }),
    cat({ slug: "orphan", parentId: "missing", nameEn: "O", nameCkb: "o", nameDe: "o" }),
    cat({ slug: "loop-a", id: "la", parentId: "lb", nameEn: "LA", nameCkb: "la", nameDe: "la" }),
    cat({ slug: "loop-b", id: "lb", parentId: "la", nameEn: "LB", nameCkb: "lb", nameDe: "lb" }),
    cat({ slug: "untranslated", nameAr: null, translationLocales: [], nameEn: "U", nameCkb: "u", nameDe: "u" }),
    cat({ slug: "off", isActive: false, publicBusinesses: 2, nameEn: "Off", nameCkb: "off", nameDe: "off" }),
  ]);
  assert.equal(result(i, "category.slug_format"), "fail");
  assert.equal(result(i, "category.duplicates"), "warn");
  assert.equal(result(i, "category.parent_missing"), "fail");
  assert.equal(result(i, "category.tree_depth"), "fail");
  assert.equal(result(i, "category.localized_names"), "warn");
  assert.equal(result(i, "category.row_translations"), "info");
  assert.equal(result(i, "category.inactive_with_businesses"), "warn");
});

test("location inspector: hierarchy, duplicates, coordinates and distance", () => {
  const countries = [{ id: "de", code: "DE", nameEn: "Germany", isActive: true, latitude: 51.2, longitude: 10.4, missingNames: 0 }, { id: "iq", code: "IQ", nameEn: "Iraq", isActive: true, latitude: 33.2, longitude: 43.7, missingNames: 0 }];
  const regions = [{ id: "be", countryId: "de", slug: "berlin", nameEn: "Berlin", isActive: true, latitude: 52.5, longitude: 13.4 }, { id: "erb", countryId: "iq", slug: "erbil", nameEn: "Erbil", isActive: true, latitude: 36.2, longitude: 44 }];
  const c = (over: Record<string, unknown>) => ({ id: "x", countryId: "de", regionId: "be", slug: "berlin", nameEn: "Berlin", isActive: true, latitude: 52.52, longitude: 13.4, missingNames: 0, ...over });
  const clean = analyzeLocations({ countries, regions, cities: [c({}), c({ id: "erbil", countryId: "iq", regionId: "erb", slug: "erbil", nameEn: "Erbil", latitude: 36.19, longitude: 44.01 })], businesses: { published: 1, missing: 0, invalid: 0, unverified: 0 } });
  assert.equal(summarize(clean).status, "PASS");
  const i = analyzeLocations({
    countries, regions,
    cities: [
      c({}), c({ id: "dup", slug: "berlin-2" }),
      c({ id: "mismatch", regionId: "erb", slug: "mismatch", nameEn: "Mismatch" }),
      c({ id: "bad", slug: "bad", nameEn: "Bad", latitude: 123, longitude: 13 }),
      c({ id: "far", slug: "far", nameEn: "Far", latitude: -33.9, longitude: 151.2 }),
      c({ id: "noslug", slug: null, nameEn: "No slug" }),
    ],
    businesses: { published: 2, missing: 1, invalid: 0, unverified: 1 },
  });
  assert.equal(result(i, "location.hierarchy"), "fail");
  assert.equal(result(i, "location.duplicate_cities"), "warn");
  assert.equal(result(i, "location.invalid_coordinates"), "fail");
  assert.equal(result(i, "location.far_from_country"), "warn");
  assert.equal(result(i, "location.city_slug"), "warn");
  assert.equal(result(i, "location.business_markers"), "warn");
  assert.ok(Math.abs(distanceKm({ lat: 52.52, lng: 13.405 }, { lat: 48.137, lng: 11.575 }) - 504) < 10, "Berlin–Munich ≈ 504 km");
});

const catalogs = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8"))]));
const localeInfo = LOCALES.map((l) => ({ code: l, dir: LOCALE_META[l].dir, script: LOCALE_META[l].script }));

test("translation inspector on the REAL catalogues: all registered locales, no missing keys, placeholders or direction errors", () => {
  assert.ok(LOCALES.length >= 11, "no downgrade below the eleven interface languages");
  for (const l of ["fr", "sv", "nl", "it"]) assert.ok((LOCALES as readonly string[]).includes(l), l);
  const i = analyzeTranslations({ reference: DEFAULT_LOCALE, defaultLocale: DEFAULT_LOCALE, catalogs, locales: localeInfo });
  for (const code of ["translation.catalog_present", "translation.default_locale", "translation.missing_keys", "translation.placeholders", "translation.direction"]) assert.equal(result(i, code), "pass", code);
  assert.notEqual(summarize(i).status, "FAIL");
});

test("translation inspector detects missing keys, placeholder drift, empty text and wrong direction", () => {
  const i = analyzeTranslations({
    reference: "ckb", defaultLocale: "ckb",
    catalogs: { ckb: { a: { x: "سڵاو {name}", y: "باشە", z: "<b>دەق</b>" } }, en: { a: { x: "Hello {name}", y: "Okay" } }, ar: { a: { x: "Hello {nom}", y: "Okay", z: "" } } },
    locales: [{ code: "ckb", dir: "rtl", script: "arab" }, { code: "en", dir: "ltr", script: "latn" }, { code: "ar", dir: "rtl", script: "arab" }],
  });
  assert.equal(result(i, "translation.missing_keys"), "fail");
  assert.equal(result(i, "translation.placeholders"), "fail");
  assert.equal(result(i, "translation.empty"), "warn");
  assert.equal(result(i, "translation.direction"), "fail", "ar written in Latin script");
  assert.deepEqual(placeholders("{count, plural, one {# day} other {# days}} <b>{name}</b>"), ["<b>", "count", "name"]);
  assert.deepEqual(Object.keys(flatten({ a: { b: "1", c: ["x"] } })), ["a.b", "a.c.0"]);
});

const p = (url: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ url, ok: true, status: 200, ttfbMs: 120, totalMs: 200, bytes: 50_000, truncated: false, headers: {}, body: "", ...over });

const facts = (over: Partial<SecurityFacts> = {}): SecurityFacts => ({
  ownerEmails: SUPER_ADMIN_EMAILS, expectedOwner: "rebar9988@gmail.com", storedSuperAdmins: [{ isOwner: true, active: true }], activeAdmins: 0,
  authSecretLength: 48, appEnv: "production", isolatedPreview: false, failures24h: { password: 1, code: 0, oauth: 0 }, noisyClients: 0, ipThreshold: 10,
  home: p("https://www.rega24.com/ckb", { headers: { "content-security-policy": "default-src 'self'; object-src 'none'; frame-ancestors 'none'", "strict-transport-security": "max-age=63072000; includeSubDomains; preload", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin" } }),
  dr: p("https://www.rega24.com/dr", { headers: { "cache-control": "private, no-cache, no-store", "x-robots-tag": "noindex, nofollow" }, body: "<main data-dr-sign-in=\"\">" }),
  api: p("https://www.rega24.com/api/v1/businesses?status=draft", { body: JSON.stringify({ data: [{ status: "published" }] }) }),
  ...over,
});

test("security inspector: owner-only SUPER_ADMIN, headers, anonymous /dr and API separation", () => {
  const ok = analyzeSecurity(facts());
  assert.equal(ok.checks.filter((c) => c.result === "fail" || c.result === "warn").length, 0);
  assert.equal(result(ok, "security.repository_secrets"), "skip", "the repository scan runs in CI");
  const bad = analyzeSecurity(facts({
    ownerEmails: ["rebar9988@gmail.com", "someone@example.org"], storedSuperAdmins: [{ isOwner: true, active: true }, { isOwner: false, active: true }], authSecretLength: 10,
    failures24h: { password: 30, code: 2, oauth: 0 }, noisyClients: 1,
    home: p("https://www.rega24.com/ckb", { headers: {} }),
    dr: p("https://www.rega24.com/dr", { headers: { "cache-control": "public, max-age=60" }, body: "<div data-testid=\"attention\">" }),
    api: p("https://www.rega24.com/api/v1/businesses?status=draft", { body: JSON.stringify({ data: [{ status: "draft" }] }) }),
  }));
  for (const code of ["security.owner_allowlist", "security.auth_secret", "security.headers", "security.dr_anonymous", "security.api_anonymous"]) assert.equal(result(bad, code), "fail", code);
  assert.equal(result(bad, "security.stored_super_admin"), "warn");
  assert.equal(result(bad, "security.failed_sign_ins"), "warn");
  // Never echoes an address, a secret or an IP.
  assert.doesNotMatch(JSON.stringify(bad), /someone@example\.org|\b\d{1,3}(\.\d{1,3}){3}\b/);
});

test("QA and performance inspectors: route status, lang/dir, edge blocks, thresholds", () => {
  const targets: QaTarget[] = [{ kind: "home", url: "https://www.rega24.com/ckb", expect: { lang: "ckb-IQ", dir: "rtl" } }, { kind: "home", url: "https://www.rega24.com/en", expect: { lang: "en", dir: "ltr" } }, { kind: "search", url: "https://www.rega24.com/en/search?q=a" }];
  const home = (lang: string, dir: string) => `<html lang="${lang}" dir="${dir}"><link rel="alternate" hrefLang="x-default" href="/">`;
  const good = analyzeQa(targets, [p(targets[0].url, { body: home("ckb-IQ", "rtl") }), p(targets[1].url, { body: home("en", "ltr") }), p(targets[2].url)], { badCategorySlugs: [], badBusinessSlugs: [], publishedWithoutCategory: [] });
  assert.equal(good.checks.filter((c) => c.result === "fail" || c.result === "warn").length, 0);
  const bad = analyzeQa(targets, [p(targets[0].url, { body: home("en", "ltr") }), p(targets[1].url, { status: 500, ok: false }), p(targets[2].url, { status: 403, headers: { server: "cloudflare" } })], { badCategorySlugs: ["Bad Slug"], badBusinessSlugs: [], publishedWithoutCategory: ["x"] });
  assert.equal(result(bad, "qa.routes"), "fail");
  assert.equal(result(bad, "qa.language_direction"), "fail");
  assert.equal(result(bad, "qa.edge_blocked"), "warn");
  assert.equal(result(bad, "qa.route_integrity"), "fail");
  const perf = analyzePerformance([p("https://www.rega24.com/ckb"), p("https://www.rega24.com/en", { ttfbMs: 2500 }), p("https://www.rega24.com/de", { bytes: 400_000 }), p("https://www.rega24.com/x", { body: "<script src=\"https://evil.example/t.js\"></script>" })]);
  assert.equal(result(perf, "performance.ttfb"), "fail");
  assert.equal(result(perf, "performance.html_size"), "warn");
  assert.equal(result(perf, "performance.third_party"), "warn");
  assert.equal(result(perf, "performance.lighthouse"), "skip", "Lighthouse is never claimed from the Worker");
});

test("content inspector: translations, stale guidance, sources, expired listings, broken links", () => {
  const old = new Date(now.getTime() - 400 * 86_400_000);
  const rows: ContentRow[] = [
    { kind: "guide", id: "g1", slug: "residence-permit", status: "published", updatedAt: old, locales: ["ckb"], text: "no source here", links: [] },
    { kind: "job", id: "j1", slug: "cook", status: "published", updatedAt: now, locales: ["ckb", "en"], text: "Apply at https://jobs.example.org/cook.", links: [], expiresAt: new Date(now.getTime() - 86_400_000) },
    { kind: "page", id: "p1", slug: "draft", status: "draft", updatedAt: old, locales: [], text: "https://ignored.example", links: [] },
  ];
  assert.deepEqual(externalLinks(rows), ["https://jobs.example.org/cook"]);
  const i = analyzeContent(rows, [p("https://jobs.example.org/cook", { status: 404, ok: false })], now);
  for (const code of ["content.translations", "content.stale", "content.sources", "content.expired", "content.broken_links"]) assert.equal(result(i, code), "warn", code);
  assert.equal(summarize(analyzeContent([], [], now)).status, "PASS");
});

test("analytics inspector: aggregated counts only, zero-result searches are not tracked", () => {
  const base = { publicBusinesses: 3, totalViews: 40, viewsTop: [{ slug: "a", views: 30 }], activeCategories: 19, categoriesWithBusinesses: 2, activeCities: 2000, citiesWithBusinesses: 3, undiscoverable: [{ slug: "a", reason: "no_marker" as const }], reviews: { approved: 0, pending: 0 }, aiRequests7d: 5, openReports: 0 };
  const i = analyzeAnalytics({ ...base, searches: null });
  assert.equal(result(i, "analytics.category_coverage"), "warn");
  assert.equal(result(i, "analytics.discovery_paths"), "warn");
  assert.equal(result(i, "analytics.zero_result_searches"), "skip", "unreadable table: not run, not guessed");
  assert.doesNotMatch(JSON.stringify(i), /@/);
  const stats = (rows: { day: string; query: string; searches: number; zeroResults: number }[]) => ({ ...summarize7(rows), truncated: false });
  assert.equal(result(analyzeAnalytics({ ...base, searches: stats([]) }), "analytics.zero_result_searches"), "info", "no searches yet");
  const gaps = analyzeAnalytics({ ...base, searches: stats([{ day: "2026-10-30", query: "dentist", searches: 6, zeroResults: 6 }, { day: "2026-10-30", query: "pizza", searches: 4, zeroResults: 0 }]) });
  const gap = gaps.checks.find((c) => c.code === "analytics.zero_result_searches")!;
  assert.equal(gap.result, "warn", "60% of searches found nothing");
  assert.deepEqual(gap.items, [{ label: "dentist: 6" }]);
  assert.match(gap.action!, /هیچ داتایەک بە خۆکار دروست ناکرێت/, "never creates data itself");
  const few = analyzeAnalytics({ ...base, searches: stats([{ day: "2026-10-30", query: "x1", searches: 2, zeroResults: 2 }]) });
  assert.equal(result(few, "analytics.zero_result_searches"), "info", "too few searches to warn");
});

const ai = (over: Partial<AiFacts> = {}): AiFacts => ({ flag: { enabled: false, rollout: 0 }, codeDefault: false, provider: "auto", configuredProviders: [], publicFilter: { status: "published", verified: true, deletedAt: null, archivedAt: null }, nonsenseHits: 0, hiddenProbes: 2, hiddenLeaks: 0, publicProbes: 2, nonPublicHits: 0, answersScanned: 0, unsupportedLinks: 0, ...over });

test("AI discovery inspector: disabled by default, published-only retrieval, no model call", async () => {
  const { FLAG_DEFAULTS } = await import("../src/lib/flags").catch(() => ({ FLAG_DEFAULTS: null as null | Record<string, boolean> }));
  if (FLAG_DEFAULTS) assert.equal(FLAG_DEFAULTS["public.aiSearch"], false);
  const flagsSource = readFileSync("src/lib/flags.ts", "utf8");
  assert.match(flagsSource, /"public\.aiSearch": false/);
  const { PUBLIC_BUSINESS } = await import("../src/lib/search-where");
  const off = analyzeAi(ai({ publicFilter: PUBLIC_BUSINESS }));
  assert.equal(off.checks.filter((c) => c.result === "fail" || c.result === "warn").length, 0);
  assert.equal(result(off, "ai.inspector_no_model"), "pass");
  const on = analyzeAi(ai({ flag: { enabled: true, rollout: 100 }, configuredProviders: ["gemini"] }));
  assert.equal(result(on, "ai.public_flag"), "warn", "reported, never switched off automatically");
  assert.equal(result(on, "ai.paid_providers"), "warn");
  const leak = analyzeAi(ai({ hiddenLeaks: 1, nonPublicHits: 1, nonsenseHits: 2, codeDefault: true, publicFilter: { status: "draft" }, answersScanned: 4, unsupportedLinks: 2 }));
  for (const code of ["ai.private_data", "ai.retrieval_scope", "ai.no_results", "ai.default_off", "ai.published_only_filter"]) assert.equal(result(leak, code), "fail", code);
  assert.equal(result(leak, "ai.unsupported_claims"), "warn");
});

test("agents are read-only: no collector calls a write method, a model or an external paid API", () => {
  const src = readFileSync("src/lib/ops/agents.ts", "utf8");
  assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|\$executeRaw|\$queryRaw)\(/);
  assert.doesNotMatch(src, /getGateway|\.generate\(|chat\(/);
  assert.doesNotMatch(src, /setInterval|setTimeout\(|while \(true\)/, "no polling loop");
  for (const file of ["core", "probe", "types"]) assert.doesNotMatch(readFileSync(`src/lib/ops/${file}.ts`, "utf8"), /prisma|@\/lib\/db/);
  // The only database writes of the whole system: its own report and lock rows in existing tables.
  const store = readFileSync("src/lib/ops/store.ts", "utf8");
  const writes = [...store.matchAll(/prisma\.(\w+)\.(create|update|upsert|delete|deleteMany|updateMany)\(/g)].map((m) => `${m[1]}.${m[2]}`);
  assert.deepEqual([...new Set(writes)].sort(), ["auditLog.create", "setting.create", "setting.deleteMany"]);
  assert.match(store, /key: "ops\.lock\.|ops\.lock\./);
});

test("no new infrastructure: no cron trigger, queue, extra Worker, binding or paid service was added", () => {
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.doesNotMatch(wrangler, /"triggers"|"crons"|"queues"|"durable_objects"|"services"\s*:/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) assert.doesNotMatch(dep, /sentry|datadog|newrelic|lighthouse-ci|posthog|mixpanel|segment/i);
});
