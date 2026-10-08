/**
 * Sitemaps: an index (/sitemap.xml) pointing to files of at most CHUNK records each (/sitemaps/pages.xml,
 * /sitemaps/businesses-1.xml, /sitemaps/services-1.xml, ...), so the 50,000-URL limit per file is never reached however
 * many listings exist. Every record is written once per locale with the full hreflang alternate list of the locale
 * config (config/locales.ts) and an x-default. Static paths come from the section registry (config/sections.ts).
 */
import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META } from "@/config/locales";
import { sectionEnabled, sectionsFor } from "@/config/sections";
import { CONTENT_SECTIONS, isContentSection, type ContentSection } from "@/features/content/config";
import { siteOrigin } from "@/lib/seo";
import { descendantIds } from "@/lib/category-tree";
import { hasPublicBusinesses, hasPublicServices, hasPublishedEntries } from "@/lib/indexable";
import { PUBLIC_BUSINESS } from "@/lib/search-where";

/** Records per file: 2,000 x 7 locales = 14,000 URLs, far below the protocol limit of 50,000. */
export const CHUNK = 2000;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Record_ = { path: string; at?: Date };

/** One <url> per locale, each listing every alternate (itself included) and x-default, as Google's hreflang sitemap spec requires. */
export function urlset(records: Record_[], origin = siteOrigin()): string {
  const urls = records.flatMap((r) => {
    const alternates = [
      ...LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${LOCALE_META[l].htmlLang}" href="${esc(`${origin}/${l}${r.path}`)}"/>`),
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${origin}/${DEFAULT_LOCALE}${r.path}`)}"/>`,
    ].join("");
    return LOCALES.map((l) => `<url><loc>${esc(`${origin}/${l}${r.path}`)}</loc>${r.at ? `<lastmod>${r.at.toISOString()}</lastmod>` : ""}${alternates}</url>`);
  });
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`;
}

export function sitemapIndex(files: string[], origin = siteOrigin()): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files.map((f) => `<sitemap><loc>${esc(`${origin}/sitemaps/${f}`)}</loc></sitemap>`).join("")}</sitemapindex>`;
}

/** Entries of a content section that belong in the index: published, jobs not expired. Past events stay (their pages stay reachable). */
const listed = (section: ContentSection) => ({ sectionKey: section, status: "published", deletedAt: null, ...(section === "jobs" ? { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] } : {}) });

const chunks = (count: number) => Math.max(1, Math.ceil(count / CHUNK));

/** File names the index lists. Without a database the static file alone is listed (a crawl still works). */
export async function sitemapFiles(): Promise<string[]> {
  try {
    const on = CONTENT_SECTIONS.filter((k) => sectionEnabled(k));
    const [b, s, ...content] = await Promise.all([
      prisma.business.count({ where: { status: "published", deletedAt: null } }),
      prisma.service.count({ where: { status: "published", deletedAt: null, business: { status: "published", deletedAt: null } } }),
      ...on.map((k) => prisma.listing.count({ where: listed(k) })),
    ]);
    const files = (name: string, count: number) => (count ? Array.from({ length: chunks(count) }, (_, i) => `${name}-${i + 1}.xml`) : []);
    return ["pages.xml", ...files("businesses", b), ...files("services", s), ...on.flatMap((k, i) => files(k, content[i]))];
  } catch {
    return ["pages.xml"];
  }
}

/**
 * Sections whose index page is a list: listed only while it has something to show (the same check as the page's
 * robots metadata, src/lib/indexable.ts), so the sitemap never submits a URL that answers noindex.
 */
async function listSectionHasContent(key: string): Promise<boolean> {
  if (key === "businesses") return hasPublicBusinesses();
  if (key === "services") return hasPublicServices();
  if (isContentSection(key)) return hasPublishedEntries(key);
  return true;
}

/**
 * Ids of the categories whose page lists at least one published business: a business's own category or the category
 * of one of its published services, and every ancestor of those (a category page includes its sub-categories).
 */
async function categoriesWithBusinesses(rows: { id: string; parentId: string | null }[]): Promise<Set<string>> {
  const [own, viaServices] = await Promise.all([
    prisma.business.groupBy({ by: ["categoryId"], where: { ...PUBLIC_BUSINESS, categoryId: { not: null } } }),
    prisma.service.groupBy({ by: ["categoryId"], where: { status: "published", deletedAt: null, business: PUBLIC_BUSINESS, categoryId: { not: null } } }),
  ]);
  const used = new Set([...own, ...viaServices].map((r) => r.categoryId).filter((id): id is string => Boolean(id)));
  return new Set(rows.filter((c) => descendantIds(rows, c.id).some((id) => used.has(id))).map((c) => c.id));
}

/** Records of one sitemap file, or null when the file name is not one of ours. */
export async function sitemapRecords(file: string): Promise<Record_[] | null> {
  if (file === "pages.xml") {
    const sections = sectionsFor("sitemap");
    const hasContent = await Promise.all(sections.map((s) => listSectionHasContent(s.key)));
    const fixed: Record_[] = sections.filter((_, i) => hasContent[i]).map((s) => ({ path: s.path }));
    try {
      const [categories, cities, combos, pages] = await Promise.all([
        prisma.category.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, parentId: true, slug: true, updatedAt: true } }),
        // Only cities with at least one published business: an empty city page is noindex (about 2,000 German cities
        // are in the gazetteer; listing all of them made pages.xml 14,000+ URLs and ~13 MB, rendered per request).
        prisma.city.findMany({
          where: { isActive: true, slug: { not: null }, locations: { some: { status: "active", deletedAt: null, business: PUBLIC_BUSINESS } } },
          select: { slug: true, updatedAt: true },
        }),
        // City x category pages only where something is listed: no thin, empty pages in the index.
        prisma.$queryRaw<{ city: string; category: string }[]>`
          SELECT DISTINCT c."slug" AS city, k."slug" AS category
          FROM "Business" b
          JOIN "Location" l ON l."businessId" = b."id" AND l."isPrimary" = true AND l."deletedAt" IS NULL AND l."status" = 'active'
          JOIN "City" c ON c."id" = l."cityId" AND c."slug" IS NOT NULL AND c."isActive" = true
          JOIN "Category" k ON k."id" = b."categoryId" AND k."isActive" = true AND k."deletedAt" IS NULL
          WHERE b."status" = 'published' AND b."deletedAt" IS NULL LIMIT 5000`,
        prisma.page.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true } }),
      ]);
      const withBusinesses = await categoriesWithBusinesses(categories);
      return [
        ...fixed,
        ...categories.filter((c) => withBusinesses.has(c.id)).map((c) => ({ path: `/businesses/${c.slug}`, at: c.updatedAt })),
        ...cities.map((c) => ({ path: `/city/${c.slug}`, at: c.updatedAt })),
        ...combos.map((c) => ({ path: `/city/${c.city}/${c.category}` })),
        ...pages.map((p) => ({ path: `/p/${p.slug}`, at: p.updatedAt })),
      ];
    } catch {
      return fixed; // database unavailable: still serve the static routes rather than failing the crawl
    }
  }
  const m = /^(businesses|services|jobs|events|guides)-(\d{1,4})\.xml$/.exec(file);
  if (!m) return null;
  const skip = (Number(m[2]) - 1) * CHUNK;
  try {
    if (isContentSection(m[1])) {
      if (!sectionEnabled(m[1])) return null;
      const rows = await prisma.listing.findMany({ where: listed(m[1]), select: { slug: true, updatedAt: true }, orderBy: { id: "asc" }, skip, take: CHUNK });
      return rows.map((r) => ({ path: `/${m[1]}/${r.slug}`, at: r.updatedAt }));
    }
    if (m[1] === "businesses") {
      const rows = await prisma.business.findMany({ where: { status: "published", deletedAt: null }, select: { slug: true, updatedAt: true }, orderBy: { id: "asc" }, skip, take: CHUNK });
      return rows.map((b) => ({ path: `/business/${b.slug}`, at: b.updatedAt }));
    }
    const rows = await prisma.service.findMany({ where: { status: "published", deletedAt: null, business: { status: "published", deletedAt: null } }, select: { slug: true, updatedAt: true, business: { select: { slug: true } } }, orderBy: { id: "asc" }, skip, take: CHUNK });
    return rows.map((s) => ({ path: `/services/${s.business.slug}/${s.slug}`, at: s.updatedAt }));
  } catch {
    return [];
  }
}
