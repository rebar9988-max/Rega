import test from "node:test";
import assert from "node:assert/strict";
import { foldArabicScript, normalizeBasic, normalizeSearch, searchTokens } from "../src/lib/text";
import { textWhere } from "../src/lib/search-where";
import { composeSearchText } from "../src/lib/search-index";
import { queryTerms } from "../src/lib/ai/query";

test("Kurdish/Arabic keyboard variants fold to one form", () => {
  // ك→ک, ي/ى→ی, ه/ھ/ة→ە — the same word typed on an Arabic keyboard matches the Kurdish spelling.
  assert.equal(normalizeSearch("كوردستان"), normalizeSearch("کوردستان"));
  assert.equal(normalizeSearch("سليماني"), normalizeSearch("سلیمانی")); // Arabic ي vs Persian/Kurdish ی
  assert.equal(normalizeSearch("هەولێر"), normalizeSearch("ھەولێر"));
  assert.equal(normalizeSearch("چێشتخانه"), normalizeSearch("چێشتخانە"));
  assert.equal(normalizeSearch("مدرسة"), normalizeSearch("مدرسه"));
  assert.equal(normalizeSearch("مصطفى"), normalizeSearch("مصطفی"));
  assert.equal(foldArabicScript("أحمد إبراهيم"), "احمد ابراەیم"); // ه is folded like ە, on data and query alike
});

test("folding keeps distinct Kurdish letters and strips only marks", () => {
  for (const ch of ["ئ", "ێ", "ۆ", "ڕ", "ڵ", "ڤ", "گ", "چ", "پ", "ژ"]) assert.ok(normalizeSearch(`x${ch}y`).includes(ch), ch);
  assert.equal(normalizeSearch("مُحَمَّد"), "محمد");
  assert.equal(normalizeSearch("كـــتاب"), normalizeSearch("کتاب"));
  assert.equal(normalizeSearch("٢٠٢٦ ۲۰۲۶"), "2026 2026");
  assert.equal(normalizeSearch("  Café   Straße "), "cafe straße");
});

test("the basic normalization used for slugs is unchanged (no letter folding)", () => {
  assert.equal(normalizeBasic("Zagros  Café"), "zagros cafe");
  assert.equal(normalizeBasic("هەولێر"), "هەولێر".normalize("NFKD"));
});

test("search tokens: split, deduplicate, drop 1-letter noise, cap", () => {
  assert.deepEqual(searchTokens("Rechtsberatung  in Berlin, Berlin!"), ["rechtsberatung", "berlin"]);
  assert.deepEqual(searchTokens("a b c"), []);
  assert.deepEqual(searchTokens("چێشتخانە، هەولێر؟"), ["چێشتخانە", "ەەولێر"]);
  assert.equal(searchTokens("w1 w2 w3 w4 w5 w6 w7 w8 w9 w10").length, 8);
  assert.deepEqual(searchTokens(""), []);
  assert.deepEqual(searchTokens(null), []);
});

test("search tokens: function words are not required matches, unless they are the whole query", () => {
  assert.deepEqual(searchTokens("چێشتخانە لە هەولێر"), ["چێشتخانە", "ەەولێر"]);
  assert.deepEqual(searchTokens("مطعم في أربيل"), ["مطعم", "اربیل"]);
  assert.deepEqual(searchTokens("Restaurant in Erbil"), ["restaurant", "erbil"]);
  assert.deepEqual(searchTokens("Restaurant der Stadt"), ["restaurant", "stadt"]);
  assert.deepEqual(searchTokens("رستوران در اربیل"), ["رستوران", "اربیل"]);
  assert.deepEqual(searchTokens("in"), ["in"]);
  assert.deepEqual(searchTokens("لە بۆ"), ["لە", "بۆ"]);
  assert.deepEqual(textWhere("مطعم في أربيل"), { AND: [{ searchText: { contains: "مطعم" } }, { searchText: { contains: "اربیل" } }] });
});

test("textWhere: every word must match, in any order", () => {
  assert.deepEqual(textWhere("Berlin Recht"), { AND: [{ searchText: { contains: "berlin" } }, { searchText: { contains: "recht" } }] });
  assert.deepEqual(textWhere("   "), {});
  assert.deepEqual(textWhere(undefined), {});
});

test("search text: normalized, de-duplicated, bounded", () => {
  const text = composeSearchText(["Zagros Restaurant", "zagros restaurant", "چێشتخانەی زاگرۆس", null, "Erbil", "هەولێر"]);
  assert.equal(text, "zagros restaurant چێشتخانەی زاگرۆس erbil ەەولێر");
  assert.ok(composeSearchText(["x".repeat(7000)]).length <= 6000);
  // A query typed on an Arabic keyboard finds the Kurdish record.
  assert.ok(text.includes(normalizeSearch("هەولێر")));
  assert.ok(text.includes(searchTokens("چێشتخانه")[0]));
});

test("AI retrieval terms: the sentence is split, filler dropped, affix variants added", () => {
  const terms = queryTerms("باشترین چێشتخانە لە هەولێر");
  assert.deepEqual(terms.map((t) => t[0]), ["چێشتخانە", "ەەولێر"]);
  assert.ok(queryTerms("چێشتخانەکان").some((vs) => vs.includes("چێشتخانە")));
  assert.deepEqual(queryTerms("Gute Restaurants in Erbil").map((t) => t[0]), ["restaurants", "erbil"]);
  assert.deepEqual(queryTerms("Which businesses are verified?").map((t) => t[0]), ["businesses", "verified"]);
  assert.ok(queryTerms("المطعم").some((vs) => vs.includes("مطعم")));
  assert.deepEqual(queryTerms("لە بۆ و"), []);
});
