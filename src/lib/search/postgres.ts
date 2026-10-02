/**
 * Postgres implementation of the search service. Retrieval over the published listings of every section that is
 * enabled and flagged `assistant` in the section registry (config/sections.ts) and has a retriever below. A section
 * registered later automatically takes part as soon as its retriever is added here: no other code changes.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { localizeText } from "@/lib/content";
import { sectionsFor } from "@/config/sections";
import { BEST_RE, VERIFIED_RE, queryTerms } from "@/lib/ai/query";
import type { Locale } from "@/config/locales";
import { contentRetriever } from "@/features/content/retriever";
import type { RetrieverKey } from "./retriever-keys";
import type { ParsedQuery, SearchHit, SearchRequest, SearchService, SectionRetriever } from "./types";

const cityNames = { select: { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true } } as const;
const categoryNames = { select: { nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } } as const;

export function parseQuery(text: string): ParsedQuery {
  return { terms: queryTerms(text), best: BEST_RE.test(text), verifiedOnly: VERIFIED_RE.test(text) };
}

const scoreOf = (terms: string[][], text: string) => terms.filter((variants) => variants.some((v) => text.includes(v))).length;

const businesses: SectionRetriever = {
  promptHeading: "BUSINESSES",
  async retrieve({ terms, best, verifiedOnly }, locale) {
    if (terms.length === 0 && !verifiedOnly) return [];
    const anyTerm = terms.flat().map((v) => ({ searchText: { contains: v } }));
    const rows = await prisma.business.findMany({
      where: { status: "published", deletedAt: null, ...(verifiedOnly ? { verified: true } : {}), ...(anyTerm.length ? { OR: anyTerm } : {}) },
      select: {
        slug: true, id: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, searchText: true, verified: true, ratingAvg: true, ratingCount: true,
        category: categoryNames,
        locations: { where: { isPrimary: true, deletedAt: null, status: "active" }, take: 1, select: { addressLine1: true, city: cityNames } },
      },
      take: 40,
      orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }],
    });
    return rows
      .map((b) => ({ b, s: scoreOf(terms, b.searchText) }))
      .filter((r) => r.s > 0 || terms.length === 0)
      .sort((x, y) => y.s - x.s || (best ? (y.b.ratingCount > 0 ? y.b.ratingAvg : -1) - (x.b.ratingCount > 0 ? x.b.ratingAvg : -1) : 0))
      .slice(0, 8)
      .map<SearchHit>(({ b, s }) => {
        const loc = b.locations[0];
        const city = loc?.city ? localizeText({ ...loc.city, name: loc.city.nameEn }, "name", locale) : "";
        const category = b.category ? localizeText({ ...b.category, name: b.category.nameDe }, "name", locale) : "";
        const title = localizeText(b, "name", locale);
        const url = `/${locale}/business/${b.slug}`;
        const rating = b.ratingCount > 0 ? `rating ${b.ratingAvg.toFixed(1)}/5 (${b.ratingCount} reviews)` : "no ratings yet";
        return {
          section: "businesses", id: b.id, title, subtitle: [category, city].filter(Boolean).join(" · ") || undefined, url, verified: b.verified, score: s,
          context: `- ${title}${category ? ` — ${category}` : ""}${loc ? ` — ${loc.addressLine1}${city ? `, ${city}` : ""}` : ""} — ${rating}${b.verified ? " — verified" : ""} — link: ${url}`,
        };
      });
  },
};

const services: SectionRetriever = {
  promptHeading: "SERVICES",
  async retrieve({ terms }, locale) {
    if (terms.length === 0) return [];
    const anyTerm = terms.flat().map((v) => ({ searchText: { contains: v } }));
    const rows = await prisma.service.findMany({
      where: { status: "published", deletedAt: null, business: { status: "published", deletedAt: null }, OR: anyTerm },
      select: {
        id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, searchText: true, priceFrom: true, priceTo: true, currency: true,
        business: { select: { slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, verified: true } },
      },
      take: 40,
    });
    return rows
      .map((s) => ({ s, n: scoreOf(terms, s.searchText) }))
      .filter((r) => r.n > 0)
      .sort((x, y) => y.n - x.n)
      .slice(0, 8)
      .map<SearchHit>(({ s, n }) => {
        // A price is the business's own information about its service; it is only passed on when it exists.
        const price = s.priceFrom != null ? `${s.priceFrom.toString()}${s.priceTo != null ? `–${s.priceTo.toString()}` : ""} ${s.currency}` : "price on request";
        const title = localizeText(s, "name", locale);
        const provider = localizeText(s.business, "name", locale);
        const url = `/${locale}/services/${s.business.slug}/${s.slug}`;
        return { section: "services", id: s.id, title, subtitle: provider, url, verified: s.business.verified, score: n, context: `- ${title} — ${provider} — ${price} — link: ${url}` };
      });
  },
};

/** Section key -> retriever. A section without an entry is skipped (it is not searchable yet). */
export const RETRIEVERS: Record<RetrieverKey, SectionRetriever> = { businesses, services, jobs: contentRetriever("jobs"), events: contentRetriever("events"), guides: contentRetriever("guides") };

export const postgresSearch: SearchService = {
  async search({ text, locale, limit = 12 }: SearchRequest): Promise<SearchHit[]> {
    const query = parseQuery(text);
    const active = sectionsFor("assistant").filter((s) => s.key in RETRIEVERS);
    const lists = await Promise.all(active.map((s) => RETRIEVERS[s.key as RetrieverKey].retrieve(query, locale as Locale)));
    // Keep each section's own ranking, interleave sections so a long list of one never hides the others.
    const merged: SearchHit[] = [];
    for (let i = 0; merged.length < limit && lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length && merged.length < limit) merged.push(l[i]);
    return merged;
  },
};

/** The configured search service (Postgres today; swap here to change the engine). */
export const searchService: SearchService = postgresSearch;

/** Grounding block for the AI prompt, grouped by section heading. */
export function contextOf(hits: SearchHit[]): string {
  const bySection = new Map<string, SearchHit[]>();
  for (const h of hits) bySection.set(h.section, [...(bySection.get(h.section) ?? []), h]);
  return [...bySection.entries()].flatMap(([section, list]) => [`${(RETRIEVERS as Record<string, SectionRetriever>)[section]?.promptHeading ?? section.toUpperCase()}:`, ...list.map((h) => h.context)]).join("\n").slice(0, 6000);
}
