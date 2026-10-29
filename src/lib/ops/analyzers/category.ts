/** AGENT 05 — Category Inspector (pure analysis). Never deletes, merges or edits a category. */
import { check } from "../core";
import type { Check, FindingItem, Inspection } from "../types";
import { normalizeSearch } from "@/lib/text";
import { MAX_CATEGORY_DEPTH, depthOf } from "@/lib/category-tree";

export type CategoryRow = {
  id: string;
  key: string;
  slug: string;
  parentId: string | null;
  sectionKey: string;
  isActive: boolean;
  deletedAt: Date | null;
  nameCkb: string;
  nameKmr: string | null;
  nameDe: string;
  nameEn: string | null;
  nameAr: string | null;
  nameFa: string | null;
  nameTr: string | null;
  translationLocales: string[];
  /** Publicly listed businesses whose primary category this is. */
  publicBusinesses: number;
};

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_COLUMNS = ["nameKmr", "nameEn", "nameAr", "nameFa", "nameTr"] as const;
/** Locales without a legacy name column: they show the English name unless a translation row exists. */
const ROW_LOCALES = ["fr", "sv", "nl", "it"] as const;

const item = (c: CategoryRow): FindingItem => ({ label: c.slug, href: `/dr/categories/${c.id}` });

export function analyzeCategories(rows: CategoryRow[]): Inspection {
  const live = rows.filter((c) => !c.deletedAt);
  const byId = new Map(live.map((c) => [c.id, c]));
  const checks: Check[] = [];

  const badSlug = live.filter((c) => !SLUG.test(c.slug));
  checks.push(check.items("category.slug_format", badSlug.map(item), "fail", `${badSlug.length} پۆل ناونیشانی URLی (slug) نادروستیان هەیە.`, "هەموو slugەکانی پۆل دروستن.", "slugی پۆلەکە بە پیتی بچووکی لاتینی و - ڕاست بکەرەوە."));

  const dupGroups = new Map<string, CategoryRow[]>();
  for (const c of live) for (const n of [c.nameCkb, c.nameDe, c.nameEn]) {
    const k = n && normalizeSearch(n);
    if (k) { const key = `${c.sectionKey}|${c.parentId ?? "-"}|${k}`; const g = dupGroups.get(key) ?? []; if (!g.includes(c)) dupGroups.set(key, [...g, c]); }
  }
  const dups = [...new Map([...dupGroups.values()].filter((g) => g.length > 1).map((g) => { const label = g.map((c) => c.slug).sort().join(" ⇄ "); return [label, { label, href: `/dr/categories/${g[0].id}` }]; })).values()];
  checks.push(check.items("category.duplicates", dups, "warn", `${dups.length} گرووپی پۆلی هاوناو لە هەمان ئاستدا دۆزرایەوە.`, "هیچ پۆلێکی دووبارە نییە.", "پۆلە هاوناوەکان بەراورد بکە؛ هیچ یەکخستنێک بە خۆکار ناکرێت."));

  const missingNames = live.filter((c) => c.isActive && NAME_COLUMNS.some((k) => !c[k]?.trim()));
  checks.push(missingNames.length
    ? { code: "category.localized_names", result: "warn", message: `${missingNames.length} پۆلی چالاک ناوی هەندێک زمانیان نییە (kmr/en/ar/fa/tr).`, count: missingNames.length, items: missingNames.map(item), action: "ناوە وەرگێڕدراوەکان لە /dr/categories زیاد بکە." }
    : check.pass("category.localized_names", "هەموو پۆلە چالاکەکان ناوی حەوت زمانی سەرەکییان هەیە."));

  const noRows = live.filter((c) => c.isActive && ROW_LOCALES.some((l) => !c.translationLocales.includes(l)));
  checks.push(noRows.length
    ? check.info("category.row_translations", `${noRows.length} پۆل بۆ fr/sv/nl/it ناوی ئینگلیزی پیشان دەدەن (وەرگێڕان نییە).`, { count: noRows.length })
    : check.pass("category.row_translations", "وەرگێڕانی fr/sv/nl/it بۆ هەموو پۆلەکان هەیە."));

  const orphan = live.filter((c) => c.parentId && !byId.has(c.parentId));
  checks.push(check.items("category.parent_missing", orphan.map(item), "fail", `${orphan.length} پۆل باوکی سڕاوە یان نییە.`, "هەموو پۆلە منداڵەکان باوکی دروستیان هەیە.", "باوکی پۆلەکە دووبارە دیاری بکە."));

  const nodes = live.map((c) => ({ id: c.id, parentId: c.parentId }));
  const tooDeep = live.filter((c) => depthOf(nodes, c.id) > MAX_CATEGORY_DEPTH);
  checks.push(check.items("category.tree_depth", tooDeep.map(item), "fail", `${tooDeep.length} پۆل لە درەختی پۆلەکاندا بازنە یان قووڵاییی زۆریان هەیە.`, "درەختی پۆلەکان بێ بازنەیە.", "پەیوەندیی باوک/منداڵ ڕاست بکەرەوە."));

  const hiddenParent = live.filter((c) => c.isActive && c.parentId && byId.get(c.parentId) && !byId.get(c.parentId)!.isActive);
  checks.push(check.items("category.inactive_parent", hiddenParent.map(item), "warn", `${hiddenParent.length} پۆلی چالاک لەژێر باوکێکی ناچالاکدان.`, "هیچ پۆلێکی چالاک لەژێر باوکی ناچالاکدا نییە.", "باوکەکە چالاک بکە یان پۆلەکە بگوازەرەوە."));

  const inactiveWithBusinesses = rows.filter((c) => (!c.isActive || c.deletedAt) && c.publicBusinesses > 0);
  checks.push(check.items("category.inactive_with_businesses", inactiveWithBusinesses.map(item), "warn", `${inactiveWithBusinesses.length} پۆلی ناچالاک بازرگانیی بڵاوکراوەیان پێوەیە.`, "هیچ بازرگانییەکی بڵاوکراو بە پۆلی ناچالاکەوە نییە.", "بازرگانییەکان بگوازەرەوە بۆ پۆلێکی چالاک."));

  const roots = live.filter((c) => c.isActive && c.sectionKey === "businesses");
  const empty = roots.filter((c) => c.publicBusinesses === 0 && !live.some((x) => x.parentId === c.id));
  checks.push(empty.length
    ? check.info("category.empty", `${empty.length} پۆلی چالاک هێشتا هیچ بازرگانییەکی بڵاوکراویان نییە.`, { count: empty.length, items: empty.map(item) })
    : check.pass("category.empty", "هەموو پۆلە چالاکەکان بازرگانییان هەیە."));

  return { inspected: rows.length, checks, evidence: [`D1 Category+CategoryTranslation: ${rows.length} rows`, "D1 Business groupBy categoryId (public listings only)"] };
}
