/**
 * AGENT 07 — Translation Inspector (pure analysis over the bundled message catalogues and the locale registry).
 * Inspects every locale the platform actually registers (config/locales.ts): nothing is added, removed or published.
 */
import { check } from "../core";
import type { Check, Inspection } from "../types";

type Catalog = Record<string, unknown>;
export type LocaleInfo = { code: string; dir: "rtl" | "ltr"; script: "arab" | "latn" };

export function flatten(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Catalog)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (typeof value === "string") {
    out[prefix] = value;
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  }
  return out;
}

/** ICU argument names used by a message ({name}, {count, plural, …}) and rich-text tags (<b>…</b>). */
export function placeholders(message: string): string[] {
  const args = [...message.matchAll(/\{\s*([A-Za-z_][\w]*)\s*(?:[,}])/g)].map((m) => m[1]);
  const tags = [...message.matchAll(/<\/?([A-Za-z][\w]*)>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...args, ...tags])].sort();
}

const ARABIC = /[؀-ۿ]/;
const LETTER = /\p{L}/u;
/** Above this share of identical-to-English texts a non-English catalogue is reported (brand names are shared). */
export const UNTRANSLATED_WARN_RATIO = 0.25;

export function analyzeTranslations(input: { reference: string; locales: LocaleInfo[]; defaultLocale: string; catalogs: Record<string, Catalog> }): Inspection {
  const flat = Object.fromEntries(Object.entries(input.catalogs).map(([l, c]) => [l, flatten(c)]));
  const ref = flat[input.reference] ?? {};
  const refKeys = Object.keys(ref);
  const en = flat.en ?? {};
  const checks: Check[] = [];
  const codes = input.locales.map((l) => l.code);

  const unregistered = codes.filter((c) => !flat[c]);
  checks.push(check.items("translation.catalog_present", unregistered.map((label) => ({ label })), "fail", `${unregistered.length} زمانی تۆمارکراو فایلی وەرگێڕانیان نییە.`, `هەموو ${codes.length} زمانە تۆمارکراوەکان فایلی وەرگێڕانیان هەیە.`, "فایلی src/messages/<locale>.json زیاد بکە."));
  checks.push(codes.includes(input.defaultLocale)
    ? check.pass("translation.default_locale", `زمانی سەرەکی (${input.defaultLocale}) تۆمارکراوە.`)
    : { code: "translation.default_locale", result: "fail", message: "زمانی سەرەکی لە لیستی زمانەکاندا نییە." });

  const missing: { label: string }[] = [];
  const extra: { label: string }[] = [];
  const empty: { label: string }[] = [];
  const placeholderMismatch: { label: string }[] = [];
  const untranslated: { label: string; ratio: number }[] = [];
  const wrongScript: { label: string }[] = [];
  for (const loc of input.locales) {
    const cat = flat[loc.code];
    if (!cat) continue;
    const m = refKeys.filter((k) => !(k in cat));
    if (m.length) missing.push({ label: `${loc.code}: ${m.length} (${m.slice(0, 3).join(", ")}${m.length > 3 ? ", …" : ""})` });
    const x = Object.keys(cat).filter((k) => !(k in ref));
    if (x.length) extra.push({ label: `${loc.code}: ${x.length} (${x.slice(0, 3).join(", ")})` });
    const e = Object.entries(cat).filter(([k, v]) => !v.trim() && ref[k]?.trim());
    if (e.length) empty.push({ label: `${loc.code}: ${e.length} (${e.slice(0, 3).map(([k]) => k).join(", ")})` });
    const p = refKeys.filter((k) => k in cat && placeholders(cat[k]).join("|") !== placeholders(ref[k]).join("|"));
    if (p.length) placeholderMismatch.push({ label: `${loc.code}: ${p.slice(0, 4).join(", ")}${p.length > 4 ? ", …" : ""}` });
    if (loc.code !== "en") {
      const comparable = Object.entries(cat).filter(([k, v]) => en[k] && LETTER.test(v) && v.length > 3);
      const same = comparable.filter(([k, v]) => v === en[k]).length;
      const ratio = comparable.length ? same / comparable.length : 0;
      if (ratio > UNTRANSLATED_WARN_RATIO) untranslated.push({ label: `${loc.code}: ${Math.round(ratio * 100)}%`, ratio });
    }
    // RTL locales must actually be written in Arabic script (and LTR ones not), or the direction would be wrong.
    const texts = Object.values(cat).filter((v) => LETTER.test(v));
    const arabicShare = texts.length ? texts.filter((v) => ARABIC.test(v)).length / texts.length : 0;
    if ((loc.dir === "rtl") !== (loc.script === "arab") || (loc.dir === "rtl" && arabicShare < 0.6) || (loc.dir === "ltr" && arabicShare > 0.2)) wrongScript.push({ label: `${loc.code} (${loc.dir}, ${Math.round(arabicShare * 100)}% arab)` });
  }
  checks.push(check.items("translation.missing_keys", missing, "fail", `${missing.length} زمان کلیلی وەرگێڕانیان کەمە بەراورد بە ${input.reference}.`, `هەموو زمانەکان هەمان ${refKeys.length} کلیلیان هەیە.`, "کلیلە کەمەکان بە وەرگێڕانی پشتڕاستکراو زیاد بکە."));
  checks.push(check.items("translation.extra_keys", extra, "warn", `${extra.length} زمان کلیلی زیادەیان هەیە کە لە ${input.reference}دا نییە.`, "هیچ کلیلێکی زیادە نییە.", "کلیلە زیادەکان بپشکنە."));
  checks.push(check.items("translation.empty", empty, "warn", `${empty.length} زمان دەقی بەتاڵیان هەیە.`, "هیچ دەقێکی بەتاڵ نییە.", "دەقە بەتاڵەکان پڕ بکەرەوە."));
  checks.push(check.items("translation.placeholders", placeholderMismatch, "fail", `${placeholderMismatch.length} زمان گۆڕاوەکانی ({…}/<tag>) جیاوازن لە ${input.reference}.`, "گۆڕاوەکانی هەموو دەقەکان یەکسانن.", "گۆڕاوەکان وەک دەقی سەرەکی بنووسەرەوە."));
  checks.push(untranslated.length
    ? check.info("translation.untranslated", `${untranslated.length} زمان بەشێکی زۆری دەقەکانیان وەک ئینگلیزی ماونەتەوە.`, { count: untranslated.length, items: untranslated.map(({ label }) => ({ label })) })
    : check.pass("translation.untranslated", "هیچ زمانێک بەشی زۆری دەقەکانی وەرنەگێڕدراو نییە."));
  checks.push(check.items("translation.direction", wrongScript, "fail", `${wrongScript.length} زمان ئاراستەی (RTL/LTR) لەگەڵ نووسینەکەیدا ناگونجێت.`, "ئاراستەی RTL/LTRی هەموو زمانەکان لەگەڵ نووسینەکەیاندا دەگونجێت.", "script/dir لە src/config/locales.ts بپشکنە."));
  checks.push(check.info("translation.legal", "دەقی یاسایی بۆ زمانە نوێیەکان بە خۆکار بڵاو ناکرێتەوە؛ دەقی ئەڵمانی پابەندە.", {}));

  return {
    inspected: Object.values(flat).reduce((n, c) => n + Object.keys(c).length, 0),
    checks,
    evidence: [`bundled catalogues: ${Object.keys(flat).join(", ")}`, `reference: ${input.reference} (${refKeys.length} keys)`, "CI: tests/i18n.test.ts + tests/ops-agents.test.ts run the same parity on every push"],
  };
}
