import test from "node:test";
import assert from "node:assert/strict";
import { parseSearchIntent } from "../src/lib/search-intent";
import { searchTokens } from "../src/lib/text";

test("'open now' in any UI language becomes the open-now filter; the rest is searched", () => {
  const cases: [string, string][] = [
    ["دەرمانخانە لە عەنکاوە ئێستا کراوە", "دەرمانخانە عەنکاوە"],
    ["دەرمانخانە ئێستا کراوەیە", "دەرمانخانە"],
    ["pharmacy open now", "pharmacy"],
    ["Apotheke jetzt geöffnet", "apotheke"],
    ["صيدلية مفتوحة الآن", "صیدلیە"],
    ["eczane şimdi açık", "eczane"],
    ["dermanxane niha vekirî", "dermanxane"],
    ["داروخانه اکنون باز", "داروخانە"],
  ];
  for (const [q, rest] of cases) {
    const intent = parseSearchIntent(q);
    assert.equal(intent.openNow, true, q);
    assert.deepEqual(searchTokens(intent.text), searchTokens(rest), q);
  }
});

test("only both words together are an intent; names and plain queries are untouched", () => {
  for (const q of ["Open Kitchen", "کراوە", "ئێستا", "میکانیکی ئۆتۆمبێل لە هەولێر", "", "now"]) {
    assert.deepEqual(parseSearchIntent(q), { text: q, openNow: false }, q);
  }
  assert.deepEqual(parseSearchIntent(null), { text: "", openNow: false });
});

test("'open now' alone lists every open business", () => {
  assert.deepEqual(parseSearchIntent("ئێستا کراوە"), { text: "", openNow: true });
});
