import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LOCALES, LOCALE_META } from "../src/i18n/locales";
import { localize } from "../src/lib/content";

const load = (l: string) => JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8"));
const flat = (o: Record<string, unknown>, p = ""): Record<string, string> =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.entries(flat(v as Record<string, unknown>, `${p}${k}.`)) : [[`${p}${k}`, JSON.stringify(v)]],
  ).reduce((a, [k, v]) => ({ ...a, [k as string]: v as string }), {});

test("every catalogue has exactly the same keys as ckb", () => {
  const base = Object.keys(flat(load("ckb"))).sort();
  for (const l of LOCALES) assert.deepEqual(Object.keys(flat(load(l))).sort(), base, `keys differ in ${l}`);
});

test("direction matches the real script of each catalogue", () => {
  const arabic = /[؀-ۿ]/g;
  for (const l of LOCALES) {
    const text = Object.values(flat(load(l))).join(" ");
    const ratio = (text.match(arabic)?.length ?? 0) / text.length;
    const expected = LOCALE_META[l].dir === "rtl";
    assert.equal(ratio > 0.3, expected, `${l}: script/direction mismatch (arabic ratio ${ratio.toFixed(2)})`);
  }
});

test("localize: own translation wins and carries lang + dir", () => {
  const r = localize({ name: "Cafe", nameCkb: "کافێ" }, "name", "ckb");
  assert.deepEqual([r.text, r.lang, r.dir, r.fallback], ["کافێ", "ckb-IQ", "rtl", false]);
});

test("localize: canonical text is German, unknown language elsewhere", () => {
  assert.equal(localize({ name: "Cafe" }, "name", "de").fallback, false);
  const r = localize({ name: "Cafe" }, "name", "ar");
  assert.deepEqual([r.text, r.dir, r.fallback], ["Cafe", "auto", true]);
});

test("localize: falls back across translations and tolerates missing columns", () => {
  const r = localize({ name: "x", nameAr: "مقهى" }, "name", "ckb");
  assert.deepEqual([r.text, r.lang, r.fallback], ["مقهى", "ar", true]);
  assert.equal(localize({}, "name", "tr").text, "");
});
