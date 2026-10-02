/**
 * Glossary of the key terms of the site in every language: ONE word per concept, used in navigation, page titles,
 * filters and buttons alike. The message catalogues (src/messages/*.json) must use exactly these words at the places
 * listed in GLOSSARY_KEYS; tests/glossary.test.ts fails when they drift (e.g. "بازاڕ" in one menu and "بازرگانییەکان"
 * in another). To rename a concept, change it here and in the listed message keys together.
 *
 * Language labels: Kurdish Sorani is "کوردیی ناوەندی", Kurdish Kurmanji is shown as "Kurmancî (Badînî)" (config/locales.ts).
 */
import type { Locale } from "./locales";

export type GlossaryTerm = "businesses" | "services" | "locations" | "nearby" | "assistant" | "categories" | "forBusiness";

export const GLOSSARY: Record<GlossaryTerm, Record<Locale, string>> = {
  businesses: { ckb: "بازرگانییەکان", kmr: "Karsazî", de: "Unternehmen", en: "Businesses", ar: "الشركات", fa: "کسب‌وکارها", tr: "İşletmeler" },
  services: { ckb: "خزمەتگوزارییەکان", kmr: "Xizmet", de: "Dienstleistungen", en: "Services", ar: "الخدمات", fa: "خدمات", tr: "Hizmetler" },
  locations: { ckb: "شوێنەکان", kmr: "Cih", de: "Standorte", en: "Locations", ar: "المواقع", fa: "مکان‌ها", tr: "Konumlar" },
  nearby: { ckb: "نزیک", kmr: "Nêzîk", de: "In der Nähe", en: "Nearby", ar: "بالقرب مني", fa: "نزدیک من", tr: "Yakınımda" },
  assistant: { ckb: "یاریدەدەری REGA", kmr: "Alîkarê REGA", de: "REGA-Assistent", en: "REGA Assistant", ar: "مساعد REGA", fa: "دستیار REGA", tr: "REGA Asistanı" },
  categories: { ckb: "پۆلەکان", kmr: "Kategorî", de: "Kategorien", en: "Categories", ar: "الفئات", fa: "دسته‌بندی‌ها", tr: "Kategoriler" },
  forBusiness: { ckb: "بۆ بازرگانان", kmr: "Ji bo karsazan", de: "Für Unternehmen", en: "For businesses", ar: "للأعمال", fa: "برای کسب‌وکارها", tr: "İşletmeler için" },
};

/** Message keys that must equal the glossary term (dot path in the catalogue). `nearby` has a longer page title ("نزیکی من"), so only the nav label is bound. */
export const GLOSSARY_KEYS: Record<GlossaryTerm, string[]> = {
  businesses: ["nav.businesses", "businesses.title"],
  services: ["nav.services", "services.title"],
  locations: ["nav.locations", "locations.title"],
  nearby: ["nav.nearby"],
  assistant: ["nav.ai", "ai.title"],
  categories: ["nav.categories", "categories.title"],
  forBusiness: ["nav.forBusiness", "forBusiness.title"],
};
