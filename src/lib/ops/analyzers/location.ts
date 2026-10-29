/** AGENT 06 — Location Inspector (pure analysis). Never invents, moves or deletes a geographic record. */
import { check } from "../core";
import type { Check, FindingItem, Inspection } from "../types";
import { normalizeSearch } from "@/lib/text";
import { SLUG } from "./category";

export type CountryRow = { id: string; code: string; nameEn: string; isActive: boolean; latitude: number | null; longitude: number | null; missingNames: number };
export type RegionRow = { id: string; countryId: string; slug: string; nameEn: string; isActive: boolean; latitude: number | null; longitude: number | null };
export type CityRow = {
  id: string; countryId: string; regionId: string | null; slug: string | null; nameEn: string; isActive: boolean;
  latitude: number | null; longitude: number | null;
  /** Empty legacy name columns (ckb, kmr, de, fa, ar, tr). */
  missingNames: number;
};
export type BusinessLocationCounts = { published: number; missing: number; invalid: number; unverified: number };

/** A city further than this from its country's reference point is flagged for a manual look (never moved). */
export const MAX_CITY_DISTANCE_KM = 2_500;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const validCoord = (lat: number | null, lng: number | null) => lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const cityItem = (c: CityRow): FindingItem => ({ label: c.slug ?? c.nameEn });

export function analyzeLocations(input: { countries: CountryRow[]; regions: RegionRow[]; cities: CityRow[]; businesses: BusinessLocationCounts }): Inspection {
  const { countries, regions, cities, businesses } = input;
  const country = new Map(countries.map((c) => [c.id, c]));
  const region = new Map(regions.map((r) => [r.id, r]));
  const checks: Check[] = [];

  const badCodes = countries.filter((c) => !/^[A-Z]{2}$/.test(c.code));
  checks.push(check.items("location.country_code", badCodes.map((c) => ({ label: c.code })), "fail", `${badCodes.length} وڵات کۆدی ISOی نادروستیان هەیە.`, "کۆدی هەموو وڵاتەکان ISO 3166-1 alpha-2ن.", "کۆدی وڵاتەکە ڕاست بکەرەوە."));

  const regionOrphans = regions.filter((r) => !country.has(r.countryId));
  const cityCountryOrphans = cities.filter((c) => !country.has(c.countryId));
  const cityRegionMismatch = cities.filter((c) => c.regionId && (!region.has(c.regionId) || region.get(c.regionId)!.countryId !== c.countryId));
  const hierarchy = [...regionOrphans.map((r) => ({ label: `region:${r.slug}` })), ...cityCountryOrphans.map(cityItem), ...cityRegionMismatch.map(cityItem)];
  checks.push(check.items("location.hierarchy", hierarchy, "fail", `${hierarchy.length} تۆماری جوگرافی پەیوەندیی وڵات/هەرێم/شاریان تێکچووە.`, "پەیوەندیی وڵات ← هەرێم ← شار لە هەموو تۆمارەکاندا دروستە.", "هەرێم یان وڵاتی تۆمارەکە لە /dr/geography ڕاست بکەرەوە."));

  const noRegion = cities.filter((c) => c.isActive && !c.regionId);
  checks.push(noRegion.length
    ? check.info("location.city_without_region", `${noRegion.length} شاری چالاک هەرێمیان بۆ دیاری نەکراوە.`, { count: noRegion.length, items: noRegion.map(cityItem) })
    : check.pass("location.city_without_region", "هەموو شارە چالاکەکان هەرێمیان هەیە."));

  const dupGroups = new Map<string, CityRow[]>();
  for (const c of cities) { const k = `${c.regionId ?? c.countryId}|${normalizeSearch(c.nameEn)}`; dupGroups.set(k, [...(dupGroups.get(k) ?? []), c]); }
  const dups = [...dupGroups.values()].filter((g) => g.length > 1).map((g) => ({ label: g.map((c) => c.slug ?? c.nameEn).join(" ⇄ ") }));
  checks.push(check.items("location.duplicate_cities", dups, "warn", `${dups.length} گرووپی شاری هاوناو لە هەمان هەرێمدا دۆزرایەوە.`, "هیچ شارێکی دووبارە لە هەمان هەرێمدا نییە.", "شارە هاوناوەکان بەراورد بکە؛ هیچ شتێک بە خۆکار ناسڕدرێتەوە."));

  const badCoords = [...regions.filter((r) => (r.latitude != null || r.longitude != null) && !validCoord(r.latitude, r.longitude)).map((r) => ({ label: `region:${r.slug}` })),
    ...cities.filter((c) => (c.latitude != null || c.longitude != null) && !validCoord(c.latitude, c.longitude)).map(cityItem)];
  checks.push(check.items("location.invalid_coordinates", badCoords, "fail", `${badCoords.length} تۆمار هاوڕێکخەری نادروستیان هەیە.`, "هاوڕێکخەرەکان لە سنووری دروستدان.", "هاوڕێکخەری دروست لە سەرچاوەیەکی پشتڕاستکراوەوە دابنێ."));

  const far = cities.filter((c) => {
    const k = country.get(c.countryId);
    return k && validCoord(c.latitude, c.longitude) && validCoord(k.latitude, k.longitude) && distanceKm({ lat: c.latitude!, lng: c.longitude! }, { lat: k.latitude!, lng: k.longitude! }) > MAX_CITY_DISTANCE_KM;
  });
  checks.push(check.items("location.far_from_country", far.map(cityItem), "warn", `${far.length} شار زۆر دوورن لە خاڵی ناوەندی وڵاتەکەیان (ڕەنگە هاوڕێکخەر هەڵە بێت).`, "هاوڕێکخەری شارەکان لەگەڵ وڵاتەکەیان دەگونجێن.", "هاوڕێکخەری ئەم شارانە بە دەست پشتڕاست بکەرەوە."));

  const noCoords = cities.filter((c) => c.isActive && (c.latitude == null || c.longitude == null));
  checks.push(noCoords.length
    ? check.info("location.missing_coordinates", `${noCoords.length} شاری چالاک هاوڕێکخەریان نییە.`, { count: noCoords.length })
    : check.pass("location.missing_coordinates", "هەموو شارە چالاکەکان هاوڕێکخەریان هەیە."));

  const badSlug = cities.filter((c) => c.isActive && (!c.slug || !SLUG.test(c.slug)));
  checks.push(check.items("location.city_slug", badSlug.map(cityItem), "warn", `${badSlug.length} شاری چالاک slugی دروستیان نییە (/city/<slug>).`, "هەموو شارە چالاکەکان slugی دروستیان هەیە.", "slugی شارەکە لە /dr/geography دابنێ."));

  const hiddenParent = cities.filter((c) => c.isActive && ((c.regionId && region.get(c.regionId) && !region.get(c.regionId)!.isActive) || (country.get(c.countryId) && !country.get(c.countryId)!.isActive)));
  checks.push(check.items("location.inactive_parent", hiddenParent.map(cityItem), "warn", `${hiddenParent.length} شاری چالاک لەژێر هەرێم یان وڵاتێکی ناچالاکدان.`, "هیچ شارێکی چالاک لەژێر هەرێم/وڵاتی ناچالاکدا نییە.", "دۆخی چالاکیی هەرێم/وڵات بپشکنە."));

  const untranslated = cities.filter((c) => c.isActive && c.missingNames > 0).length + countries.filter((c) => c.isActive && c.missingNames > 0).length;
  checks.push(untranslated
    ? check.info("location.missing_translations", `${untranslated} وڵات/شاری چالاک ناوی هەندێک زمانیان نییە (ناوی ئینگلیزی پیشان دەدرێت).`, { count: untranslated })
    : check.pass("location.missing_translations", "هەموو شار و وڵاتە چالاکەکان ناوی هەموو زمانەکانیان هەیە."));

  const bizIssues = businesses.missing + businesses.invalid;
  checks.push(bizIssues
    ? { code: "location.business_markers", result: "warn", message: `${bizIssues} بازرگانی شوێنی نەخشەیان نییە یان نادروستە؛ ${businesses.unverified} پشتڕاست نەکراون.`, count: bizIssues, action: "لە /dr/businesses?loc=missing شوێنەکان دابنێ." }
    : check.pass("location.business_markers", `هەموو بازرگانییەکان شوێنی نەخشەیان هەیە (${businesses.unverified} پشتڕاست نەکراون).`));

  return {
    inspected: countries.length + regions.length + cities.length,
    checks,
    evidence: [`D1 Country: ${countries.length}, Region: ${regions.length}, City: ${cities.length} rows`, "D1 Business/Location counts (existing locationAudit)"],
  };
}
