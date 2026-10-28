/**
 * Typo correction for search ("did you mean"). Pure: no I/O, shared by the search page and the tests.
 *
 * The vocabulary is built from the `searchText` of public records only, so a correction always points at words that
 * really occur in listings (a suggestion never leads to an empty page and never reveals hidden records). A query word
 * that already occurs (as a substring, the same rule the search uses) is never changed; an unknown word is replaced by
 * the closest vocabulary word within a small, length-dependent edit distance. Typical Sorani spelling variants that
 * survive `normalizeSearch` (ڕ/ر, ڵ/ل, ێ/ی, ۆ/و) count as half an edit, so "کارواان" or "سلیمانی" are found.
 */
import { searchTokens } from "./text";

export type Vocabulary = {
  words: Map<string, number>;
  text: string;
  /** The same words as code-point arrays, for the distance search (built once per vocabulary). */
  entries: { word: string; chars: string[]; count: number; mask: number }[];
};

/** Distinct words longer than one character are counted once per record (document frequency). Bounded. */
export function buildVocabulary(texts: Iterable<string>, maxWords = 20_000): Vocabulary {
  const words = new Map<string, number>();
  const parts: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    parts.push(text);
    for (const w of new Set(text.split(/[\s,.;:!?؟،؛()[\]{}"'«»/\\|+*]+/u))) {
      if (w.length < 2) continue;
      const n = words.get(w);
      if (n !== undefined) words.set(w, n + 1);
      else if (words.size < maxWords) words.set(w, 1);
    }
  }
  // "\n" never occurs inside a normalized search text, so substring checks never match across two records.
  const entries = [...words].map(([word, count]) => { const chars = [...word]; return { word, chars, count, mask: letterMask(chars) }; });
  return { words, text: parts.join("\n"), entries };
}

/** Pairs that are often confused in Sorani writing even after keyboard folding. */
const NEAR = new Set(["ڕر", "رڕ", "ڵل", "لڵ", "ێی", "یێ", "ۆو", "وۆ"]);
const subCost = (a: string, b: string) => (a === b ? 0 : NEAR.has(a + b) ? 0.5 : 1);

/** Letters as bits (near letters share one bit). A query letter whose bit a word lacks costs at least one edit. */
const SAME_BIT: Record<string, string> = { "ڕ": "ر", "ڵ": "ل", "ێ": "ی", "ۆ": "و" };
const bit = (c: string) => 1 << ((SAME_BIT[c] ?? c).codePointAt(0)! % 31);
function letterMask(chars: string[]): number {
  let m = 0;
  for (const c of chars) m |= bit(c);
  return m;
}

/** Optimal-string-alignment distance (insert, delete, substitute, swap neighbours), stops early above `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  const x = [...a];
  const y = [...b];
  if (Math.abs(x.length - y.length) > max) return Infinity;
  let prev2: number[] = [];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= y.length; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + subCost(x[i - 1], y[j - 1]));
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return Infinity;
    prev2 = prev;
    prev = cur;
  }
  return prev[y.length];
}

/** Edits allowed for a word of this length: short words must be nearly exact, so they are not "corrected" wildly. */
export function allowedEdits(length: number): number {
  if (length <= 2) return 0;
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 3;
}

/**
 * Smallest distance between `word` and `target` or any prefix of it (the search matches substrings, so a typed word
 * may be the start of a longer one). One table, at most `word.length + max` columns; Infinity when above `max`.
 */
function prefixDistance(x: string[], y: string[], max: number, rows: Float64Array[]): number {
  const n = Math.min(y.length, x.length + max);
  let prev2 = rows[0], prev = rows[1], cur = rows[2];
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= x.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + subCost(x[i - 1], y[j - 1]));
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return Infinity;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  let best = Infinity;
  for (let j = 1; j <= n; j++) if (prev[j] < best) best = prev[j];
  return best;
}

/** Closest vocabulary word for one unknown query word, or null. Ties: smaller distance, then more records, then shorter. */
export function correctWord(word: string, vocab: Vocabulary): string | null {
  const x = [...word];
  const max = allowedEdits(x.length);
  if (max === 0) return null;
  const width = x.length + max + 1;
  const rows = [new Float64Array(width), new Float64Array(width), new Float64Array(width)];
  const xBits = x.map(bit);
  let best: { w: string; d: number; n: number; l: number } | null = null;
  for (const e of vocab.entries) {
    if (e.chars.length < x.length - max) continue;
    let missing = 0;
    for (const b of xBits) if (!(e.mask & b) && ++missing > max) break;
    if (missing > max) continue;
    const d = prefixDistance(x, e.chars, best ? Math.min(max, best.d) : max, rows);
    if (d > max || d === 0) continue;
    if (!best || d < best.d || (d === best.d && (e.count > best.n || (e.count === best.n && e.chars.length < best.l)))) {
      best = { w: e.word, d, n: e.count, l: e.chars.length };
    }
  }
  return best?.w ?? null;
}

export type Correction = { query: string; changed: string[] };

/**
 * Corrected query when at least one word is unknown and has a close match; null otherwise. Known words, function
 * words and numbers are kept as typed. Only the search words (function words dropped) form the corrected query.
 */
export function correctQuery(q: string, vocab: Vocabulary): Correction | null {
  const tokens = searchTokens(q);
  if (tokens.length === 0 || vocab.words.size === 0) return null;
  const changed: string[] = [];
  const out = tokens.map((t) => {
    if (/^\d+$/.test(t) || vocab.text.includes(t)) return t;
    const fix = correctWord(t, vocab);
    if (!fix) return t;
    changed.push(t);
    return fix;
  });
  return changed.length ? { query: out.join(" "), changed } : null;
}
