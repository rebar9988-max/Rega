/**
 * Soft-hyphen break points for long Latin-script words in narrow labels (home category tiles).
 *
 * `hyphens: auto` needs a hyphenation dictionary that not every browser has, so a long word such as
 * "Administration" or "Behördenangelegenheiten" could break at an arbitrary letter or overflow its tile.
 * U+00AD is invisible unless the line breaks there, and accessible names and text matching ignore it.
 *
 * Rules: words of 10+ letters only; a consonant cluster between two vowels splits so that the next syllable
 * starts with a single consonant or a common onset such as "tr", "br", "pl" (Ad-mi-nis-tra-tion,
 * Trans-la-tion, Ge-sund-heit); digraphs (ch, sch, ck, ph, th, qu) stay together; at least 3 letters on
 * each side. Arabic-script text is never touched (a soft hyphen there could interfere with letter joining).
 */
const SHY = "\u00AD";
const MIN_WORD = 10;
const MIN_SIDE = 3;
const VOWELS = new Set("aeiouyäöüàâæéèêëîïôœùûáíóúãõåø");
const DIGRAPHS = ["sch", "ch", "ck", "ph", "th", "qu"];
const ONSETS = new Set(["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "tr"]);
const LATIN_WORD = /^\p{Script=Latin}+$/u;

function isVowel(ch: string) {
  return VOWELS.has(ch.toLowerCase());
}

/** Indexes where a break may go (a break at i splits the word into word.slice(0, i) and word.slice(i)). */
function breakPoints(word: string): number[] {
  const lower = word.toLowerCase();
  const points: number[] = [];
  let i = 0;
  while (i < word.length) {
    if (!isVowel(word[i])) { i++; continue; }
    // Collect the consonant run after this vowel, keeping digraphs as one unit.
    const units: number[] = [];
    let j = i + 1;
    while (j < word.length && !isVowel(word[j])) {
      units.push(j);
      const d = DIGRAPHS.find((g) => lower.startsWith(g, j));
      j += d ? d.length : 1;
    }
    if (j >= word.length) break; // no vowel follows: the word ends in this cluster
    if (units.length > 0) {
      // Longest suffix of the cluster that can start a syllable; a single consonant always can.
      let k = units.length - 1;
      for (let m = 0; m < units.length - 1; m++) {
        if (ONSETS.has(lower.slice(units[m], j))) { k = m; break; }
      }
      points.push(units[k]);
    }
    i = j;
  }
  return points.filter((p) => p >= MIN_SIDE && word.length - p >= MIN_SIDE);
}

export function softHyphenate(text: string): string {
  return text.replace(/\S+/g, (word) => {
    if (word.length < MIN_WORD || !LATIN_WORD.test(word)) return word;
    const points = new Set(breakPoints(word));
    let out = "";
    for (let k = 0; k < word.length; k++) out += (points.has(k) ? SHY : "") + word[k];
    return out;
  });
}
