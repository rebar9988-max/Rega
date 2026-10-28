import test from "node:test";
import assert from "node:assert/strict";
import { allowedEdits, buildVocabulary, correctQuery, correctWord, editDistance } from "../src/lib/search-correction";
import { composeSearchText } from "../src/lib/search-index";
import { normalizeSearch } from "../src/lib/text";

// Search texts as the index stores them (names, category, city, services), built with the production function.
const vocab = buildVocabulary([
  composeSearchText(["Karwans Hairtuning", "سەرتاشخانەی کاروان", "Friseur", "سەرتاشخانە", "حلاق", "Barbershop", "هەولێر", "Erbil", "أربيل"]),
  composeSearchText(["Taakline", "دەرمانخانەی شیفا", "دەرمانخانە", "صيدلية", "Apotheke", "Pharmacy", "Eczane", "Dermanxane", "داروخانه", "عەنکاوە", "Ankawa"]),
  composeSearchText(["میکانیکی ئۆتۆمبێل", "چاککردنەوەی ئۆتۆمبێل", "Autowerkstatt", "Car repair", "سلێمانی", "Sulaymaniyah"]),
]);

const fix = (q: string) => correctQuery(q, vocab)?.query ?? null;

test("edit distance: insert, delete, substitute, swap and Sorani near-letters", () => {
  assert.equal(editDistance("kitten", "sitting"), 3);
  assert.equal(editDistance("apotheke", "apohteke"), 1); // swapped neighbours
  assert.equal(editDistance("ڕانیە", "رانیە"), 0.5); // ڕ / ر
  assert.equal(editDistance("سلێمانی", "سلیمانی"), 0.5); // ێ / ی
  assert.equal(editDistance("abc", "xyz", 1), Infinity); // stops early above the limit
  assert.deepEqual([2, 3, 4, 5, 8, 9].map(allowedEdits), [0, 1, 1, 2, 2, 3]);
});

test("misspelled words in the seven languages are corrected to words of public listings", () => {
  assert.equal(fix("دەرمانخانا"), normalizeSearch("دەرمانخانە")); // ckb: wrong final letter
  assert.equal(fix("دەرمانخنە"), normalizeSearch("دەرمانخانە")); // ckb: missing letter
  assert.equal(fix("سلیمانی"), normalizeSearch("سلێمانی")); // ckb: ی for ێ
  assert.equal(fix("عنکاوە"), normalizeSearch("عەنکاوە")); // ckb: missing ە
  assert.equal(fix("صيدليه"), null); // ar: ة/ه and ي/ی are already equal after keyboard folding, nothing to correct
  assert.equal(fix("صدلية"), normalizeSearch("صيدلية")); // ar: missing letter
  assert.equal(fix("apohteke"), "apotheke"); // de: swapped letters
  assert.equal(fix("pharmcy"), "pharmacy"); // en
  assert.equal(fix("barbershp"), "barbershop"); // en
  assert.equal(fix("frisuer"), "friseur"); // de
  assert.equal(fix("hairtunig"), "hairtuning"); // brand name
  assert.equal(fix("eczne"), "eczane"); // tr
  assert.equal(fix("dermanxne"), "dermanxane"); // kmr
  assert.equal(fix("داروخنه"), normalizeSearch("داروخانه")); // fa
});

test("only unknown words change; known words, prefixes, function words and numbers stay", () => {
  assert.equal(fix("دەرمانخانە لە عنکاوە"), `${normalizeSearch("دەرمانخانە")} ${normalizeSearch("عەنکاوە")}`);
  assert.equal(fix("pharmacy"), null); // known
  assert.equal(fix("pharm"), null); // a prefix already matches (substring search)
  assert.equal(fix("pharmcy 24"), "pharmacy 24");
  assert.equal(correctQuery("pharmcy in Ankawa", vocab)?.changed.join(), "pharmcy");
});

test("no wild guesses: unrelated and very short words are left alone", () => {
  assert.equal(fix("xyzqw"), null);
  assert.equal(fix("قطار"), null);
  assert.equal(fix("ab"), null); // two letters: never corrected
  assert.equal(correctWord("zzzzzzzzzz", vocab), null);
  assert.equal(correctQuery("pharmcy", buildVocabulary([])), null);
});

test("a typed prefix with a typo matches the start of a longer word", () => {
  assert.equal(fix("autowerkst"), null); // correct prefix: found by the substring search, nothing to fix
  assert.equal(fix("autowerksat"), "autowerkstatt");
});

test("vocabulary: document frequency breaks ties and the word cap is respected", () => {
  const v = buildVocabulary(["cafe one", "cafe two", "cave"]);
  assert.equal(v.words.get("cafe"), 2);
  assert.equal(correctWord("cafa", v), "cafe"); // cafe (2 records) beats cave (1) at the same distance
  assert.equal(buildVocabulary(["aa bb cc dd"], 2).words.size, 2);
});
