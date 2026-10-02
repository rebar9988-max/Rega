/**
 * Geography seed (Phase 3): Country -> Region -> City, with slugs, public centre coordinates and names in the seven
 * launch languages. Seeded by upsert and never overwritten: values an admin changed stay (only empty fields are filled).
 * Coordinates are city-centre facts (the Nearby city picker needs them), rounded to 4 decimals.
 */
type Names = { ckb: string; kmr: string; de: string; en: string; ar: string; fa: string; tr: string };

export type SeedCountry = { code: string; lat: number; lng: number; names: Names };
export type SeedRegion = { country: string; slug: string; en: string; de: string };
export type SeedCity = { country: string; region?: string; slug: string; lat: number; lng: number; names: Names };

export const COUNTRIES: SeedCountry[] = [
  { code: "DE", lat: 51.1657, lng: 10.4515, names: { ckb: "ئەڵمانیا", kmr: "Almanya", de: "Deutschland", en: "Germany", ar: "ألمانيا", fa: "آلمان", tr: "Almanya" } },
  { code: "AT", lat: 47.5162, lng: 14.5501, names: { ckb: "نەمسا", kmr: "Awusturya", de: "Österreich", en: "Austria", ar: "النمسا", fa: "اتریش", tr: "Avusturya" } },
  { code: "SE", lat: 60.1282, lng: 18.6435, names: { ckb: "سوید", kmr: "Swêd", de: "Schweden", en: "Sweden", ar: "السويد", fa: "سوئد", tr: "İsveç" } },
  { code: "GB", lat: 55.3781, lng: -3.436, names: { ckb: "بەریتانیا", kmr: "Brîtanya", de: "Vereinigtes Königreich", en: "United Kingdom", ar: "المملكة المتحدة", fa: "بریتانیا", tr: "Birleşik Krallık" } },
  { code: "NL", lat: 52.1326, lng: 5.2913, names: { ckb: "هۆڵەندا", kmr: "Hollanda", de: "Niederlande", en: "Netherlands", ar: "هولندا", fa: "هلند", tr: "Hollanda" } },
  { code: "FR", lat: 46.2276, lng: 2.2137, names: { ckb: "فەڕەنسا", kmr: "Fransa", de: "Frankreich", en: "France", ar: "فرنسا", fa: "فرانسه", tr: "Fransa" } },
  { code: "IQ", lat: 33.2232, lng: 43.6793, names: { ckb: "عێراق", kmr: "Iraq", de: "Irak", en: "Iraq", ar: "العراق", fa: "عراق", tr: "Irak" } },
];

export const REGIONS: SeedRegion[] = [
  { country: "DE", slug: "baden-wuerttemberg", en: "Baden-Württemberg", de: "Baden-Württemberg" },
  { country: "DE", slug: "bayern", en: "Bavaria", de: "Bayern" },
  { country: "DE", slug: "berlin", en: "Berlin", de: "Berlin" },
  { country: "DE", slug: "brandenburg", en: "Brandenburg", de: "Brandenburg" },
  { country: "DE", slug: "bremen", en: "Bremen", de: "Bremen" },
  { country: "DE", slug: "hamburg", en: "Hamburg", de: "Hamburg" },
  { country: "DE", slug: "hessen", en: "Hesse", de: "Hessen" },
  { country: "DE", slug: "mecklenburg-vorpommern", en: "Mecklenburg-Vorpommern", de: "Mecklenburg-Vorpommern" },
  { country: "DE", slug: "niedersachsen", en: "Lower Saxony", de: "Niedersachsen" },
  { country: "DE", slug: "nordrhein-westfalen", en: "North Rhine-Westphalia", de: "Nordrhein-Westfalen" },
  { country: "DE", slug: "rheinland-pfalz", en: "Rhineland-Palatinate", de: "Rheinland-Pfalz" },
  { country: "DE", slug: "saarland", en: "Saarland", de: "Saarland" },
  { country: "DE", slug: "sachsen", en: "Saxony", de: "Sachsen" },
  { country: "DE", slug: "sachsen-anhalt", en: "Saxony-Anhalt", de: "Sachsen-Anhalt" },
  { country: "DE", slug: "schleswig-holstein", en: "Schleswig-Holstein", de: "Schleswig-Holstein" },
  { country: "DE", slug: "thueringen", en: "Thuringia", de: "Thüringen" },
  { country: "AT", slug: "wien", en: "Vienna", de: "Wien" },
  { country: "SE", slug: "stockholm", en: "Stockholm County", de: "Stockholms län" },
  { country: "GB", slug: "england", en: "England", de: "England" },
  { country: "NL", slug: "noord-holland", en: "North Holland", de: "Nordholland" },
  { country: "FR", slug: "ile-de-france", en: "Île-de-France", de: "Île-de-France" },
  { country: "IQ", slug: "kurdistan-region", en: "Kurdistan Region", de: "Autonome Region Kurdistan" },
];

export const CITIES: SeedCity[] = [
  { country: "DE", region: "berlin", slug: "berlin", lat: 52.52, lng: 13.405, names: { ckb: "بەرلین", kmr: "Berlîn", de: "Berlin", en: "Berlin", ar: "برلين", fa: "برلین", tr: "Berlin" } },
  { country: "DE", region: "hamburg", slug: "hamburg", lat: 53.5511, lng: 9.9937, names: { ckb: "هامبورگ", kmr: "Hamburg", de: "Hamburg", en: "Hamburg", ar: "هامبورغ", fa: "هامبورگ", tr: "Hamburg" } },
  { country: "DE", region: "nordrhein-westfalen", slug: "koeln", lat: 50.9375, lng: 6.9603, names: { ckb: "کۆلن", kmr: "Köln", de: "Köln", en: "Cologne", ar: "كولونيا", fa: "کلن", tr: "Köln" } },
  { country: "DE", region: "bayern", slug: "muenchen", lat: 48.1351, lng: 11.582, names: { ckb: "میونشن", kmr: "München", de: "München", en: "Munich", ar: "ميونخ", fa: "مونیخ", tr: "Münih" } },
  { country: "DE", region: "hessen", slug: "frankfurt", lat: 50.1109, lng: 8.6821, names: { ckb: "فرانکفورت", kmr: "Frankfurt", de: "Frankfurt am Main", en: "Frankfurt", ar: "فرانكفورت", fa: "فرانکفورت", tr: "Frankfurt" } },
  { country: "DE", region: "nordrhein-westfalen", slug: "duesseldorf", lat: 51.2277, lng: 6.7735, names: { ckb: "دوسلدۆرف", kmr: "Düsseldorf", de: "Düsseldorf", en: "Düsseldorf", ar: "دوسلدورف", fa: "دوسلدورف", tr: "Düsseldorf" } },
  { country: "DE", region: "bremen", slug: "bremen", lat: 53.0793, lng: 8.8017, names: { ckb: "برێمن", kmr: "Bremen", de: "Bremen", en: "Bremen", ar: "بريمن", fa: "برمن", tr: "Bremen" } },
  { country: "DE", region: "niedersachsen", slug: "hannover", lat: 52.3759, lng: 9.732, names: { ckb: "هانۆڤەر", kmr: "Hannover", de: "Hannover", en: "Hanover", ar: "هانوفر", fa: "هانوفر", tr: "Hannover" } },
  { country: "DE", region: "nordrhein-westfalen", slug: "dortmund", lat: 51.5136, lng: 7.4653, names: { ckb: "دۆرتموند", kmr: "Dortmund", de: "Dortmund", en: "Dortmund", ar: "دورتموند", fa: "دورتموند", tr: "Dortmund" } },
  { country: "DE", region: "nordrhein-westfalen", slug: "essen", lat: 51.4556, lng: 7.0116, names: { ckb: "ئێسن", kmr: "Essen", de: "Essen", en: "Essen", ar: "إيسن", fa: "اسن", tr: "Essen" } },
  { country: "DE", region: "baden-wuerttemberg", slug: "stuttgart", lat: 48.7758, lng: 9.1829, names: { ckb: "ستوتگارت", kmr: "Stuttgart", de: "Stuttgart", en: "Stuttgart", ar: "شتوتغارت", fa: "اشتوتگارت", tr: "Stuttgart" } },
  { country: "DE", region: "nordrhein-westfalen", slug: "bielefeld", lat: 52.0302, lng: 8.5325, names: { ckb: "بیلەفێلد", kmr: "Bielefeld", de: "Bielefeld", en: "Bielefeld", ar: "بيليفيلد", fa: "بیله‌فلد", tr: "Bielefeld" } },
  { country: "DE", region: "nordrhein-westfalen", slug: "duisburg", lat: 51.4344, lng: 6.7623, names: { ckb: "دویسبورگ", kmr: "Duisburg", de: "Duisburg", en: "Duisburg", ar: "دويسبورغ", fa: "دویسبورگ", tr: "Duisburg" } },
  { country: "DE", region: "nordrhein-westfalen", slug: "bonn", lat: 50.7374, lng: 7.0982, names: { ckb: "بۆن", kmr: "Bonn", de: "Bonn", en: "Bonn", ar: "بون", fa: "بن", tr: "Bonn" } },
  { country: "DE", region: "bayern", slug: "nuernberg", lat: 49.4521, lng: 11.0767, names: { ckb: "نورنبێرگ", kmr: "Nürnberg", de: "Nürnberg", en: "Nuremberg", ar: "نورنبرغ", fa: "نورنبرگ", tr: "Nürnberg" } },
  { country: "AT", region: "wien", slug: "wien", lat: 48.2082, lng: 16.3738, names: { ckb: "ڤیەنا", kmr: "Viyana", de: "Wien", en: "Vienna", ar: "فيينا", fa: "وین", tr: "Viyana" } },
  { country: "SE", region: "stockholm", slug: "stockholm", lat: 59.3293, lng: 18.0686, names: { ckb: "ستۆکهۆڵم", kmr: "Stockholm", de: "Stockholm", en: "Stockholm", ar: "ستوكهولم", fa: "استکهلم", tr: "Stokholm" } },
  { country: "GB", region: "england", slug: "london", lat: 51.5074, lng: -0.1278, names: { ckb: "لەندەن", kmr: "London", de: "London", en: "London", ar: "لندن", fa: "لندن", tr: "Londra" } },
  { country: "NL", region: "noord-holland", slug: "amsterdam", lat: 52.3676, lng: 4.9041, names: { ckb: "ئەمستەردام", kmr: "Amsterdam", de: "Amsterdam", en: "Amsterdam", ar: "أمستردام", fa: "آمستردام", tr: "Amsterdam" } },
  { country: "FR", region: "ile-de-france", slug: "paris", lat: 48.8566, lng: 2.3522, names: { ckb: "پاریس", kmr: "Paris", de: "Paris", en: "Paris", ar: "باريس", fa: "پاریس", tr: "Paris" } },
  { country: "IQ", region: "kurdistan-region", slug: "erbil", lat: 36.191, lng: 44.009, names: { ckb: "هەولێر", kmr: "Hewlêr", de: "Erbil", en: "Erbil", ar: "أربيل", fa: "اربیل", tr: "Erbil" } },
  { country: "IQ", region: "kurdistan-region", slug: "sulaymaniyah", lat: 35.557, lng: 45.435, names: { ckb: "سلێمانی", kmr: "Silêmanî", de: "Sulaimaniyya", en: "Sulaymaniyah", ar: "السليمانية", fa: "سلیمانیه", tr: "Süleymaniye" } },
];
