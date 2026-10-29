/**
 * Geography seed (Phase 3): Country -> Region -> City, with slugs, public centre coordinates and names in the seven
 * launch languages. Seeded by upsert and never overwritten: values an admin changed stay (only empty fields are filled).
 * Coordinates are city-centre facts (the Nearby city picker needs them), rounded to 4 decimals.
 */
type Names = { ckb: string; kmr: string; de: string; en: string; ar: string; fa: string; tr: string };

export type SeedCountry = { code: string; lat: number; lng: number; names: Names };
/** `names` adds region names in the other launch languages (stored as RegionTranslation rows, one per locale). */
export type SeedRegion = { country: string; slug: string; en: string; de: string; names?: Omit<Names, "en" | "de"> };
export type SeedCity = { country: string; region?: string; slug: string; lat: number; lng: number; names: Names };

export const COUNTRIES: SeedCountry[] = [
  { code: "DE", lat: 51.1657, lng: 10.4515, names: { ckb: "ئەڵمانیا", kmr: "Almanya", de: "Deutschland", en: "Germany", ar: "ألمانيا", fa: "آلمان", tr: "Almanya" } },
  { code: "AT", lat: 47.5162, lng: 14.5501, names: { ckb: "نەمسا", kmr: "Awusturya", de: "Österreich", en: "Austria", ar: "النمسا", fa: "اتریش", tr: "Avusturya" } },
  { code: "SE", lat: 60.1282, lng: 18.6435, names: { ckb: "سوید", kmr: "Swêd", de: "Schweden", en: "Sweden", ar: "السويد", fa: "سوئد", tr: "İsveç" } },
  { code: "GB", lat: 55.3781, lng: -3.436, names: { ckb: "بەریتانیا", kmr: "Brîtanya", de: "Vereinigtes Königreich", en: "United Kingdom", ar: "المملكة المتحدة", fa: "بریتانیا", tr: "Birleşik Krallık" } },
  { code: "NL", lat: 52.1326, lng: 5.2913, names: { ckb: "هۆڵەندا", kmr: "Hollanda", de: "Niederlande", en: "Netherlands", ar: "هولندا", fa: "هلند", tr: "Hollanda" } },
  { code: "FR", lat: 46.2276, lng: 2.2137, names: { ckb: "فەڕەنسا", kmr: "Fransa", de: "Frankreich", en: "France", ar: "فرنسا", fa: "فرانسه", tr: "Fransa" } },
  { code: "IQ", lat: 33.2232, lng: 43.6793, names: { ckb: "عێراق", kmr: "Iraq", de: "Irak", en: "Iraq", ar: "العراق", fa: "عراق", tr: "Irak" } },
  // European target markets added 2026-10-29 (all 13 targets: DE, FR, SE, NL, GB, BE, AT, CH, GR, NO, DK, FI, IT). Each starts
  // with its capital only; more cities are added from verified sources, never invented.
  { code: "BE", lat: 50.5039, lng: 4.4699, names: { ckb: "بەلجیکا", kmr: "Belçîka", de: "Belgien", en: "Belgium", ar: "بلجيكا", fa: "بلژیک", tr: "Belçika" } },
  { code: "CH", lat: 46.8182, lng: 8.2275, names: { ckb: "سویسرا", kmr: "Swîsre", de: "Schweiz", en: "Switzerland", ar: "سويسرا", fa: "سوئیس", tr: "İsviçre" } },
  { code: "GR", lat: 39.0742, lng: 21.8243, names: { ckb: "یۆنان", kmr: "Yewnanistan", de: "Griechenland", en: "Greece", ar: "اليونان", fa: "یونان", tr: "Yunanistan" } },
  { code: "NO", lat: 60.472, lng: 8.4689, names: { ckb: "نەرویج", kmr: "Norwêc", de: "Norwegen", en: "Norway", ar: "النرويج", fa: "نروژ", tr: "Norveç" } },
  { code: "DK", lat: 56.2639, lng: 9.5018, names: { ckb: "دانیمارک", kmr: "Danîmarka", de: "Dänemark", en: "Denmark", ar: "الدنمارك", fa: "دانمارک", tr: "Danimarka" } },
  { code: "FI", lat: 61.9241, lng: 25.7482, names: { ckb: "فینلەندا", kmr: "Fînlenda", de: "Finnland", en: "Finland", ar: "فنلندا", fa: "فنلاند", tr: "Finlandiya" } },
  { code: "IT", lat: 41.8719, lng: 12.5674, names: { ckb: "ئیتاڵیا", kmr: "Îtalya", de: "Italien", en: "Italy", ar: "إيطاليا", fa: "ایتالیا", tr: "İtalya" } },
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
  { country: "BE", slug: "brussels-capital", en: "Brussels-Capital Region", de: "Region Brüssel-Hauptstadt" },
  { country: "CH", slug: "bern", en: "Canton of Bern", de: "Kanton Bern" },
  { country: "GR", slug: "attica", en: "Attica", de: "Attika" },
  { country: "NO", slug: "oslo", en: "Oslo", de: "Oslo" },
  { country: "DK", slug: "hovedstaden", en: "Capital Region of Denmark", de: "Region Hovedstaden" },
  { country: "FI", slug: "uusimaa", en: "Uusimaa", de: "Uusimaa" },
  { country: "IT", slug: "lazio", en: "Lazio", de: "Latium" },
  // Iraq: the Kurdistan Region is one federal region (its governorates Erbil, Sulaymaniyah, Duhok and Halabja are
  // listed as cities, not as separate regions); other governorates are regions of their own. A city whose
  // administrative assignment is disputed is seeded without a region rather than guessed (see Kifri below).
  { country: "IQ", slug: "kurdistan-region", en: "Kurdistan Region", de: "Autonome Region Kurdistan", names: { ckb: "هەرێمی کوردستان", kmr: "Herêma Kurdistanê", ar: "إقليم كوردستان", fa: "اقلیم کردستان", tr: "Kürdistan Bölgesi" } },
  { country: "IQ", slug: "baghdad-governorate", en: "Baghdad Governorate", de: "Gouvernement Bagdad", names: { ckb: "پارێزگای بەغدا", kmr: "Parêzgeha Bexdayê", ar: "محافظة بغداد", fa: "استان بغداد", tr: "Bağdat Valiliği" } },
  { country: "IQ", slug: "basra-governorate", en: "Basra Governorate", de: "Gouvernement Basra", names: { ckb: "پارێزگای بەسرە", kmr: "Parêzgeha Besrayê", ar: "محافظة البصرة", fa: "استان بصره", tr: "Basra Valiliği" } },
  { country: "IQ", slug: "nineveh-governorate", en: "Nineveh Governorate", de: "Gouvernement Ninawa", names: { ckb: "پارێزگای نەینەوا", kmr: "Parêzgeha Neynewayê", ar: "محافظة نينوى", fa: "استان نینوا", tr: "Ninova Valiliği" } },
  { country: "IQ", slug: "kirkuk-governorate", en: "Kirkuk Governorate", de: "Gouvernement Kirkuk", names: { ckb: "پارێزگای کەرکووک", kmr: "Parêzgeha Kerkûkê", ar: "محافظة كركوك", fa: "استان کرکوک", tr: "Kerkük Valiliği" } },
  { country: "IQ", slug: "najaf-governorate", en: "Najaf Governorate", de: "Gouvernement Nadschaf", names: { ckb: "پارێزگای نەجەف", kmr: "Parêzgeha Necefê", ar: "محافظة النجف", fa: "استان نجف", tr: "Necef Valiliği" } },
  { country: "IQ", slug: "karbala-governorate", en: "Karbala Governorate", de: "Gouvernement Kerbela", names: { ckb: "پارێزگای کەربەلا", kmr: "Parêzgeha Kerbelayê", ar: "محافظة كربلاء", fa: "استان کربلا", tr: "Kerbela Valiliği" } },
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
  { country: "BE", region: "brussels-capital", slug: "brussels", lat: 50.8503, lng: 4.3517, names: { ckb: "بڕوکسل", kmr: "Brûksel", de: "Brüssel", en: "Brussels", ar: "بروكسل", fa: "بروکسل", tr: "Brüksel" } },
  { country: "CH", region: "bern", slug: "bern", lat: 46.948, lng: 7.4474, names: { ckb: "بێرن", kmr: "Bern", de: "Bern", en: "Bern", ar: "برن", fa: "برن", tr: "Bern" } },
  { country: "GR", region: "attica", slug: "athens", lat: 37.9838, lng: 23.7275, names: { ckb: "ئەسینا", kmr: "Atîna", de: "Athen", en: "Athens", ar: "أثينا", fa: "آتن", tr: "Atina" } },
  { country: "NO", region: "oslo", slug: "oslo", lat: 59.9139, lng: 10.7522, names: { ckb: "ئۆسلۆ", kmr: "Oslo", de: "Oslo", en: "Oslo", ar: "أوسلو", fa: "اسلو", tr: "Oslo" } },
  { country: "DK", region: "hovedstaden", slug: "copenhagen", lat: 55.6761, lng: 12.5683, names: { ckb: "کۆپنهاگن", kmr: "Kopenhag", de: "Kopenhagen", en: "Copenhagen", ar: "كوبنهاغن", fa: "کپنهاگ", tr: "Kopenhag" } },
  { country: "FI", region: "uusimaa", slug: "helsinki", lat: 60.1699, lng: 24.9384, names: { ckb: "هێلسینکی", kmr: "Helsînkî", de: "Helsinki", en: "Helsinki", ar: "هلسنكي", fa: "هلسینکی", tr: "Helsinki" } },
  { country: "IT", region: "lazio", slug: "rome", lat: 41.9028, lng: 12.4964, names: { ckb: "ڕۆما", kmr: "Roma", de: "Rom", en: "Rome", ar: "روما", fa: "رم", tr: "Roma" } },
  { country: "IQ", region: "kurdistan-region", slug: "erbil", lat: 36.191, lng: 44.009, names: { ckb: "هەولێر", kmr: "Hewlêr", de: "Erbil", en: "Erbil", ar: "أربيل", fa: "اربیل", tr: "Erbil" } },
  { country: "IQ", region: "kurdistan-region", slug: "sulaymaniyah", lat: 35.557, lng: 45.435, names: { ckb: "سلێمانی", kmr: "Silêmanî", de: "Sulaimaniyya", en: "Sulaymaniyah", ar: "السليمانية", fa: "سلیمانیه", tr: "Süleymaniye" } },
  { country: "IQ", region: "kurdistan-region", slug: "duhok", lat: 36.8669, lng: 42.9503, names: { ckb: "دهۆک", kmr: "Duhok", de: "Dohuk", en: "Duhok", ar: "دهوك", fa: "دهوک", tr: "Duhok" } },
  { country: "IQ", region: "kurdistan-region", slug: "halabja", lat: 35.1778, lng: 45.9861, names: { ckb: "هەڵەبجە", kmr: "Helebce", de: "Halabdscha", en: "Halabja", ar: "حلبجة", fa: "حلبچه", tr: "Halepçe" } },
  { country: "IQ", region: "kurdistan-region", slug: "ankawa", lat: 36.2297, lng: 43.9947, names: { ckb: "عەنکاوە", kmr: "Enkawa", de: "Ankawa", en: "Ankawa", ar: "عنكاوا", fa: "عینکاوه", tr: "Ankawa" } },
  { country: "IQ", region: "kurdistan-region", slug: "zakho", lat: 37.1442, lng: 42.6872, names: { ckb: "زاخۆ", kmr: "Zaxo", de: "Zakho", en: "Zakho", ar: "زاخو", fa: "زاخو", tr: "Zaho" } },
  { country: "IQ", region: "kurdistan-region", slug: "ranya", lat: 36.255, lng: 44.8828, names: { ckb: "ڕانیە", kmr: "Ranye", de: "Ranya", en: "Ranya", ar: "رانية", fa: "رانیه", tr: "Ranya" } },
  { country: "IQ", region: "kurdistan-region", slug: "koya", lat: 36.0828, lng: 44.6283, names: { ckb: "کۆیە", kmr: "Koye", de: "Koya", en: "Koya", ar: "كويسنجق", fa: "کویه", tr: "Koysancak" } },
  { country: "IQ", region: "kurdistan-region", slug: "soran", lat: 36.6528, lng: 44.5442, names: { ckb: "سۆران", kmr: "Soran", de: "Soran", en: "Soran", ar: "سوران", fa: "سوران", tr: "Soran" } },
  { country: "IQ", region: "kurdistan-region", slug: "akre", lat: 36.7414, lng: 43.8931, names: { ckb: "ئاکرێ", kmr: "Akrê", de: "Akre", en: "Akre", ar: "عقرة", fa: "عقره", tr: "Akre" } },
  { country: "IQ", region: "kurdistan-region", slug: "shaqlawa", lat: 36.4053, lng: 44.3203, names: { ckb: "شەقڵاوە", kmr: "Şeqlawe", de: "Shaqlawa", en: "Shaqlawa", ar: "شقلاوة", fa: "شقلاوه", tr: "Şaklava" } },
  { country: "IQ", region: "kurdistan-region", slug: "chamchamal", lat: 35.5333, lng: 44.8333, names: { ckb: "چەمچەماڵ", kmr: "Çemçemal", de: "Chamchamal", en: "Chamchamal", ar: "جمجمال", fa: "چمچمال", tr: "Çemçemal" } },
  { country: "IQ", region: "kurdistan-region", slug: "kalar", lat: 34.629, lng: 45.3222, names: { ckb: "کەلار", kmr: "Kelar", de: "Kalar", en: "Kalar", ar: "كلار", fa: "کلار", tr: "Kelar" } },
  { country: "IQ", region: "kurdistan-region", slug: "darbandikhan", lat: 35.1128, lng: 45.6878, names: { ckb: "دەربەندیخان", kmr: "Derbendîxan", de: "Darbandikhan", en: "Darbandikhan", ar: "دربندخان", fa: "دربندیخان", tr: "Derbendihan" } },
  { country: "IQ", slug: "kifri", lat: 34.6896, lng: 44.9606, names: { ckb: "کفری", kmr: "Kifrî", de: "Kifri", en: "Kifri", ar: "كفري", fa: "کفری", tr: "Kifri" } }, // District centre; its governorate assignment is disputed, so no region is set.
  { country: "IQ", region: "baghdad-governorate", slug: "baghdad", lat: 33.3152, lng: 44.3661, names: { ckb: "بەغدا", kmr: "Bexda", de: "Bagdad", en: "Baghdad", ar: "بغداد", fa: "بغداد", tr: "Bağdat" } },
  { country: "IQ", region: "basra-governorate", slug: "basra", lat: 30.5085, lng: 47.7804, names: { ckb: "بەسرە", kmr: "Besra", de: "Basra", en: "Basra", ar: "البصرة", fa: "بصره", tr: "Basra" } },
  { country: "IQ", region: "nineveh-governorate", slug: "mosul", lat: 36.34, lng: 43.13, names: { ckb: "مووسڵ", kmr: "Mûsil", de: "Mossul", en: "Mosul", ar: "الموصل", fa: "موصل", tr: "Musul" } },
  { country: "IQ", region: "kirkuk-governorate", slug: "kirkuk", lat: 35.4681, lng: 44.3922, names: { ckb: "کەرکووک", kmr: "Kerkûk", de: "Kirkuk", en: "Kirkuk", ar: "كركوك", fa: "کرکوک", tr: "Kerkük" } },
  { country: "IQ", region: "najaf-governorate", slug: "najaf", lat: 32.0259, lng: 44.3462, names: { ckb: "نەجەف", kmr: "Necef", de: "Nadschaf", en: "Najaf", ar: "النجف", fa: "نجف", tr: "Necef" } },
  { country: "IQ", region: "karbala-governorate", slug: "karbala", lat: 32.616, lng: 44.0249, names: { ckb: "کەربەلا", kmr: "Kerbela", de: "Kerbela", en: "Karbala", ar: "كربلاء", fa: "کربلا", tr: "Kerbela" } },
];
