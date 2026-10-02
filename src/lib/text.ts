/**
 * Text normalization. Pure (no I/O): shared by the server, the seed and the tests.
 *
 * `normalizeBasic` is the long-standing form (lower case, accents removed, single spaces); slugs are built from it.
 * `normalizeSearch` adds Arabic-script folding on top, so the same word matches however it was typed: Kurdish,
 * Arabic and Persian keyboards produce different code points for the "same" letter. Both the stored search columns
 * and every query go through `normalizeSearch`, so folding is symmetric and never changes what a word matches
 * except to make keyboard variants equal.
 */

/** Lower case, accents removed, whitespace collapsed. */
export function normalizeBasic(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Arabic-script letter variants folded to one form:
 * ك→ک, ي/ى/ې→ی, ه/ھ/ة/ۀ→ە (Arabic keyboards type ه for Kurdish ە; the fold is applied to data and query alike),
 * أ/إ/آ/ٱ→ا, ؤ→و, ئ stays (it is a letter of its own in Kurdish).
 * Harakat, tatweel and zero-width joiners/non-joiners are removed; Arabic-Indic and Persian digits become 0-9.
 */
const FOLD: Record<string, string> = {
  "ك": "ک", "ي": "ی", "ى": "ی", "ې": "ی",
  "ه": "ە", "ھ": "ە", "ة": "ە", "ۀ": "ە",
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ؤ": "و",
};
const FOLD_RE = new RegExp(`[${Object.keys(FOLD).join("")}]`, "g");

export function foldArabicScript(input: string): string {
  return input
    .replace(/[ً-ٰٟۖ-ۭـ​-‏⁠﻿]/g, "")
    .replace(FOLD_RE, (c) => FOLD[c] ?? c)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Normalizes free text for the denormalized search columns and for queries against them. */
export function normalizeSearch(input: string): string {
  // NFKC first (presentation forms -> base letters, composed hamza letters kept whole), then fold. Latin accents are
  // removed by decomposing and recomposing, so Arabic-script letters such as ئ come back whole and stay distinct.
  return foldArabicScript(input.normalize("NFKC").toLowerCase())
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/** Search terms of a query: normalized, split on whitespace and punctuation, de-duplicated, capped. */
export function searchTokens(input: string | null | undefined, max = 8): string[] {
  if (!input) return [];
  const words = normalizeSearch(input)
    .split(/[\s,.;:!?؟،؛()[\]{}"'«»/\\|+*]+/u)
    .map((w) => w.replace(/^[-_]+|[-_]+$/g, ""))
    .filter((w) => w.length >= 2 || /^\d$/.test(w));
  return [...new Set(words)].slice(0, max);
}
