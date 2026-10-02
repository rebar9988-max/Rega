/**
 * Localization — the ONE place that lists the supported locales.
 * Routing, middleware, language switcher, hreflang, og:locale, sitemap, <html lang dir> and validation all read it.
 * Kurdish Sorani (ckb) is a first-class default locale, not a translation layer.
 *
 * Add a language: add its code to LOCALES, one entry to RAW_LOCALE_META and `src/messages/<code>.json`. Nothing else.
 */
export const LOCALES = ["ckb", "kmr", "de", "en", "ar", "fa", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ckb";


/**
 * Writing system of a locale's UI text. Direction is DERIVED from it (Arabic script => RTL),
 * so direction can never drift from the actual content of a message catalogue.
 * To add Arabic-script Badini later: add a locale with `script: "arab"`; nothing else changes.
 */
export type Script = "arab" | "latn";

export type LocaleMeta = {
  code: Locale;
  script: Script;
  /** Name in its own script */
  nativeName: string;
  /** Short code shown on the language switcher trigger */
  short: string;
  englishName: string;
  dir: "rtl" | "ltr";
  /** BCP-47 tag used for <html lang>, Intl.DateTimeFormat and Intl.NumberFormat */
  htmlLang: string;
  /** Digits rendering: Arabic-Indic for ar, extended Arabic-Indic for ckb/kmr */
  numberingSystem: "latn" | "arab" | "arabext";
  fontStack: string;
  dateFormat: string;
  currency: string;
  /** Order in which other languages' content is tried when a record has no text in this one. Omitted = DEFAULT_FALLBACKS. */
  fallbacks?: readonly Locale[];
};

type RawLocaleMeta = Omit<LocaleMeta, "dir">;

const RAW_LOCALE_META: Record<Locale, RawLocaleMeta> = {
  ckb: {
    code: "ckb",
    fallbacks: ["ar", "fa", "en", "de", "tr", "kmr"],
    short: "CKB",
    script: "arab",
    nativeName: "کوردیی ناوەندی",
    englishName: "Kurdish (Sorani)",
    htmlLang: "ckb-IQ",
    numberingSystem: "arabext",
    fontStack: "'Vazirmatn Variable', 'Segoe UI', Tahoma, sans-serif",
    dateFormat: "DD/MM/YYYY",
    currency: "IQD",
  },
  kmr: {
    code: "kmr",
    fallbacks: ["tr", "en", "de", "ckb", "ar", "fa"],
    short: "KU",
    script: "latn",
    nativeName: "Kurmancî (Badînî)",
    englishName: "Kurdish (Kurmanji/Badini)",
    // The kmr catalogue is Latin (Hawar) script, therefore LTR.
    htmlLang: "kmr-TR",
    numberingSystem: "latn",
    fontStack: "'Inter', 'Segoe UI', system-ui, sans-serif",
    dateFormat: "DD.MM.YYYY",
    currency: "EUR",
  },
  de: {
    code: "de",
    fallbacks: ["en", "tr", "ar", "fa", "ckb", "kmr"],
    short: "DE",
    script: "latn",
    nativeName: "Deutsch",
    englishName: "German",
    htmlLang: "de-DE",
    numberingSystem: "latn",
    fontStack: "'Inter', 'Segoe UI', system-ui, sans-serif",
    dateFormat: "DD.MM.YYYY",
    currency: "EUR",
  },
  en: {
    code: "en",
    fallbacks: ["de", "tr", "ar", "fa", "ckb", "kmr"],
    short: "EN",
    script: "latn",
    nativeName: "English",
    englishName: "English",
    htmlLang: "en",
    numberingSystem: "latn",
    fontStack: "'Inter', 'Segoe UI', system-ui, sans-serif",
    dateFormat: "DD/MM/YYYY",
    currency: "EUR",
  },
  ar: {
    code: "ar",
    fallbacks: ["fa", "ckb", "en", "de", "tr", "kmr"],
    short: "AR",
    script: "arab",
    nativeName: "العربية",
    englishName: "Arabic",
    htmlLang: "ar",
    numberingSystem: "arab",
    fontStack: "'Vazirmatn Variable', 'Segoe UI', Tahoma, sans-serif",
    dateFormat: "DD/MM/YYYY",
    currency: "EUR",
  },
  fa: {
    code: "fa",
    fallbacks: ["ar", "ckb", "en", "de", "tr", "kmr"],
    short: "FA",
    script: "arab",
    nativeName: "فارسی",
    englishName: "Persian (Farsi)",
    htmlLang: "fa-IR",
    numberingSystem: "arabext",
    fontStack: "'Vazirmatn Variable', 'Segoe UI', Tahoma, sans-serif",
    dateFormat: "YYYY/MM/DD",
    currency: "EUR",
  },
  tr: {
    code: "tr",
    fallbacks: ["kmr", "en", "de", "ar", "fa", "ckb"],
    short: "TR",
    script: "latn",
    nativeName: "Türkçe",
    englishName: "Turkish",
    htmlLang: "tr-TR",
    numberingSystem: "latn",
    fontStack: "'Inter', 'Segoe UI', system-ui, sans-serif",
    dateFormat: "DD.MM.YYYY",
    currency: "EUR",
  },
};

export const LOCALE_META: Record<Locale, LocaleMeta> = Object.fromEntries(
  Object.entries(RAW_LOCALE_META).map(([code, meta]) => [code, { ...meta, dir: meta.script === "arab" ? "rtl" : "ltr" }]),
) as Record<Locale, LocaleMeta>;

export const RTL_LOCALES: Locale[] = LOCALES.filter((l) => LOCALE_META[l].dir === "rtl");

export function dirOf(locale: string): "rtl" | "ltr" {
  return (LOCALE_META as Record<string, LocaleMeta>)[locale]?.dir ?? "ltr";
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function safeLocale(value: string | undefined | null): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Locale-aware date / number / currency formatting.
 * Formatting happens on the server; the client receives already-localized strings
 * so a missing font or ICU build on the device cannot break Kurdish output.
 */
export function formatDate(value: Date | string, locale: Locale, opts?: Intl.DateTimeFormatOptions) {
  const meta = LOCALE_META[locale];
  return new Intl.DateTimeFormat(`${meta.htmlLang}-u-nu-${meta.numberingSystem}`, {
    dateStyle: "medium",
    ...opts,
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatNumber(value: number, locale: Locale, opts?: Intl.NumberFormatOptions) {
  const meta = LOCALE_META[locale];
  return new Intl.NumberFormat(`${meta.htmlLang}-u-nu-${meta.numberingSystem}`, opts).format(value);
}

export function formatCurrency(value: number, locale: Locale, currency?: string) {
  const meta = LOCALE_META[locale];
  return new Intl.NumberFormat(`${meta.htmlLang}-u-nu-${meta.numberingSystem}`, {
    style: "currency",
    currency: currency ?? meta.currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Suffix of a locale's translation columns: ckb -> "Ckb" (nameCkb, descriptionCkb). */
export function localeSuffix(locale: string): string {
  return locale.charAt(0).toUpperCase() + locale.slice(1);
}

/** Other locales to try, in order, when content has no text in `locale`. A new locale falls back to en, de, then the rest. */
export function fallbackChain(locale: Locale): readonly Locale[] {
  const own = LOCALE_META[locale].fallbacks;
  if (own) return own;
  const preferred = (["en", "de"] as const).filter((l) => l !== locale);
  return [...preferred, ...LOCALES.filter((l) => l !== locale && !preferred.includes(l as "en" | "de"))];
}

/** `og:locale` value: "ckb-IQ" -> "ckb_IQ". */
export function ogLocale(locale: Locale): string {
  return LOCALE_META[locale].htmlLang.replace("-", "_");
}

/**
 * Locales that have `name<Locale>` columns on Country and City (English is the canonical `nameEn`). Any language added
 * later is stored in translation rows (CityTranslation, ...), so this list never needs to grow.
 */
export const COLUMN_NAME_LOCALES = ["ckb", "kmr", "de", "ar", "fa", "tr"] as const;
