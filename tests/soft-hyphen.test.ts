import test from "node:test";
import assert from "node:assert/strict";
import { softHyphenate } from "../src/lib/soft-hyphen";

const SHY = String.fromCharCode(0xad);
const show = (s: string) => s.split(SHY).join("-");

test("long Latin words get syllable break points", () => {
  assert.equal(show(softHyphenate("Administration & Paperwork")), "Admi-nis-tra-tion & Paperwork");
  assert.equal(show(softHyphenate("Verwaltung & Behördenangelegenheiten")), "Ver-wal-tung & Behör-de-nan-ge-le-gen-hei-ten");
  assert.equal(show(softHyphenate("Translation")), "Trans-la-tion");
  assert.equal(show(softHyphenate("Gesundheit")), "Gesund-heit");
  assert.equal(show(softHyphenate("Gastronomiebetriebe")), "Gas-tro-no-mie-be-triebe");
});

test("removing the soft hyphens gives back the original text", () => {
  for (const s of ["Verwaltung & Behördenangelegenheiten", "Construction & Crafts", "Übersetzung", "Education & Tutoring"]) {
    assert.equal(softHyphenate(s).split(SHY).join(""), s);
  }
});

test("short words, digraphs and Arabic script stay untouched", () => {
  assert.equal(softHyphenate("Legal"), "Legal");
  assert.equal(softHyphenate("Food & Drink"), "Food & Drink");
  assert.equal(softHyphenate("Education"), "Education"); // under 10 letters
  assert.equal(softHyphenate("خزمەتگوزاریی یاسایی"), "خزمەتگوزاریی یاسایی");
  assert.ok(!softHyphenate("Rechtsanwaltschaften").includes(`s${SHY}ch`), "sch is never split");
  assert.ok(!softHyphenate("Rechtsanwaltschaften").includes(`c${SHY}h`), "ch is never split");
  // At least three letters before the first and after the last break.
  for (const w of ["Administration", "Behördenangelegenheiten", "Restaurants", "Gastronomiebetriebe"]) {
    const parts = softHyphenate(w).split(SHY);
    assert.ok(parts[0].length >= 3 && parts[parts.length - 1].length >= 3, show(softHyphenate(w)));
  }
});
