/**
 * User-generated content localization.
 *
 * Records store translations as suffixed columns (name, nameCkb, nameKmr, nameAr, nameTr, description…).
 * `name` / `description` are the canonical text (language not guaranteed), the suffixed columns are
 * explicit translations. Different records have different subsets of columns, so lookups are tolerant.
 *
 * The result always says WHICH language the text is in, so the UI can set `lang` and `dir` on that
 * fragment. That is what keeps a Kurdish name readable inside a German page and vice versa,
 * and why nothing here depends on the page direction.
 */
import { LOCALE_META, fallbackChain, localeSuffix, type Locale } from "@/config/locales";


export type Localized = {
  text: string;
  /** BCP-47 language of `text`, or undefined when unknown (canonical column). */
  lang?: string;
  /** Explicit direction, or "auto" when the language is unknown so the browser decides per text. */
  dir: "rtl" | "ltr" | "auto";
  /** True when the requested locale had no translation. */
  fallback: boolean;
};

type Row = Record<string, unknown>;

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function localize(row: Row, field: string, locale: Locale): Localized {
  const direct = clean(row[field + localeSuffix(locale)]);
  if (direct) return { text: direct, lang: LOCALE_META[locale].htmlLang, dir: LOCALE_META[locale].dir, fallback: false };

  // The canonical column is the German/English source text for most records; treat it as
  // the requested language for de, otherwise as unknown-language text.
  const canonical = clean(row[field]);
  if (locale === "de" && canonical) return { text: canonical, dir: "auto", fallback: false };

  for (const other of fallbackChain(locale)) {
    const text = clean(row[field + localeSuffix(other)]);
    if (text) return { text, lang: LOCALE_META[other].htmlLang, dir: LOCALE_META[other].dir, fallback: true };
    if (other === "de" && canonical) return { text: canonical, dir: "auto", fallback: true };
  }
  return { text: canonical, dir: "auto", fallback: Boolean(canonical) };
}

/** Plain string for places that cannot carry lang/dir (metadata, aria-labels, JSON-LD). */
export function localizeText(row: Row, field: string, locale: Locale): string {
  return localize(row, field, locale).text;
}

/**
 * Display name of a country. Its own stored translation wins; a language without a stored name (fr, sv, nl, it, …) gets
 * the CLDR name of the ISO code from Intl.DisplayNames, so no country name has to be invented or stored for it; the
 * fallback chain of `localize` covers runtimes without that data.
 */
export function countryName(row: Row & { code: string }, locale: Locale): string {
  const own = clean(row["name" + localeSuffix(locale)]);
  if (own) return own;
  try {
    const cldr = new Intl.DisplayNames([LOCALE_META[locale].htmlLang], { type: "region", fallback: "none" }).of(row.code.toUpperCase());
    if (cldr) return cldr;
  } catch { /* no Intl region data: fall through */ }
  return localizeText({ ...row, name: row.nameEn }, "name", locale);
}

/** Flag emoji of an ISO 3166-1 alpha-2 code (two regional indicator letters); empty for anything else. */
export function countryFlag(code: string): string {
  return /^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";
}
