/**
 * AGENT 08 — Content Inspector and AGENT 09 — Privacy-safe Analytics Inspector (pure analysis).
 * Content: publication state, missing translations, stale official guidance, missing source links and broken external
 * links. It never edits, unpublishes or "corrects" government information. Analytics: aggregated counts only.
 */
import { check } from "../core";
import type { Check, FindingItem, Inspection } from "../types";
import type { ProbeResult } from "../probe";
import type { SearchStats } from "@/lib/search-analytics-core";

export type ContentRow = {
  kind: "page" | "guide" | "job" | "event";
  id: string;
  slug: string;
  status: string;
  updatedAt: Date;
  locales: string[];
  /** Text of all translations (only scanned for links, never stored in the report). */
  text: string;
  /** Explicit link fields (applyUrl / infoUrl). */
  links: string[];
  expiresAt?: Date | null;
  endsAt?: Date | null;
};

/** Guidance older than this is flagged for a review against its official source (never changed automatically). */
export const STALE_CONTENT_DAYS = 365;
export const REQUIRED_CONTENT_LOCALES = ["ckb", "en"] as const;

export function externalLinks(rows: ContentRow[]): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.status !== "published") continue;
    for (const m of r.text.matchAll(/https?:\/\/[^\s)"'<>\]]+/g)) out.add(m[0].replace(/[.,;:!?]+$/, ""));
    for (const l of r.links) if (/^https?:\/\//.test(l)) out.add(l);
  }
  return [...out].filter((u) => !/^https?:\/\/(www\.)?rega24\.com\//.test(u));
}

const href = (r: ContentRow) => (r.kind === "page" ? `/dr/pages/${r.id}` : `/dr/content/${r.kind}s/${r.id}`);
const item = (r: ContentRow): FindingItem => ({ label: `${r.kind}:${r.slug}`, href: href(r) });

export function analyzeContent(rows: ContentRow[], linkResults: ProbeResult[], now: Date): Inspection {
  const published = rows.filter((r) => r.status === "published");
  const checks: Check[] = [];

  checks.push(check.info("content.publication", `${published.length} لە ${rows.length} پەڕە/ناوەڕۆک بڵاوکراونەتەوە.`, { count: published.length }));

  const missing = published.filter((r) => REQUIRED_CONTENT_LOCALES.some((l) => !r.locales.includes(l)));
  checks.push(check.items("content.translations", missing.map(item), "warn", `${missing.length} ناوەڕۆکی بڵاوکراو وەرگێڕانی ckb یان enیان نییە.`, "هەموو ناوەڕۆکە بڵاوکراوەکان وەرگێڕانی ckb و enیان هەیە.", "وەرگێڕانی پشتڕاستکراو زیاد بکە."));

  const stale = published.filter((r) => (r.kind === "page" || r.kind === "guide") && now.getTime() - r.updatedAt.getTime() > STALE_CONTENT_DAYS * 86_400_000);
  checks.push(check.items("content.stale", stale.map(item), "warn", `${stale.length} ڕێنمایی زیاتر لە ساڵێکە نوێ نەکراونەتەوە.`, "هیچ ڕێنماییەکی کۆن (زیاتر لە ساڵێک) نییە.", "لەگەڵ سەرچاوەی فەرمی بەراوردی بکە؛ هیچ زانیارییەکی حکومی بە خۆکار ناگۆڕدرێت."));

  const noSource = published.filter((r) => r.kind === "guide" && !/https?:\/\//.test(r.text) && !r.links.length);
  checks.push(check.items("content.sources", noSource.map(item), "warn", `${noSource.length} ڕێنمایی هیچ بەستەرێکی سەرچاوەی فەرمییان نییە.`, "هەموو ڕێنماییەکان سەرچاوەیان هەیە.", "بەستەری سەرچاوەی فەرمی زیاد بکە."));

  const expired = published.filter((r) => (r.kind === "job" && r.expiresAt && r.expiresAt < now) || (r.kind === "event" && r.endsAt && r.endsAt < now));
  checks.push(check.items("content.expired", expired.map(item), "warn", `${expired.length} کار/چالاکیی بەسەرچوو هێشتا بڵاوکراون.`, "هیچ کار یان چالاکییەکی بەسەرچوو بڵاونەکراوەتەوە.", "بیانخە ئەرشیف (بە دەست)."));

  const broken = linkResults.filter((p) => p.error !== "budget" && p.error !== "aborted" && (p.status === 0 || p.status >= 400) && p.status !== 403 && p.status !== 405 && p.status !== 429);
  const unchecked = linkResults.filter((p) => p.error === "budget" || p.error === "aborted").length;
  checks.push(linkResults.length
    ? check.items("content.broken_links", broken.map((p) => ({ label: `${p.url} → ${p.status || p.error}` })), "warn", `${broken.length} بەستەری دەرەکی شکاون.`, `${linkResults.length - unchecked} بەستەری دەرەکی پشکنران و کار دەکەن.`, "بەستەرەکە بە سەرچاوەی فەرمیی نوێ بگۆڕە.")
    : check.pass("content.broken_links", "هیچ بەستەرێکی دەرەکی بۆ پشکنین نییە."));

  return { inspected: rows.length, checks, evidence: [`D1 Page/PageTranslation, Listing/ListingTranslation: ${rows.length} rows`, ...linkResults.map((p) => `HTTP ${p.status || p.error} ${p.url}`)] };
}

export type AnalyticsFacts = {
  publicBusinesses: number;
  totalViews: number;
  viewsTop: { slug: string; views: number }[];
  activeCategories: number;
  categoriesWithBusinesses: number;
  citiesWithBusinesses: number;
  activeCities: number;
  undiscoverable: { slug: string; reason: "no_marker" | "inactive_city" | "no_category" }[];
  reviews: { approved: number; pending: number };
  aiRequests7d: number;
  openReports: number;
  /** Aggregated search counters of the last 7 UTC days (SearchQueryDaily: no user, session, IP or device), or null when unreadable. */
  searches: (SearchStats & { truncated: boolean }) | null;
};

/** Above this share of searches finding nothing (with at least ZERO_RESULT_MIN of them) discovery gaps are reported. */
export const ZERO_RESULT_WARN_RATIO = 0.3;
export const ZERO_RESULT_MIN = 5;

export function analyzeAnalytics(f: AnalyticsFacts): Inspection {
  const checks: Check[] = [];
  checks.push(check.info("analytics.listings", `${f.publicBusinesses} بازرگانیی گشتی، کۆی بینین ${f.totalViews}.`, { items: f.viewsTop.map((v) => ({ label: `${v.slug}: ${v.views}` })) }));
  const coverage = f.activeCategories ? Math.round((f.categoriesWithBusinesses / f.activeCategories) * 100) : 0;
  checks.push(coverage < 50
    ? { code: "analytics.category_coverage", result: "warn", message: `تەنها ${f.categoriesWithBusinesses} لە ${f.activeCategories} پۆلی چالاک بازرگانییان هەیە (${coverage}%).`, action: "بۆ پۆلە بەتاڵەکان بازرگانیی ڕاستەقینە بانگهێشت بکە؛ هیچ داتایەکی ساختە زیاد ناکرێت." }
    : check.pass("analytics.category_coverage", `${coverage}% ی پۆلە چالاکەکان بازرگانییان هەیە.`));
  checks.push(check.info("analytics.city_coverage", `${f.citiesWithBusinesses} لە ${f.activeCities} شاری چالاک بازرگانییان هەیە.`));
  checks.push(check.items("analytics.discovery_paths", f.undiscoverable.map((u) => ({ label: `${u.slug} (${u.reason})` })), "warn", `${f.undiscoverable.length} بازرگانیی گشتی لە نەخشە، شار یان پۆلدا ناگەیەنرێن.`, "هەموو بازرگانییە گشتییەکان لە نەخشە، شار و پۆلدا دەدۆزرێنەوە.", "شوێن، شار یان پۆلیان تەواو بکە."));
  checks.push(check.info("analytics.engagement", `هەڵسەنگاندن: ${f.reviews.approved} پەسەندکراو، ${f.reviews.pending} چاوەڕوان · داواکاریی AI (٧ ڕۆژ): ${f.aiRequests7d} · ڕاپۆرتی کراوە: ${f.openReports}.`));
  const s = f.searches;
  if (!s) checks.push(check.skip("analytics.zero_result_searches", "ئاماری گەڕان نەخوێنرایەوە (خشتەی SearchQueryDaily بەردەست نییە)."));
  else if (s.searches === 0) checks.push(check.info("analytics.zero_result_searches", `لە ${s.days} ڕۆژی ڕابردوودا هیچ گەڕانێک تۆمار نەکراوە.`));
  else {
    const ratio = s.zeroResults / s.searches;
    const items = s.missing.slice(0, 12).map((m) => ({ label: `${m.query}: ${m.zeroResults}` }));
    const message = `لە ${s.days} ڕۆژدا ${s.zeroResults} لە ${s.searches} گەڕان (${Math.round(ratio * 100)}%) هیچ ئەنجامێکیان نەبوو.`;
    checks.push(ratio > ZERO_RESULT_WARN_RATIO && s.zeroResults >= ZERO_RESULT_MIN
      ? { code: "analytics.zero_result_searches", result: "warn", message, count: s.zeroResults, items, action: "بۆ ئەم گەڕانانە بازرگانی یان پۆلی ڕاستەقینە زیاد بکە، یان وشەی هاوواتا؛ هیچ داتایەک بە خۆکار دروست ناکرێت." }
      : check.info("analytics.zero_result_searches", message, { count: s.zeroResults, items }));
  }
  return { inspected: f.publicBusinesses + f.activeCategories, checks, evidence: ["D1 aggregates only: Business(viewCount sum), Category, City, Review, AiUsageDaily, Report counts", `D1 SearchQueryDaily (7 days, existing counters; no personal data)${f.searches?.truncated ? " — read bounded, more rows exist" : ""}`, "no new tracking, no third-party analytics"] };
}
