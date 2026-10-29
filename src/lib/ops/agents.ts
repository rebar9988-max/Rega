/**
 * The ten logical agents: bounded, READ-ONLY collectors feeding the pure analyzers. They share the existing Worker,
 * D1 database and search code; there is no separate Worker, schedule, queue or external service per agent.
 * Every query has a row bound (OPS_LIMITS.maxRowsPerQuery) and every HTTP request goes through one ProbeBudget.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { PUBLIC_BUSINESS } from "@/lib/search-where";
import { SUPER_ADMIN_EMAILS, isSuperAdminEmail } from "@/lib/rbac";
import { locationAudit } from "@/lib/business-admin";
import { FLAG_DEFAULTS } from "@/lib/flags";
import { providerCatalog } from "@/lib/ai";
import { searchService } from "@/lib/search/postgres";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, type Locale } from "@/config/locales";
import { OPS_LIMITS } from "./core";
import { ProbeBudget, probe, type ProbeResult } from "./probe";
import type { AgentId, Inspection } from "./types";
import { analyzeBusinesses } from "./analyzers/business";
import { analyzeCategories } from "./analyzers/category";
import { analyzeLocations } from "./analyzers/location";
import { analyzeTranslations } from "./analyzers/translation";
import { analyzeSecurity } from "./analyzers/security";
import { analyzePerformance, analyzeQa, type QaTarget } from "./analyzers/web";
import { analyzeAnalytics, analyzeContent, externalLinks, type AnalyticsFacts, type ContentRow } from "./analyzers/content";
import { analyzeAi } from "./analyzers/ai";

const TAKE = OPS_LIMITS.maxRowsPerQuery;
const DAY = 86_400_000;
/** The owner of SUPER_ADMIN power (the same reviewed constant every guard uses). */
const OWNER = "rebar9988@gmail.com";

/**
 * Origin the HTTP-based agents inspect: the canonical public site. Only outside production, a loopback origin may be
 * set (OPS_PROBE_ORIGIN) so local and CI test servers never send probes to the live site.
 */
export function probeOrigin(env: { APP_ENV: string; CANONICAL_HOST: string }, override = process.env.OPS_PROBE_ORIGIN): string {
  if (override && env.APP_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override)) return override;
  return `https://${env.CANONICAL_HOST}`;
}
const baseUrl = () => probeOrigin(serverEnv());

/** Probes one after another (never in parallel), so a run adds at most one request at a time to the site. */
async function probeAll(urls: string[], signal: AbortSignal, opts: { method?: "GET" | "HEAD"; readBody?: boolean; budget?: ProbeBudget } = {}): Promise<ProbeResult[]> {
  const budget = opts.budget ?? new ProbeBudget();
  const deadline = Date.now() + OPS_LIMITS.probeWindowMs;
  const out: ProbeResult[] = [];
  for (const url of urls) out.push(await probe(url, { budget, signal, deadline, method: opts.method, readBody: opts.readBody }));
  return out;
}

async function businessInspector(): Promise<Inspection> {
  const rows = await prisma.business.findMany({
    where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: TAKE,
    select: {
      id: true, slug: true, name: true, status: true, categoryId: true, email: true, phone: true, whatsapp: true, website: true, updatedAt: true,
      category: { select: { isActive: true, deletedAt: true, sectionKey: true } },
      locations: { where: { deletedAt: null }, select: { isPrimary: true, addressLine1: true, countryCode: true, cityId: true, latitude: true, longitude: true, coordsVerifiedAt: true, city: { select: { isActive: true, country: { select: { code: true } } } } } },
    },
  });
  return analyzeBusinesses(rows, new Date());
}

async function categoryInspector(): Promise<Inspection> {
  const [rows, counts] = await Promise.all([
    prisma.category.findMany({ take: TAKE, select: { id: true, key: true, slug: true, parentId: true, sectionKey: true, isActive: true, deletedAt: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true, translations: { select: { locale: true } } } }),
    prisma.business.groupBy({ by: ["categoryId"], where: PUBLIC_BUSINESS, _count: { _all: true } }),
  ]);
  const byCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return analyzeCategories(rows.map(({ translations, ...c }) => ({ ...c, translationLocales: translations.map((t) => t.locale), publicBusinesses: byCategory.get(c.id) ?? 0 })));
}

async function locationInspector(): Promise<Inspection> {
  const missing = (r: Record<string, unknown>, cols: string[]) => cols.filter((c) => !(typeof r[c] === "string" && (r[c] as string).trim())).length;
  const cols = ["nameCkb", "nameKmr", "nameDe", "nameFa", "nameAr", "nameTr"];
  const [countries, regions, cities, businesses] = await Promise.all([
    prisma.country.findMany({ take: TAKE, select: { id: true, code: true, nameEn: true, isActive: true, latitude: true, longitude: true, nameCkb: true, nameKmr: true, nameDe: true, nameFa: true, nameAr: true, nameTr: true } }),
    prisma.region.findMany({ take: TAKE, select: { id: true, countryId: true, slug: true, nameEn: true, isActive: true, latitude: true, longitude: true } }),
    prisma.city.findMany({ take: TAKE, select: { id: true, countryId: true, regionId: true, slug: true, nameEn: true, isActive: true, latitude: true, longitude: true, nameCkb: true, nameKmr: true, nameDe: true, nameFa: true, nameAr: true, nameTr: true } }),
    locationAudit(),
  ]);
  const inspection = analyzeLocations({
    countries: countries.map((c) => ({ id: c.id, code: c.code, nameEn: c.nameEn, isActive: c.isActive, latitude: c.latitude, longitude: c.longitude, missingNames: missing(c, cols) })),
    regions,
    cities: cities.map((c) => ({ id: c.id, countryId: c.countryId, regionId: c.regionId, slug: c.slug, nameEn: c.nameEn, isActive: c.isActive, latitude: c.latitude, longitude: c.longitude, missingNames: missing(c, cols) })),
    businesses,
  });
  if (cities.length >= TAKE) inspection.evidence.push(`City read bounded at ${TAKE} rows (more exist)`);
  return inspection;
}

async function translationInspector(): Promise<Inspection> {
  const catalogs = Object.fromEntries(await Promise.all(LOCALES.map(async (l) => [l, (await import(`../../messages/${l}.json`)).default] as const)));
  return analyzeTranslations({ reference: DEFAULT_LOCALE, defaultLocale: DEFAULT_LOCALE, catalogs, locales: LOCALES.map((l) => ({ code: l, dir: LOCALE_META[l].dir, script: LOCALE_META[l].script })) });
}

async function securityInspector(signal: AbortSignal): Promise<Inspection> {
  const env = serverEnv();
  const since = new Date(Date.now() - DAY);
  const failActions = ["auth.password.failed", "auth.dr_code.failed", "auth.oauth.failed"];
  const ipThreshold = 10;
  const [supers, admins, byAction, byIp] = await Promise.all([
    prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, take: 50, select: { email: true, status: true, deletedAt: true } }),
    prisma.user.count({ where: { role: "ADMIN", status: "active", deletedAt: null } }),
    prisma.auditLog.groupBy({ by: ["action"], where: { action: { in: failActions }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ["ip"], where: { action: { in: failActions }, createdAt: { gte: since }, ip: { not: null } }, _count: { _all: true } }),
  ]);
  const n = (a: string) => byAction.find((r) => r.action === a)?._count._all ?? 0;
  const base = baseUrl();
  const [home, dr, api] = await probeAll([`${base}/${DEFAULT_LOCALE}`, `${base}/dr`, `${base}/api/v1/businesses?status=draft&perPage=50`], signal);
  return analyzeSecurity({
    ownerEmails: SUPER_ADMIN_EMAILS, expectedOwner: OWNER,
    storedSuperAdmins: supers.map((u) => ({ isOwner: isSuperAdminEmail(u.email), active: u.status === "active" && !u.deletedAt })),
    activeAdmins: admins,
    authSecretLength: env.AUTH_SECRET.length,
    appEnv: env.APP_ENV,
    isolatedPreview: process.env.REGA_ISOLATED_PREVIEW === "1",
    failures24h: { password: n("auth.password.failed"), code: n("auth.dr_code.failed"), oauth: n("auth.oauth.failed") },
    noisyClients: byIp.filter((r) => r._count._all >= ipThreshold).length,
    ipThreshold,
    home, dr, api,
  });
}

/** One example of each public page type, taken from real public records (nothing is invented). */
async function publicSamples() {
  const [category, business, city] = await Promise.all([
    prisma.category.findFirst({ where: { isActive: true, deletedAt: null, sectionKey: "businesses", parentId: null }, orderBy: { sortOrder: "asc" }, select: { slug: true } }),
    prisma.business.findFirst({ where: PUBLIC_BUSINESS, orderBy: { updatedAt: "desc" }, select: { slug: true } }),
    prisma.city.findFirst({ where: { isActive: true, slug: { not: null }, locations: { some: { deletedAt: null, business: PUBLIC_BUSINESS } } }, select: { slug: true } }),
  ]);
  return { category: category?.slug ?? null, business: business?.slug ?? null, city: city?.slug ?? null };
}

const expect = (l: Locale) => ({ lang: LOCALE_META[l].htmlLang, dir: LOCALE_META[l].dir });

async function qaAutomation(signal: AbortSignal): Promise<Inspection> {
  const base = baseUrl();
  const s = await publicSamples();
  const targets: QaTarget[] = [
    { kind: "home", url: `${base}/ckb`, expect: expect("ckb") },
    { kind: "home", url: `${base}/en`, expect: expect("en") },
    { kind: "home", url: `${base}/ar`, expect: expect("ar") },
    { kind: "home", url: `${base}/fr`, expect: expect("fr") },
    { kind: "list", url: `${base}/ckb/businesses`, expect: expect("ckb") },
    { kind: "search", url: `${base}/en/search?q=restaurant`, expect: expect("en") },
    ...(s.category ? [{ kind: "category" as const, url: `${base}/de/businesses/${encodeURIComponent(s.category)}`, expect: expect("de") }] : []),
    ...(s.business ? [{ kind: "business" as const, url: `${base}/ckb/business/${encodeURIComponent(s.business)}`, expect: expect("ckb") }] : []),
    ...(s.city ? [{ kind: "city" as const, url: `${base}/en/city/${encodeURIComponent(s.city)}`, expect: expect("en") }] : []),
    { kind: "health", url: `${base}/api/health` },
    { kind: "robots", url: `${base}/robots.txt` },
    { kind: "sitemap", url: `${base}/sitemap.xml` },
  ];
  const [results, badCategories, publicBusinesses, hidden] = await Promise.all([
    probeAll(targets.map((t) => t.url), signal),
    prisma.category.findMany({ where: { isActive: true, deletedAt: null }, take: TAKE, select: { slug: true } }),
    prisma.business.findMany({ where: PUBLIC_BUSINESS, take: TAKE, select: { slug: true } }),
    prisma.business.findMany({ where: { status: "published", deletedAt: null, archivedAt: null, NOT: PUBLIC_BUSINESS }, take: 50, select: { slug: true } }),
  ]);
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return analyzeQa(targets, results, {
    badCategorySlugs: badCategories.map((c) => c.slug).filter((x) => !SLUG.test(x)),
    badBusinessSlugs: publicBusinesses.map((b) => b.slug).filter((x) => !/^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u.test(x)),
    publishedWithoutCategory: hidden.map((b) => b.slug),
  });
}

async function performanceInspector(signal: AbortSignal): Promise<Inspection> {
  const base = baseUrl();
  const s = await publicSamples();
  const urls = [`${base}/ckb`, `${base}/en`, `${base}/ckb/businesses`, ...(s.business ? [`${base}/en/business/${encodeURIComponent(s.business)}`] : []), `${base}/de/search?q=cafe`];
  return analyzePerformance(await probeAll(urls, signal));
}

async function contentInspector(signal: AbortSignal): Promise<Inspection> {
  const [pages, listings] = await Promise.all([
    prisma.page.findMany({ take: TAKE, select: { id: true, slug: true, status: true, updatedAt: true, translations: { select: { locale: true, body: true } } } }),
    prisma.listing.findMany({
      where: { deletedAt: null, sectionKey: { in: ["guides", "jobs", "events"] } }, take: TAKE,
      select: { id: true, slug: true, sectionKey: true, status: true, updatedAt: true, expiresAt: true, translations: { select: { locale: true, body: true, summary: true } }, job: { select: { applyUrl: true } }, event: { select: { infoUrl: true, endsAt: true } } },
    }),
  ]);
  const rows: ContentRow[] = [
    ...pages.map((p) => ({ kind: "page" as const, id: p.id, slug: p.slug, status: p.status, updatedAt: p.updatedAt, locales: p.translations.map((t) => t.locale), text: p.translations.map((t) => t.body).join("\n"), links: [] })),
    ...listings.map((l) => ({
      kind: (l.sectionKey === "guides" ? "guide" : l.sectionKey === "jobs" ? "job" : "event") as ContentRow["kind"],
      id: l.id, slug: l.slug, status: l.status, updatedAt: l.updatedAt, locales: l.translations.map((t) => t.locale),
      text: l.translations.map((t) => `${t.summary ?? ""}\n${t.body ?? ""}`).join("\n"),
      links: [l.job?.applyUrl, l.event?.infoUrl].filter((x): x is string => Boolean(x)),
      expiresAt: l.expiresAt, endsAt: l.event?.endsAt ?? null,
    })),
  ];
  // External sites get HEAD requests only, at most the shared budget, one at a time.
  const links = externalLinks(rows).slice(0, 8);
  const results = await probeAll(links, signal, { method: "HEAD", readBody: false });
  return analyzeContent(rows, results, new Date());
}

async function analyticsInspector(): Promise<Inspection> {
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const [publicBusinesses, views, top, activeCategories, byCategory, activeCities, byCity, listed, reviews, ai, openReports] = await Promise.all([
    prisma.business.count({ where: PUBLIC_BUSINESS }),
    prisma.business.aggregate({ where: PUBLIC_BUSINESS, _sum: { viewCount: true } }),
    prisma.business.findMany({ where: PUBLIC_BUSINESS, orderBy: { viewCount: "desc" }, take: 5, select: { slug: true, viewCount: true } }),
    prisma.category.count({ where: { isActive: true, deletedAt: null, sectionKey: "businesses" } }),
    prisma.business.groupBy({ by: ["categoryId"], where: PUBLIC_BUSINESS, _count: { _all: true } }),
    prisma.city.count({ where: { isActive: true } }),
    prisma.location.groupBy({ by: ["cityId"], where: { deletedAt: null, status: "active", cityId: { not: null }, business: PUBLIC_BUSINESS }, _count: { _all: true } }),
    prisma.business.findMany({ where: PUBLIC_BUSINESS, take: TAKE, select: { slug: true, locations: { where: { deletedAt: null, isPrimary: true }, take: 1, select: { latitude: true, longitude: true, city: { select: { isActive: true } } } } } }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.aiUsageDaily.aggregate({ where: { day: { gte: weekAgo } }, _sum: { requests: true } }),
    prisma.report.count({ where: { status: "open" } }),
  ]);
  const undiscoverable = listed.flatMap((b): AnalyticsFacts["undiscoverable"] => {
    const loc = b.locations[0];
    if (!loc || loc.latitude == null || loc.longitude == null) return [{ slug: b.slug, reason: "no_marker" }];
    if (loc.city && !loc.city.isActive) return [{ slug: b.slug, reason: "inactive_city" }];
    return [];
  });
  const reviewCount = (s: string) => reviews.find((r) => r.status === s)?._count._all ?? 0;
  return analyzeAnalytics({
    publicBusinesses, totalViews: views._sum.viewCount ?? 0, viewsTop: top.map((t) => ({ slug: t.slug, views: t.viewCount })),
    activeCategories, categoriesWithBusinesses: byCategory.filter((c) => c.categoryId).length,
    activeCities, citiesWithBusinesses: byCity.length, undiscoverable,
    reviews: { approved: reviewCount("approved"), pending: reviewCount("pending") }, aiRequests7d: ai._sum.requests ?? 0, openReports,
  });
}

async function aiDiscoveryInspector(): Promise<Inspection> {
  const env = serverEnv();
  const [flag, publicRows, hiddenRows, answers] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { key: "public.aiSearch" }, select: { enabled: true, rollout: true } }),
    prisma.business.findMany({ where: PUBLIC_BUSINESS, take: TAKE, orderBy: { updatedAt: "desc" }, select: { id: true, slug: true, name: true } }),
    prisma.business.findMany({ where: { deletedAt: null, NOT: PUBLIC_BUSINESS }, take: 3, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
    prisma.aiMessage.findMany({ where: { role: "assistant" }, orderBy: { createdAt: "desc" }, take: 50, select: { content: true } }),
  ]);
  const publicIds = new Set(publicRows.map((b) => b.id));
  const publicSlugs = new Set(publicRows.map((b) => b.slug));
  const businessHits = async (text: string) => (await searchService.search({ text, locale: "en", limit: 12 })).filter((h) => h.section === "businesses");
  // Deterministic retrieval tests: the same search the assistant uses, without a model.
  const nonsense = await searchService.search({ text: `zqxjv${crypto.randomUUID().slice(0, 6)}kwpq`, locale: "en", limit: 5 });
  let hiddenLeaks = 0;
  for (const h of hiddenRows) if ((await businessHits(h.name)).some((x) => x.id === h.id)) hiddenLeaks++;
  let nonPublicHits = 0;
  const samples = publicRows.slice(0, 3);
  for (const p of samples) nonPublicHits += (await businessHits(p.name)).filter((x) => !publicIds.has(x.id)).length;
  // Stored answers: only the listing link paths are extracted; the conversation text is never put into the report.
  let unsupported = 0;
  for (const a of answers) for (const m of a.content.matchAll(/\/[a-z]{2,3}\/business\/([\p{L}\p{N}-]+)/gu)) if (!publicSlugs.has(m[1])) unsupported++;
  return analyzeAi({
    flag, codeDefault: FLAG_DEFAULTS["public.aiSearch"], provider: env.AI_PROVIDER,
    configuredProviders: providerCatalog().filter((p) => p.hasKey).map((p) => p.id),
    publicFilter: PUBLIC_BUSINESS, nonsenseHits: nonsense.length,
    hiddenProbes: hiddenRows.length, hiddenLeaks, publicProbes: samples.length, nonPublicHits,
    answersScanned: answers.length, unsupportedLinks: unsupported,
  });
}

export const INSPECTORS: Record<AgentId, (signal: AbortSignal) => Promise<Inspection>> = {
  "business-inspector": businessInspector,
  "security-inspector": securityInspector,
  "qa-automation": qaAutomation,
  "performance-inspector": performanceInspector,
  "category-inspector": categoryInspector,
  "location-inspector": locationInspector,
  "translation-inspector": translationInspector,
  "content-inspector": contentInspector,
  "analytics-inspector": analyticsInspector,
  "ai-discovery-inspector": aiDiscoveryInspector,
};
