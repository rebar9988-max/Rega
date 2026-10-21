import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_HOME, BUSINESS_LIST, BUSINESS_NEW, isBusinessDestination } from "../src/features/business/paths";
import { edgeCacheKey } from "../src/lib/edge-cache";

test("business context only accepts canonical existing destinations", () => {
  for (const path of [BUSINESS_HOME, BUSINESS_LIST, BUSINESS_NEW]) assert.equal(isBusinessDestination(path), true);
  for (const path of [undefined, null, "//evil.example", "/\\evil.example", "/dr", "/en/account", `${BUSINESS_HOME}?next=//evil.example`]) assert.equal(isBusinessDestination(path), false);
});

test("business entry, workspace and form never enter the shared edge cache", () => {
  for (const locale of ["ckb", "kmr", "de", "en", "ar", "tr", "fa"]) {
    for (const suffix of ["", "?add=1"]) assert.equal(edgeCacheKey(new Request(`https://www.regaplatform.com/${locale}/business-owner${suffix}`)), null);
  }
  for (const path of [BUSINESS_HOME, BUSINESS_LIST, BUSINESS_NEW]) assert.equal(edgeCacheKey(new Request(`https://www.regaplatform.com${path}`)), null);
});
