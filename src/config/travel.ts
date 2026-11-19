/**
 * Rega24Travel — the travel & transport discovery entry point (/travel).
 *
 * Not a second directory: it is a view over the ONE business directory, scoped to two existing top-level categories
 * (`travel-tickets`, `transport-moving`) and their sub-categories. The sub-categories below are ordinary Category rows
 * (managed, renamed, hidden and re-parented in /dr like any other); this list only seeds them once
 * (prisma/seed.ts, prisma/d1/data/20261118_travel_subcategories.sql) and is never written over admin edits.
 *
 * Pure module: no I/O, safe to import from server and client components.
 */

/** Existing top-level categories that make up Rega24Travel (prisma/seed-data/categories.ts). */
export const TRAVEL_ROOT_KEYS = ["travel-tickets", "transport-moving"] as const;
export type TravelRootKey = (typeof TRAVEL_ROOT_KEYS)[number];

export type TravelSubCategory = {
  key: string;
  parent: TravelRootKey;
  names: { ckb: string; kmr: string; de: string; en: string; ar: string; fa: string; tr: string };
};

/** The ten Rega24Travel sub-categories, in display order. Keys are also the slugs (/businesses/<key>). */
export const TRAVEL_SUBCATEGORIES: readonly TravelSubCategory[] = [
  { key: "travel-agencies", parent: "travel-tickets", names: { ckb: "نووسینگەکانی گەشت و گوزار", kmr: "Ajansên rêwîtiyê", de: "Reisebüros", en: "Travel Agencies", ar: "وكالات السفر", fa: "آژانس‌های مسافرتی", tr: "Seyahat Acenteleri" } },
  { key: "airlines-tickets", parent: "travel-tickets", names: { ckb: "کۆمپانیاکانی فڕۆکە و نووسینگەکانی بلیت", kmr: "Firokexane û ofîsên bilêtan", de: "Fluggesellschaften & Ticketbüros", en: "Airlines & Ticket Agencies", ar: "شركات الطيران ومكاتب التذاكر", fa: "شرکت‌های هواپیمایی و دفاتر بلیت", tr: "Havayolları ve Bilet Acenteleri" } },
  { key: "taxi-transfer", parent: "transport-moving", names: { ckb: "تاکسی و گواستنەوەی تایبەت", kmr: "Taksî û veguhastina taybet", de: "Taxi & Privattransfer", en: "Taxi & Private Transfer", ar: "تاكسي ونقل خاص", fa: "تاکسی و ترانسفر خصوصی", tr: "Taksi ve Özel Transfer" } },
  { key: "airport-transfer", parent: "transport-moving", names: { ckb: "گواستنەوەی فڕۆکەخانە", kmr: "Veguhastina balafirgehê", de: "Flughafentransfer", en: "Airport Transfer", ar: "النقل من وإلى المطار", fa: "ترانسفر فرودگاهی", tr: "Havalimanı Transferi" } },
  { key: "car-rental", parent: "transport-moving", names: { ckb: "کرێدانی ئۆتۆمبێل", kmr: "Kirêkirina otomobîlan", de: "Autovermietung", en: "Car Rental", ar: "تأجير السيارات", fa: "اجاره خودرو", tr: "Araç Kiralama" } },
  { key: "bus-companies", parent: "transport-moving", names: { ckb: "کۆمپانیاکانی پاس", kmr: "Şîrketên otobusan", de: "Busfirmen", en: "Bus Companies", ar: "شركات الحافلات", fa: "شرکت‌های اتوبوسرانی", tr: "Otobüs Firmaları" } },
  { key: "moving-services", parent: "transport-moving", names: { ckb: "گواستنەوەی ماڵ و کەلوپەل", kmr: "Barkirina malê", de: "Umzugsdienste", en: "Moving Services", ar: "خدمات نقل الأثاث", fa: "خدمات اسباب‌کشی", tr: "Evden Eve Nakliyat" } },
  { key: "cargo-logistics", parent: "transport-moving", names: { ckb: "باربری و گواستنەوەی کاڵا", kmr: "Kargo û lojîstîk", de: "Fracht & Logistik", en: "Cargo & Logistics", ar: "الشحن والخدمات اللوجستية", fa: "باربری و لجستیک", tr: "Kargo ve Lojistik" } },
  { key: "courier-delivery", parent: "transport-moving", names: { ckb: "گەیاندنی پاکەت و کاڵا", kmr: "Kurye û gihandin", de: "Kurier & Lieferdienste", en: "Courier & Delivery", ar: "البريد السريع والتوصيل", fa: "پیک و تحویل", tr: "Kurye ve Teslimat" } },
  { key: "vehicle-transport", parent: "transport-moving", names: { ckb: "گواستنەوەی ئۆتۆمبێل", kmr: "Veguhastina wesayîtan", de: "Fahrzeugtransport", en: "Vehicle Transport", ar: "نقل المركبات", fa: "حمل خودرو", tr: "Araç Taşıma" } },
];

type CategoryNode = { id: string; slug: string; parentId: string | null };

/**
 * Ids of every active category that belongs to Rega24Travel: the travel roots and all their descendants (any depth),
 * ordered roots first, then by tree order of the input. Works on the rows of `getCategories()`; empty when an admin
 * removed both roots (the page then shows its empty state, never another category's businesses).
 */
export function travelCategoryIds(categories: readonly CategoryNode[]): string[] {
  const roots = categories.filter((c) => (TRAVEL_ROOT_KEYS as readonly string[]).includes(c.slug));
  const ids = new Set(roots.map((c) => c.id));
  // Breadth-first over the flat list, bounded by its size (a broken parent loop cannot spin forever).
  for (let grew = true, i = 0; grew && i < categories.length; i++) {
    grew = false;
    for (const c of categories) if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); grew = true; }
  }
  return [...ids];
}

/** A `category` filter coming from the URL is honoured only when it is inside the travel scope. */
export function travelCategoryFilter(requested: string | undefined, scope: readonly string[]): string | undefined {
  return requested && scope.includes(requested) ? requested : undefined;
}

/** Postal-code filter (PLZ): letters, digits, space and hyphen, 2–10 characters, as typed by the visitor. */
export function parsePostalCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9 -]{1,9}$/.test(v) ? v : undefined;
}

/** The six service shortcuts of the home banner, in the reference order; each opens /travel filtered to that category. */
export const TRAVEL_SHORTCUTS = ["travel-agencies", "taxi-transfer", "airport-transfer", "car-rental", "cargo-logistics", "courier-delivery"] as const;
