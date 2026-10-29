import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LOCALES, LOCALE_META, dirOf } from "../src/config/locales";
import { countryFlag, countryName } from "../src/lib/content";
import { MARKET_COUNTRY_CODES } from "../src/lib/data/markets";
import { COUNTRIES, CITIES } from "../prisma/seed-data/geography";

const TARGET_LOCALES = ["ckb", "kmr", "de", "en", "ar", "tr", "fa", "fr", "sv", "nl", "it"];
const TARGET_COUNTRIES = ["DE", "FR", "SE", "NL", "GB", "BE", "AT", "CH", "GR", "NO", "DK", "FI", "IT"];
const NATIVE: Record<string, string> = { ckb: "کوردیی سۆرانی", kmr: "Kurmancî", de: "Deutsch", en: "English", ar: "العربية", tr: "Türkçe", fa: "فارسی", fr: "Français", sv: "Svenska", nl: "Nederlands", it: "Italiano" };
const RTL = new Set(["ckb", "ar", "fa"]);

test("the 11 target languages are registered exactly once, with their native labels and direction", () => {
  assert.equal(new Set(LOCALES).size, LOCALES.length);
  assert.deepEqual([...LOCALES].sort(), [...TARGET_LOCALES].sort());
  for (const l of TARGET_LOCALES) {
    const meta = LOCALE_META[l as keyof typeof LOCALE_META];
    assert.equal(meta.nativeName, NATIVE[l], l);
    assert.equal(dirOf(l), RTL.has(l) ? "rtl" : "ltr", l);
    assert.doesNotThrow(() => new Intl.Locale(meta.htmlLang), meta.htmlLang);
  }
});

test("the 13 target markets are configured once and seeded once", () => {
  assert.deepEqual([...MARKET_COUNTRY_CODES].sort(), [...TARGET_COUNTRIES].sort());
  assert.equal(new Set(MARKET_COUNTRY_CODES).size, 13);
  for (const c of TARGET_COUNTRIES) {
    assert.equal(COUNTRIES.filter((x) => x.code === c).length, 1, c);
    assert.ok(CITIES.some((x) => x.country === c), `${c} has a city`);
  }
});

test("143 language × country combinations: every country has a real name and a flag in every language", () => {
  let checked = 0;
  for (const l of TARGET_LOCALES) {
    const messages = JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8")) as { locations: { country: string } };
    assert.ok(messages.locations.country.trim(), `${l}: country label`);
    for (const code of TARGET_COUNTRIES) {
      const seed = COUNTRIES.find((c) => c.code === code)!;
      const row = { code, nameEn: seed.names.en, nameCkb: seed.names.ckb, nameKmr: seed.names.kmr, nameDe: seed.names.de, nameAr: seed.names.ar, nameFa: seed.names.fa, nameTr: seed.names.tr };
      const name = countryName(row, l as (typeof LOCALES)[number]);
      assert.ok(name && name !== code, `${l}/${code}: ${name}`);
      assert.equal([...countryFlag(code)].length, 2, `${l}/${code} flag`);
      checked++;
    }
  }
  assert.equal(checked, 143);
});

test("countryName: stored names win; languages without a column use the CLDR name", () => {
  const row = { code: "IT", nameEn: "Italy", nameCkb: "ئیتاڵیا", nameDe: "Italien" };
  assert.equal(countryName(row, "ckb"), "ئیتاڵیا");
  assert.equal(countryName(row, "de"), "Italien");
  assert.equal(countryName(row, "it"), "Italia");
  assert.equal(countryName(row, "fr"), "Italie");
  assert.equal(countryName(row, "nl"), "Italië");
  assert.equal(countryName(row, "sv"), "Italien");
  assert.equal(countryFlag("de"), "🇩🇪");
  assert.equal(countryFlag("DEU"), "");
});

test("ICU placeholders and rich-text tags of every new catalogue match English", () => {
  const flat = (o: unknown, p = ""): [string, string][] =>
    o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => flat(v, `${p}${k}.`)) : [[p.slice(0, -1), String(o)]];
  const en = new Map(flat(JSON.parse(readFileSync("src/messages/en.json", "utf8"))));
  const tokens = (s: string) => [...s.matchAll(/\{[a-zA-Z]+\}|<\/?[a-z]+>/g)].map((m) => m[0]).sort().join(" ");
  for (const l of ["fr", "sv", "nl", "it"]) {
    for (const [key, text] of flat(JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8")))) {
      assert.equal(tokens(text), tokens(en.get(key) ?? ""), `${l}:${key}`);
      assert.ok(text.trim(), `${l}:${key} empty`);
      // An apostrophe right before a placeholder would escape it in ICU MessageFormat.
      assert.doesNotMatch(text, /'\{/, `${l}:${key}`);
    }
  }
});
