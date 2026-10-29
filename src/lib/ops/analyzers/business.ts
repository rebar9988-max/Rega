/**
 * AGENT 01 — Business Inspector (pure analysis). Inspects submissions and listings; it NEVER approves, rejects,
 * publishes or edits a business: moderation stays with the owner in /dr/businesses.
 */
import { check } from "../core";
import type { Check, FindingItem, Inspection } from "../types";
import { normalizeSearch } from "@/lib/text";
import { safeHttpUrl } from "@/lib/urls";
import { isStoredWhatsapp } from "@/lib/whatsapp";

export type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  categoryId: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  updatedAt: Date;
  category: { isActive: boolean; deletedAt: Date | null; sectionKey: string } | null;
  locations: {
    isPrimary: boolean;
    addressLine1: string;
    countryCode: string;
    cityId: string | null;
    latitude: number | null;
    longitude: number | null;
    coordsVerifiedAt: Date | null;
    city: { isActive: boolean; country: { code: string } } | null;
  }[];
};

const STALE_PENDING_DAYS = 7;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?$)/i;

const item = (b: BusinessRow): FindingItem => ({ label: b.slug, href: `/dr/businesses/${b.id}` });
const digits = (v: string | null) => (v ?? "").replace(/\D/g, "");
const host = (v: string | null) => { const u = safeHttpUrl(v); return u ? new URL(u).hostname.replace(/^www\./, "").toLowerCase() : null; };

/** Groups of two or more listings sharing a key; each group is reported once. */
function duplicates(rows: BusinessRow[], key: (b: BusinessRow) => string | null): FindingItem[] {
  const groups = new Map<string, BusinessRow[]>();
  for (const b of rows) {
    const k = key(b);
    if (k) groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => ({ label: g.map((b) => b.slug).join(" ⇄ "), href: `/dr/businesses/${g[0].id}` }));
}

export function analyzeBusinesses(rows: BusinessRow[], now: Date): Inspection {
  const pending = rows.filter((b) => b.status === "pending");
  const checks: Check[] = [];
  const primary = (b: BusinessRow) => b.locations.find((l) => l.isPrimary) ?? b.locations[0] ?? null;

  checks.push(pending.length
    ? check.info("business.pending_queue", `${pending.length} داواکاری چاوەڕێی پێداچوونەوەی خاوەنن (بە خۆکار پەسەند یان ڕەت ناکرێنەوە).`, { count: pending.length, items: pending.map(item), action: "داواکارییەکان لە /dr/businesses?status=pending ببینە و خۆت بڕیار بدە." })
    : check.pass("business.pending_queue", "هیچ داواکارییەکی چاوەڕوانکراو نییە."));

  const stale = pending.filter((b) => now.getTime() - b.updatedAt.getTime() > STALE_PENDING_DAYS * 86_400_000);
  checks.push(check.items("business.pending_stale", stale.map(item), "warn", `${stale.length} داواکاری زیاتر لە ${STALE_PENDING_DAYS} ڕۆژە چاوەڕێن.`, "هیچ داواکارییەک زۆر کۆن نییە.", "داواکارییە کۆنەکان یەکەم جار پێداچوونەوە بکە."));

  const incomplete = pending.filter((b) => {
    const loc = primary(b);
    const contact = Boolean(b.phone || b.email || b.whatsapp || b.website);
    return b.name.trim().length < 2 || !b.categoryId || !loc || !loc.addressLine1.trim() || !loc.cityId || !contact;
  });
  checks.push(check.items("business.required_info", incomplete.map(item), "warn", `${incomplete.length} داواکاری زانیاریی پێویستیان کەمە (ناو، پۆل، ناونیشان، شار یان پەیوەندی).`, "هەموو داواکارییەکان زانیاریی پێویستیان هەیە.", "پێش بڕیاردان، زانیاریی کەم لە خاوەنی بازرگانییەکە داوا بکە."));

  const live = rows.filter((b) => b.status !== "archived");
  const dup = [
    ...duplicates(live, (b) => { const c = primary(b)?.cityId; const n = normalizeSearch(b.name); return n && c ? `n:${n}|${c}` : null; }),
    ...duplicates(live, (b) => { const d = digits(b.phone); return d.length >= 7 ? `p:${d.slice(-9)}` : null; }),
    ...duplicates(live, (b) => { const d = digits(b.whatsapp); return d.length >= 7 ? `w:${d}` : null; }),
    ...duplicates(live, (b) => { const h = host(b.website); return h && !/(facebook|instagram|tiktok|linktr)\./.test(h) ? `h:${h}` : null; }),
  ];
  const dupUnique = [...new Map(dup.map((d) => [d.label, d])).values()];
  checks.push(check.items("business.probable_duplicates", dupUnique, "warn", `${dupUnique.length} گرووپی ڕەنگە دووبارە دۆزرایەوە (هەمان ناو و شار، ژمارە یان ماڵپەڕ).`, "هیچ بازرگانییەکی دووبارە نەدۆزرایەوە.", "گرووپەکان بەراورد بکە؛ هیچ شتێک بە خۆکار یەک ناخرێت یان ناسڕدرێتەوە."));

  const badCategory = live.filter((b) => !b.category || !b.category.isActive || b.category.deletedAt || b.category.sectionKey !== "businesses");
  checks.push(check.items("business.category_assignment", badCategory.map(item), "warn", `${badCategory.length} بازرگانی پۆلیان نییە یان پۆلەکەیان ناچالاکە.`, "هەموو بازرگانییەکان پۆلێکی چالاکیان هەیە.", "پۆلی دروست بۆ ئەم بازرگانییانە دیاری بکە."));

  const wrongCountry = live.filter((b) => b.locations.some((l) => l.city && l.city.country.code !== l.countryCode));
  checks.push(check.items("business.country_city", wrongCountry.map(item), "fail", `${wrongCountry.length} شوێن شارەکەیان سەر بە وڵاتێکی ترە.`, "پەیوەندیی وڵات و شار لە هەموو شوێنەکاندا دروستە.", "شار یان وڵاتی شوێنەکە ڕاست بکەرەوە."));

  const inactiveCity = live.filter((b) => b.locations.some((l) => l.city && !l.city.isActive));
  checks.push(check.items("business.inactive_city", inactiveCity.map(item), "warn", `${inactiveCity.length} بازرگانی لە شارێکی ناچالاکدان.`, "هیچ بازرگانییەک لە شارێکی ناچالاکدا نییە.", "شارەکە چالاک بکە یان شوێنی بازرگانییەکە نوێ بکەرەوە."));

  const badCoords = live.filter((b) => b.locations.some((l) => l.latitude != null && l.longitude != null && (Math.abs(l.latitude) > 90 || Math.abs(l.longitude) > 180 || (l.latitude === 0 && l.longitude === 0))));
  checks.push(check.items("business.coordinates", badCoords.map(item), "fail", `${badCoords.length} شوێن هاوڕێکخەری نادروستیان هەیە.`, "هاوڕێکخەرەکان لە سنووری دروستدان.", "نیشانەی سەر نەخشە دووبارە دابنێ."));

  const unverified = pending.filter((b) => { const l = primary(b); return l && l.latitude != null && !l.coordsVerifiedAt; });
  checks.push(check.items("business.coords_unverified", unverified.map(item), "warn", `${unverified.length} داواکاری شوێنی نەخشەیان پشتڕاست نەکراوەتەوە (بۆ بڵاوکردنەوە پێویستە).`, "شوێنی نەخشەی داواکارییەکان پشتڕاستکراوەن.", "شوێنی نەخشە پشتڕاست بکەرەوە پێش بڵاوکردنەوە."));

  const badLinks = live.filter((b) => {
    if (b.website) {
      const u = safeHttpUrl(b.website);
      if (!u || PRIVATE_HOST.test(new URL(u).hostname)) return true;
    }
    if (b.email && !EMAIL.test(b.email.trim())) return true;
    if (b.whatsapp && !isStoredWhatsapp(b.whatsapp)) return true;
    return false;
  });
  checks.push(check.items("business.links", badLinks.map(item), "warn", `${badLinks.length} بازرگانی ماڵپەڕ، ئیمەیڵ یان واتسئەپی نادروستیان هەیە.`, "ماڵپەڕ، ئیمەیڵ و واتسئەپ لە شێوەی دروستدان.", "بەستەرە نادروستەکان ڕاست بکەرەوە."));

  const insecure = live.filter((b) => b.website && safeHttpUrl(b.website)?.startsWith("http:"));
  checks.push(insecure.length
    ? check.info("business.links_http", `${insecure.length} ماڵپەڕ بە http (نەک https) تۆمارکراون.`, { count: insecure.length, items: insecure.map(item) })
    : check.pass("business.links_http", "هەموو ماڵپەڕەکان https ن یان نییانە."));

  return { inspected: rows.length, checks, evidence: [`D1 Business+Location+Category: ${rows.length} rows (bounded)`, "decision: none — read-only, no approval or rejection"] };
}
