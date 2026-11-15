import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SAVED_MAX, SAVED_STORAGE_KEY, isSavedSlug, parseSaved, parseSlugsParam, serializeSaved, toggleSaved } from "../src/lib/saved-businesses";

test("slugs follow the slugify alphabet (latin, digits, Arabic script, inner hyphens)", () => {
  for (const ok of ["kurdish-bakery", "a", "x1-2", "نانەواخانە-هەولێر"]) assert.equal(isSavedSlug(ok), true, ok);
  for (const bad of ["", "-x", "x-", "Upper", "a b", "a/b", "../etc", "<script>", 42, null, "a".repeat(161)]) assert.equal(isSavedSlug(bad), false, String(bad));
});

test("a saved list survives a round trip, newest first, without duplicates", () => {
  const raw = serializeSaved(["b", "a", "b"]);
  assert.deepEqual(parseSaved(raw), ["b", "a"]);
});

test("malformed or hostile stored values never throw and never leak invalid entries", () => {
  assert.deepEqual(parseSaved(null), []);
  assert.deepEqual(parseSaved("not json"), []);
  assert.deepEqual(parseSaved('{"a":1}'), []);
  assert.deepEqual(parseSaved('["ok", 5, "<x>", "fine-2"]'), ["ok", "fine-2"]);
});

test("toggle adds to the front and removes when already saved", () => {
  let list = toggleSaved([], "a");
  list = toggleSaved(list, "b");
  assert.deepEqual(list, ["b", "a"]);
  assert.deepEqual(toggleSaved(list, "a"), ["b"]);
  assert.deepEqual(toggleSaved(list, "Bad Slug"), ["b", "a"]);
});

test("the list is capped so one browser cannot grow it without bound", () => {
  const many = Array.from({ length: SAVED_MAX + 20 }, (_, i) => `b${i}`);
  assert.equal(parseSaved(JSON.stringify(many)).length, SAVED_MAX);
  assert.equal(toggleSaved(many, "new-one").length, SAVED_MAX);
  assert.equal(toggleSaved(many, "new-one")[0], "new-one");
});

test("the API slugs parameter is optional, trimmed, validated and capped", () => {
  assert.equal(parseSlugsParam(null), null);
  assert.deepEqual(parseSlugsParam(""), []);
  assert.deepEqual(parseSlugsParam(" a , b,,'or 1=1, a "), ["a", "b"]);
  assert.equal(parseSlugsParam(Array.from({ length: 300 }, (_, i) => `s${i}`).join(","))!.length, SAVED_MAX);
});

test("the public businesses API and the privacy texts both know about saved businesses", () => {
  const api = readFileSync(new URL("../src/app/api/v1/businesses/route.ts", import.meta.url), "utf8");
  assert.match(api, /parseSlugsParam/);
  for (const lang of ["de", "en", "tr", "ar", "fa", "ckb", "kmr"]) {
    const text = readFileSync(new URL(`../src/features/legal/texts/${lang}.ts`, import.meta.url), "utf8");
    assert.ok(text.includes(SAVED_STORAGE_KEY), `privacy text ${lang} lists ${SAVED_STORAGE_KEY}`);
  }
});
