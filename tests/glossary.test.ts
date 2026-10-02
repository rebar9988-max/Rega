import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LOCALES } from "../src/config/locales";
import { GLOSSARY, GLOSSARY_KEYS, type GlossaryTerm } from "../src/config/glossary";

const load = (l: string) => JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8")) as Record<string, Record<string, unknown>>;
const at = (m: Record<string, Record<string, unknown>>, path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], m);

test("glossary: every term exists in every locale", () => {
  for (const term of Object.keys(GLOSSARY) as GlossaryTerm[]) for (const l of LOCALES) assert.ok(GLOSSARY[term][l]?.trim(), `${term}.${l}`);
});

test("one term per concept: navigation, page titles and buttons use the glossary words in every locale", () => {
  for (const l of LOCALES) {
    const m = load(l);
    for (const term of Object.keys(GLOSSARY_KEYS) as GlossaryTerm[]) {
      for (const path of GLOSSARY_KEYS[term]) assert.equal(at(m, path), GLOSSARY[term][l], `${l}: ${path} must be "${GLOSSARY[term][l]}" (glossary: ${term})`);
    }
  }
});

test("Sorani never calls businesses 'کارگە' (workshop); Kurmanji is labelled 'Kurmancî (Badînî)' and 'Badini' alone is gone", () => {
  const ckb = JSON.stringify(load("ckb"));
  assert.ok(!ckb.includes("کارگە"));
  for (const l of LOCALES) assert.ok(!/\bBadini\b/.test(JSON.stringify(load(l))), l);
});

test("one tagline in every locale (footer and hero say the same thing)", () => {
  for (const l of LOCALES) {
    const m = load(l);
    const tagline = m.footer.tagline as string;
    assert.ok(tagline.length > 10);
    assert.ok(/(Europe|Europa|ئەوروپا|Ewropa|أوروبا|اروپا|Avrupa)/.test(tagline), `${l}: tagline mentions Europe`);
    assert.ok(!/(weltweit|worldwide|جیهان|cîhan|العالم|dünya)/i.test(`${tagline} ${m.home.brandSub}`), `${l}: no 'worldwide' scope`);
  }
});
