import test from "node:test";
import assert from "node:assert/strict";
import { addressLine } from "../src/lib/address";

test("addressLine joins street, postcode and city without trailing commas", () => {
  assert.equal(addressLine({ addressLine1: "Bonner Str. 2a,", postalCode: "53909" }, "Zülpich"), "Bonner Str. 2a, 53909 Zülpich");
  assert.equal(addressLine({ addressLine1: "Karl-Marx-Allee 12", addressLine2: "Hof 2" }, "بەرلین"), "Karl-Marx-Allee 12, Hof 2, بەرلین");
});

test("addressLine does not repeat a city the street line already names, in any of its names", () => {
  assert.equal(addressLine({ addressLine1: "Zagros, Erbil, Erbil Governorate, Iraq" }, "Erbil"), "Zagros, Erbil, Erbil Governorate, Iraq");
  // Kurdish page: the localized city is هەولێر, but the stored street names it in English.
  assert.equal(addressLine({ addressLine1: "Zagros, Erbil, Iraq" }, "هەولێر", ["Erbil"]), "Zagros, Erbil, Iraq");
  assert.equal(addressLine({ addressLine1: "zagros, erbil", postalCode: "44001" }, "Erbil"), "zagros, erbil, 44001");
  assert.equal(addressLine({ addressLine1: "" }, null), "");
});
