/**
 * Search intent: "open now" written into the search text ("دەرمانخانە لە عەنکاوە ئێستا کراوە", "pharmacy open now",
 * "صيدلية مفتوحة الآن"). Every search word must occur in a record, and no record contains the words "now" / "open",
 * so such a query found nothing. The phrase is recognised only when both an "open" word and a "now" word are present,
 * removed from the text query and turned into the open-now filter. Pure: shared by the search page and the tests.
 */
import { normalizeSearch, searchTokens } from "./text";

const fold = (words: string[]) => new Set(words.map((w) => normalizeSearch(w)));

/** "Open" in the seven UI languages (adjective and the common inflected forms). */
const OPEN_WORDS = fold([
  "کراوە", "کراوەیە", "کراوەن", // ckb
  "vekirî", "vekiriye", // kmr
  "geöffnet", "offen", "geoeffnet", // de
  "open", // en
  "مفتوح", "مفتوحة", "مفتوحه", // ar
  "باز", // fa
  "açık", "acik", // tr
]);
/** "Now" in the seven UI languages. */
const NOW_WORDS = fold([
  "ئێستا", "ئیستا", // ckb
  "niha", // kmr
  "jetzt", "gerade", // de
  "now", // en
  "الآن", "الان", "حاليا", "حالياً", // ar
  "اکنون", "الان", "حالا", "هم‌اکنون", // fa
  "şimdi", "simdi", // tr
]);

/** `intentWords`: the recognised "open"/"now" words, so a rewritten query (typo correction) can keep the intent. */
export type SearchIntent = { text: string; openNow: boolean; intentWords?: string[] };

export function parseSearchIntent(q: string | null | undefined): SearchIntent {
  const text = q ?? "";
  const tokens = searchTokens(text, 16);
  const hasOpen = tokens.some((w) => OPEN_WORDS.has(w));
  const hasNow = tokens.some((w) => NOW_WORDS.has(w));
  if (!hasOpen || !hasNow) return { text, openNow: false };
  const isIntent = (w: string) => OPEN_WORDS.has(w) || NOW_WORDS.has(w);
  return { text: tokens.filter((w) => !isIntent(w)).join(" "), openNow: true, intentWords: tokens.filter(isIntent) };
}
