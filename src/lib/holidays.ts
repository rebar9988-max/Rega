/**
 * Official public holidays by country and region, for opening-hours status. Pure: shared by the server, the browser
 * and the tests. Only dates that follow a fixed rule are listed, never guessed ones:
 *
 * - DE: the nine nationwide holidays plus the state holidays that apply to a whole state (region slugs as in
 *   prisma/seed-data/geography.ts). Holidays that apply only in some municipalities (Mariä Himmelfahrt in Bavaria,
 *   Fronleichnam in parts of Saxony/Thuringia) are left out rather than shown for a whole state.
 * - IQ: the fixed-date holidays of the 2024 official holidays law (New Year, Army Day, Nowruz, Labour Day, National
 *   Day, Victory Day, Christmas). Islamic holidays (Eid al-Fitr, Eid al-Adha, …) follow the lunar calendar and are
 *   announced each year, so they are not computed; businesses enter them as closures or special hours.
 *
 * A country without data has no holidays here (status is then based on the weekly hours and the business's own
 * closures only).
 */
import type { Locale } from "@/config/locales";

export type HolidayNames = Record<Locale, string>;
export type Holiday = { key: string; date: string; names: HolidayNames };

type Rule = { key: string; regions?: readonly string[]; date: (year: number) => string; names: HolidayNames };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const fixed = (m: number, d: number) => (y: number) => ymd(y, m, d);

/** Gregorian Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/** Calendar arithmetic on "YYYY-MM-DD" (UTC based, so no daylight-saving effects). */
export function addDays(date: string, days: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + days * 86_400_000;
  const d = new Date(t);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
const easter = (offset: number) => (y: number) => addDays(easterSunday(y), offset);
/** Buß- und Bettag: the Wednesday before 23 November. */
const repentanceDay = (y: number) => {
  const nov23 = new Date(Date.UTC(y, 10, 23)).getUTCDay(); // 0 = Sunday
  const back = ((nov23 - 3 + 7) % 7) || 7;
  return addDays(ymd(y, 11, 23), -back);
};

const n = (ckb: string, kmr: string, de: string, en: string, ar: string, fa: string, tr: string): HolidayNames => ({ ckb, kmr, de, en, ar, fa, tr });

const NEW_YEAR = n("سەری ساڵی زایینی", "Sersal", "Neujahr", "New Year's Day", "رأس السنة الميلادية", "سال نو میلادی", "Yılbaşı");
const LABOUR = n("ڕۆژی کرێکاران", "Roja Karkeran", "Tag der Arbeit", "Labour Day", "عيد العمال", "روز کارگر", "Emek ve Dayanışma Günü");
const CHRISTMAS = n("کریسمس", "Noel", "1. Weihnachtstag", "Christmas Day", "عيد الميلاد", "کریسمس", "Noel");

const RULES: Record<string, readonly Rule[]> = {
  DE: [
    { key: "new-year", date: fixed(1, 1), names: NEW_YEAR },
    { key: "epiphany", regions: ["baden-wuerttemberg", "bayern", "sachsen-anhalt"], date: fixed(1, 6), names: n("ڕۆژی سێ پاشاکە", "Roja Sê Padîşahan", "Heilige Drei Könige", "Epiphany", "عيد الغطاس", "عید ظهور", "Üç Kral Yortusu") },
    { key: "womens-day", regions: ["berlin", "mecklenburg-vorpommern"], date: fixed(3, 8), names: n("ڕۆژی جیهانیی ئافرەتان", "Roja Jinan a Navneteweyî", "Internationaler Frauentag", "International Women's Day", "اليوم العالمي للمرأة", "روز جهانی زن", "Dünya Kadınlar Günü") },
    { key: "good-friday", date: easter(-2), names: n("هەینیی پیرۆز", "Îniya Pîroz", "Karfreitag", "Good Friday", "الجمعة العظيمة", "جمعه نیک", "Kutsal Cuma") },
    { key: "easter-monday", date: easter(1), names: n("دووشەممەی جەژنی پاک", "Duşema Paskalyayê", "Ostermontag", "Easter Monday", "اثنين الفصح", "دوشنبه عید پاک", "Paskalya Pazartesi") },
    { key: "labour-day", date: fixed(5, 1), names: LABOUR },
    { key: "ascension", date: easter(39), names: n("ڕۆژی بەرزبوونەوە", "Hilkişîna Îsa", "Christi Himmelfahrt", "Ascension Day", "عيد الصعود", "عید صعود", "İsa'nın Göğe Yükselişi") },
    { key: "whit-monday", date: easter(50), names: n("دووشەممەی پەنتیکۆست", "Duşema Pentîkostê", "Pfingstmontag", "Whit Monday", "اثنين العنصرة", "دوشنبه پنطیکاست", "Pentekost Pazartesi") },
    { key: "corpus-christi", regions: ["baden-wuerttemberg", "bayern", "hessen", "nordrhein-westfalen", "rheinland-pfalz", "saarland"], date: easter(60), names: n("جەژنی کۆرپوس کریستی", "Corpus Christi", "Fronleichnam", "Corpus Christi", "عيد القربان", "عید جسم مسیح", "Corpus Christi") },
    { key: "assumption", regions: ["saarland"], date: fixed(8, 15), names: n("جەژنی بەرزبوونەوەی مەریەم", "Hilkişîna Meryemê", "Mariä Himmelfahrt", "Assumption Day", "عيد انتقال العذراء", "عروج مریم", "Meryem'in Göğe Kabulü") },
    { key: "childrens-day", regions: ["thueringen"], date: fixed(9, 20), names: n("ڕۆژی جیهانیی منداڵان", "Roja Zarokan a Cîhanî", "Weltkindertag", "World Children's Day", "يوم الطفل العالمي", "روز جهانی کودک", "Dünya Çocuk Günü") },
    { key: "unity-day", date: fixed(10, 3), names: n("ڕۆژی یەکگرتنەوەی ئەڵمانیا", "Roja Yekîtiya Almanyayê", "Tag der Deutschen Einheit", "German Unity Day", "يوم الوحدة الألمانية", "روز وحدت آلمان", "Alman Birliği Günü") },
    { key: "reformation-day", regions: ["brandenburg", "bremen", "hamburg", "mecklenburg-vorpommern", "niedersachsen", "sachsen", "sachsen-anhalt", "schleswig-holstein", "thueringen"], date: fixed(10, 31), names: n("ڕۆژی چاکسازیی ئایینی", "Roja Reformasyonê", "Reformationstag", "Reformation Day", "يوم الإصلاح", "روز اصلاحات", "Reform Günü") },
    { key: "all-saints", regions: ["baden-wuerttemberg", "bayern", "nordrhein-westfalen", "rheinland-pfalz", "saarland"], date: fixed(11, 1), names: n("ڕۆژی هەموو پیرۆزەکان", "Roja Hemû Pîrozan", "Allerheiligen", "All Saints' Day", "عيد جميع القديسين", "روز همه مقدسین", "Azizler Günü") },
    { key: "repentance-day", regions: ["sachsen"], date: repentanceDay, names: n("ڕۆژی تەوبە و نوێژ", "Roja Tobe û Diayê", "Buß- und Bettag", "Day of Repentance and Prayer", "يوم التوبة والصلاة", "روز توبه و دعا", "Tövbe ve Dua Günü") },
    { key: "christmas", date: fixed(12, 25), names: CHRISTMAS },
    { key: "boxing-day", date: fixed(12, 26), names: n("دووەم ڕۆژی کریسمس", "Roja Duyem a Noelê", "2. Weihnachtstag", "Boxing Day", "ثاني أيام عيد الميلاد", "دومین روز کریسمس", "Noel'in İkinci Günü") },
  ],
  IQ: [
    { key: "new-year", date: fixed(1, 1), names: NEW_YEAR },
    { key: "army-day", date: fixed(1, 6), names: n("ڕۆژی سوپای عێراق", "Roja Artêşa Iraqê", "Tag der Armee", "Army Day", "عيد الجيش العراقي", "روز ارتش عراق", "Ordu Günü") },
    { key: "nowruz", date: fixed(3, 21), names: n("نەورۆز", "Newroz", "Nouruz", "Nowruz", "عيد نوروز", "نوروز", "Nevruz") },
    { key: "labour-day", date: fixed(5, 1), names: LABOUR },
    { key: "national-day", date: fixed(10, 3), names: n("ڕۆژی نیشتمانیی عێراق", "Roja Neteweyî ya Iraqê", "Nationalfeiertag", "National Day", "اليوم الوطني العراقي", "روز ملی عراق", "Ulusal Gün") },
    { key: "victory-day", date: fixed(12, 10), names: n("ڕۆژی سەرکەوتن", "Roja Serketinê", "Tag des Sieges", "Victory Day", "يوم النصر", "روز پیروزی", "Zafer Günü") },
    { key: "christmas", date: fixed(12, 25), names: CHRISTMAS },
  ],
};

/** Countries with holiday data (others have none). */
export const HOLIDAY_COUNTRIES = Object.keys(RULES);

/** Public holidays on a local calendar date ("YYYY-MM-DD") in a country and, optionally, a region (state). */
export function holidaysOn(countryCode: string | null | undefined, regionSlug: string | null | undefined, date: string): Holiday[] {
  const rules = RULES[(countryCode ?? "").toUpperCase()];
  if (!rules || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const year = Number(date.slice(0, 4));
  return rules
    .filter((r) => !r.regions || (regionSlug ? r.regions.includes(regionSlug) : false))
    .filter((r) => r.date(year) === date)
    .map((r) => ({ key: r.key, date, names: r.names }));
}
