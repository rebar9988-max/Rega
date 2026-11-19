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

/** The Rega24Travel sub-categories (first ten seeded 2026-11-18, four more for the full travel scope). Keys are also the slugs (/businesses/<key>). */
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
  { key: "tour-operators", parent: "travel-tickets", names: { ckb: "ڕێکخەرانی گەشت و تووری گەشتیاری", kmr: "Organîzatorên turan", de: "Reiseveranstalter", en: "Tour Operators", ar: "منظمو الرحلات السياحية", fa: "برگزارکنندگان تور", tr: "Tur Operatörleri" } },
  { key: "chauffeur-services", parent: "transport-moving", names: { ckb: "خزمەتگوزاری شۆفێری تایبەت", kmr: "Xizmetên şofêrê taybet", de: "Chauffeurservice", en: "Chauffeur Services", ar: "خدمات السائق الخاص", fa: "خدمات راننده اختصاصی", tr: "Şoför Hizmetleri" } },
  { key: "shuttle-services", parent: "transport-moving", names: { ckb: "خزمەتگوزاری شاتڵ", kmr: "Xizmetên şatilê", de: "Shuttle-Service", en: "Shuttle Services", ar: "خدمات النقل المكوكي", fa: "خدمات شاتل", tr: "Servis ve Shuttle Hizmetleri" } },
  { key: "intercity-international", parent: "transport-moving", names: { ckb: "گواستنەوەی نێوان شارەکان و نێودەوڵەتی", kmr: "Veguhastina navbajarî û navneteweyî", de: "Fernverkehr & internationale Transporte", en: "Intercity & International Transport", ar: "النقل بين المدن والنقل الدولي", fa: "حمل‌ونقل بین‌شهری و بین‌المللی", tr: "Şehirlerarası ve Uluslararası Taşımacılık" } },
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

/** Virtual category id: anywhere a category filter is accepted, "travel" means every Rega24Travel category. */
export const TRAVEL_SCOPE_ID = "travel";

/** Supported transport types a travel business can declare (stored as `transport:<key>` tags; no schema change). */
export const TRANSPORT_TYPES = ["car", "limousine", "van", "minibus", "bus", "truck", "motorcycle"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

const TRANSPORT_PREFIX = "transport:";
const AREA_PREFIX = "area:";
export const MAX_SERVICE_AREAS = 10;

/** Service areas typed as a comma/newline separated list: trimmed, de-duplicated (case-insensitive), bounded. */
export function parseServiceAreas(text: unknown): string[] {
  if (typeof text !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,،\n;]+/)) {
    const area = raw.replace(/\s+/g, " ").trim().slice(0, 40);
    const key = area.toLocaleLowerCase();
    if (area.length >= 2 && !seen.has(key)) { seen.add(key); out.push(area); }
    if (out.length >= MAX_SERVICE_AREAS) break;
  }
  return out;
}

/** Splits stored business tags into travel details and every other tag (kept untouched on save). */
export function readTravelTags(tags: unknown): { transport: TransportType[]; areas: string[]; other: string[] } {
  const list = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [];
  const transport = list.filter((t) => t.startsWith(TRANSPORT_PREFIX)).map((t) => t.slice(TRANSPORT_PREFIX.length))
    .filter((t): t is TransportType => (TRANSPORT_TYPES as readonly string[]).includes(t));
  const areas = list.filter((t) => t.startsWith(AREA_PREFIX)).map((t) => t.slice(AREA_PREFIX.length)).filter(Boolean);
  const other = list.filter((t) => !t.startsWith(TRANSPORT_PREFIX) && !t.startsWith(AREA_PREFIX));
  return { transport: [...new Set(transport)], areas, other };
}

/** Stored tags: the other tags first, then the travel details. Bounded by the business tag limits (30 x 50 chars). */
export function writeTravelTags(existing: unknown, transport: readonly string[], areas: readonly string[]): string[] {
  const { other } = readTravelTags(existing);
  const types = TRANSPORT_TYPES.filter((t) => transport.includes(t)).map((t) => `${TRANSPORT_PREFIX}${t}`);
  const places = areas.slice(0, MAX_SERVICE_AREAS).map((a) => `${AREA_PREFIX}${a}`.slice(0, 50));
  return [...other, ...types, ...places].slice(0, 30);
}

/** The search-text fragment of one transport type (tags are part of the business search text). */
export const transportSearchToken = (type: TransportType) => `${TRANSPORT_PREFIX}${type}`;
/** The six service shortcuts of the home banner, in the reference order; each opens /travel filtered to that category. */
export const TRAVEL_SHORTCUTS = ["travel-agencies", "taxi-transfer", "airport-transfer", "car-rental", "cargo-logistics", "courier-delivery"] as const;
