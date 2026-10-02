import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES } from "../src/config/locales";
import { legalTexts } from "../src/features/legal";

const KEYS = ["impressum", "privacy", "terms"] as const;

test("legal texts exist for every locale and document, with identical structure to the German original", () => {
  const de = legalTexts("de", {});
  for (const l of LOCALES) {
    const t = legalTexts(l, {});
    for (const k of KEYS) {
      assert.equal(t[k].blocks.length, de[k].blocks.length, `${l}/${k}: block count differs from de`);
      t[k].blocks.forEach((b, i) => {
        assert.equal(Boolean(b.ul), Boolean(de[k].blocks[i].ul), `${l}/${k}/${i}: list presence differs`);
        assert.ok(b.h.trim().length > 0 && (b.p?.length || b.ul?.length), `${l}/${k}/${i}: empty block`);
      });
    }
  }
});

test("meta descriptions are 120–155 characters in every locale", () => {
  for (const l of LOCALES) for (const k of KEYS) {
    const n = legalTexts(l, {})[k].description.length;
    assert.ok(n >= 120 && n <= 155, `${l}/${k}: description is ${n} characters`);
  }
});

test("owner placeholders appear only when an owner field is empty, and are filled when set", () => {
  const empty = JSON.stringify(legalTexts("de", {}).impressum);
  assert.ok(empty.includes("[[LEGAL_NAME]]") && empty.includes("[[LEGAL_STREET_ADDRESS]]") && empty.includes("[[LEGAL_POSTAL_CODE_CITY]]"));
  const filled = JSON.stringify(legalTexts("de", { LEGAL_NAME: "Max Mustermann", LEGAL_STREET_ADDRESS: "Musterstr. 1", LEGAL_POSTAL_CODE_CITY: "50667 Köln", LEGAL_OPERATOR_TYPE: "Einzelunternehmen" }));
  assert.ok(filled.includes("Max Mustermann") && filled.includes("50667 Köln"));
  assert.ok(!legalTexts("de", { LEGAL_NAME: "Max Mustermann", LEGAL_STREET_ADDRESS: "x", LEGAL_POSTAL_CODE_CITY: "y", LEGAL_OPERATOR_TYPE: "z" }).impressum.blocks[0].p!.join(" ").includes("[["));
});

test("privacy policy documents what the code does: retention days, AI provider, no analytics, essential cookies only", () => {
  const p = JSON.stringify(legalTexts("en", { LEGAL_AI_PROVIDER: "ExampleAI Ltd" }).privacy);
  assert.ok(p.includes("30 days") && p.includes("ExampleAI Ltd") && p.includes("no cookie banner") && p.includes("no analytics"));
  const withAnalytics = JSON.stringify(legalTexts("en", { LEGAL_ANALYTICS_TOOL: "Plausible" }).privacy);
  assert.ok(withAnalytics.includes("Plausible") && !withAnalytics.includes("no analytics"));
});

test("terms are free of charge: no prices or currency, and the free-of-charge clause is present", () => {
  for (const l of ["de", "en"] as const) {
    const t = JSON.stringify(legalTexts(l, {}).terms).toLowerCase();
    assert.ok(t.includes("kostenlos") || t.includes("free of charge"));
    assert.ok(!/(€|\beur\b|\$|premium|bezahlte platzierung(?!en)|price list|preisliste)/.test(t), l);
  }
});

test("non-German pages point to the binding German version", () => {
  for (const l of LOCALES.filter((x) => x !== "de")) assert.ok(legalTexts(l, {}).ui.translationNote.length > 20 && legalTexts(l, {}).ui.germanLink.length > 3);
});
