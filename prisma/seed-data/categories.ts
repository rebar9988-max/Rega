/**
 * Top-level categories of the business directory (Phase 3). Seeded by upsert on `key` and never overwritten: names
 * edited by an admin stay. Sub-categories are added in the admin panel (Category.parentId is a tree of any depth).
 * `icon` is an icon name of src/components/home/icons.tsx (unknown names fall back to a neutral icon).
 */
export type SeedCategory = {
  key: string;
  icon: string;
  names: { ckb: string; kmr: string; de: string; en: string; ar: string; fa: string; tr: string };
};

export const CATEGORIES: SeedCategory[] = [
  { key: "legal", icon: "legal", names: { ckb: "خزمەتگوزاریی یاسایی", kmr: "Hiqûqî", de: "Recht", en: "Legal", ar: "قانوني", fa: "حقوقی", tr: "Hukuk" } },
  { key: "food", icon: "food", names: { ckb: "چێشتخانە و کافێ", kmr: "Xwarin", de: "Gastronomie", en: "Food & Restaurants", ar: "مطاعم", fa: "خوراک و رستوران", tr: "Yeme İçme" } },
  { key: "health", icon: "health", names: { ckb: "تەندروستی", kmr: "Tenduristî", de: "Gesundheit", en: "Health", ar: "صحة", fa: "سلامت", tr: "Sağlık" } },
  { key: "admin", icon: "admin", names: { ckb: "کارگێڕی و بەڵگەنامە", kmr: "Rêvebirî û kaxezan", de: "Verwaltung & Behördenangelegenheiten", en: "Administration & Paperwork", ar: "إدارة ومعاملات", fa: "امور اداری و مدارک", tr: "İdari İşler ve Evrak" } },
  { key: "translation", icon: "grid", names: { ckb: "وەرگێڕان", kmr: "Wergêr", de: "Übersetzung", en: "Translation", ar: "ترجمة", fa: "ترجمه", tr: "Tercüme" } },
  { key: "beauty-barber", icon: "grid", names: { ckb: "سەرتاشخانە و جوانکاری", kmr: "Bedew û berber", de: "Beauty & Friseur", en: "Beauty & Barber", ar: "تجميل وحلاقة", fa: "زیبایی و آرایشگاه", tr: "Güzellik ve Berber" } },
  { key: "auto-garage", icon: "grid", names: { ckb: "ئۆتۆمبێل و چاکسازی", kmr: "Otomobîl û garaj", de: "Auto & Werkstatt", en: "Auto & Garage", ar: "سيارات وورشة", fa: "خودرو و تعمیرگاه", tr: "Oto ve Servis" } },
  { key: "construction-crafts", icon: "grid", names: { ckb: "بیناسازی و پیشەکان", kmr: "Avahîsazî û pîşesazî", de: "Bau & Handwerk", en: "Construction & Crafts", ar: "بناء وحرف", fa: "ساختمان و صنایع دستی", tr: "İnşaat ve Zanaat" } },
  { key: "education", icon: "grid", names: { ckb: "فێرکردن و وانەی تایبەت", kmr: "Perwerde û dersa taybet", de: "Bildung & Nachhilfe", en: "Education & Tutoring", ar: "تعليم ودروس خصوصية", fa: "آموزش و تدریس خصوصی", tr: "Eğitim ve Özel Ders" } },
  { key: "real-estate", icon: "store", names: { ckb: "خانووبەرە", kmr: "Xanî û mal", de: "Immobilien", en: "Real Estate", ar: "عقارات", fa: "املاک", tr: "Emlak" } },
  { key: "travel-tickets", icon: "near", names: { ckb: "گەشت و بلیت", kmr: "Rêwîtî û bilêt", de: "Reisen & Tickets", en: "Travel & Tickets", ar: "سفر وتذاكر", fa: "سفر و بلیت", tr: "Seyahat ve Bilet" } },
  { key: "groceries-markets", icon: "store", names: { ckb: "خواروبار و بازاڕ", kmr: "Bazar û xwarinên malê", de: "Lebensmittel & Märkte", en: "Groceries & Markets", ar: "بقالة وأسواق", fa: "خواربار و بازار", tr: "Market ve Bakkal" } },
  { key: "it-phones", icon: "grid", names: { ckb: "تەکنەلۆژیا و مۆبایل", kmr: "IT û telefon", de: "IT & Handy", en: "IT & Phones", ar: "تقنية وهواتف", fa: "فناوری و موبایل", tr: "Bilişim ve Telefon" } },
  { key: "tax-accounting", icon: "admin", names: { ckb: "باج و ژمێریاری", kmr: "Bac û hesabdarî", de: "Steuer & Buchhaltung", en: "Tax & Accounting", ar: "ضرائب ومحاسبة", fa: "مالیات و حسابداری", tr: "Vergi ve Muhasebe" } },
  { key: "driving-schools", icon: "near", names: { ckb: "فێرگەی شۆفێری", kmr: "Dibistana şofêriyê", de: "Fahrschulen", en: "Driving Schools", ar: "مدارس تعليم القيادة", fa: "آموزشگاه رانندگی", tr: "Sürücü Kursları" } },
  { key: "cleaning", icon: "grid", names: { ckb: "خزمەتگوزاریی پاککردنەوە", kmr: "Paqijî", de: "Reinigung", en: "Cleaning", ar: "تنظيف", fa: "نظافت", tr: "Temizlik" } },
  { key: "transport-moving", icon: "near", names: { ckb: "گواستنەوە و بارگواستنەوە", kmr: "Veguhastin û barkirin", de: "Transport & Umzug", en: "Transport & Moving", ar: "نقل وترحيل", fa: "حمل‌ونقل و اسباب‌کشی", tr: "Nakliyat ve Taşıma" } },
  { key: "insurance", icon: "legal", names: { ckb: "بیمە", kmr: "Sîgorta", de: "Versicherung", en: "Insurance", ar: "تأمين", fa: "بیمه", tr: "Sigorta" } },
  { key: "community-associations", icon: "all", names: { ckb: "کۆمەڵگا و ڕێکخراوەکان", kmr: "Civak û komele", de: "Gemeinschaft & Vereine", en: "Community & Associations", ar: "مجتمع وجمعيات", fa: "جامعه و انجمن‌ها", tr: "Topluluk ve Dernekler" } },
];
