/**
 * Question -> search terms for REGA AI retrieval. Pure (no I/O): unit-tested.
 * The whole sentence is never used as one substring: it is split into words, filler words are dropped, and each
 * remaining word gets its common Kurdish/Arabic affix variants.
 */
import { FUNCTION_WORDS, normalizeSearch, searchTokens } from "../text";

/** Words that carry no search meaning (question words, prepositions, filler) in the seven UI languages. */
const STOPWORDS = new Set([
  ...FUNCTION_WORDS,
  ...[
    // ckb
    "لە", "بۆ", "و", "بە", "کە", "ئەو", "ئەم", "چی", "کێ", "کوێ", "لەکوێ", "کام", "چۆن", "من", "تۆ", "بدۆزەوە", "پیشانم", "بدە", "هەیە", "هەن", "دەوێت", "دەمەوێت",
    "ناو", "لەناو", "لەسەر", "یان", "تکایە", "چەند", "ئایا", "هەندێک", "نزیک", "نزیکی", "نزیکترین", "باشترین", "باش", "باشە", "دەگەڕێم", "شوێنی", "شوێنێک",
    // kmr
    "li", "ji", "bo", "û", "an", "çi", "ku", "kîjan", "baştirîn", "baş", "min", "ez", "nêzîk",
    // de
    "der", "die", "das", "den", "dem", "ein", "eine", "einen", "in", "im", "am", "an", "mit", "für", "und", "oder", "ist", "sind", "gibt", "es", "wo", "welche", "welcher",
    "beste", "besten", "bester", "gute", "guten", "guter", "gut", "mir", "mich", "bitte", "finde", "zeige", "suche", "nach", "von", "zu", "bei", "nähe", "ich",
    // en
    "the", "a", "an", "in", "at", "on", "of", "for", "and", "or", "is", "are", "where", "which", "what", "best", "good", "find", "me", "show", "near", "nearby", "please", "i", "any", "some",
    // ar / fa
    "في", "من", "إلى", "الى", "على", "عن", "ما", "هل", "أين", "اين", "افضل", "أفضل", "اريد", "أريد", "لي", "او", "أو",
    "در", "از", "به", "که", "کجا", "بهترین", "خوب", "برای", "یک", "می‌خواهم",
    // tr
    "ve", "ile", "için", "en", "iyi", "nerede", "hangi", "bir", "bana", "bul", "yakın", "yakınında",
  ].map((w) => normalizeSearch(w)),
]);

/** "Best / highest rated" wording in any UI language: results are then ordered by rating (only real ratings count). */
export const BEST_RE = /(باشترین|best|beste|besten|افضل|أفضل|بهترین|baştirîn|en iyi)/iu;
/** "Verified" wording: restrict to verified businesses. */
export const VERIFIED_RE = /(پشتڕاستکراو|verifiziert|verified|موثق|موثّق|تأیید|doğrulan|piştrastkirî)/iu;

/** Common Sorani/Arabic affixes, so "چێشتخانەکان" also finds "چێشتخانەی …" and "المطعم" finds "مطعم". */
const SUFFIXES = ["ەکانی", "ەکان", "یەکان", "کانی", "کان", "ەکەی", "ەکە", "یەکە", "ەوە", "ێکی", "ێک", "یەک", "دا"].map((s) => normalizeSearch(s)).sort((a, b) => b.length - a.length);
function variants(token: string): string[] {
  const out = new Set([token]);
  // Every matching suffix gives a variant ("…خانەکان" -> "…خانە" and "…خان"): after a vowel the suffix is "کان", after
  // a consonant "ەکان", and the stem is not known in advance.
  for (const s of SUFFIXES) if (token.length - s.length >= 3 && token.endsWith(s)) out.add(token.slice(0, -s.length));
  if (token.startsWith("ال") && token.length >= 5) out.add(token.slice(2));
  return [...out];
}

/** Meaningful search terms of a question, each with its spelling variants. Exported for tests. */
export function queryTerms(query: string): string[][] {
  return searchTokens(query, 12).filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t)).slice(0, 6).map(variants);
}

