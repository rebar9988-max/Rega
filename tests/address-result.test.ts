import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAddressResults } from "../src/lib/address-result";
const feature = (properties: Record<string, unknown>, coordinates: unknown[] = [7.1, 51]) => ({ type: "Feature", geometry: { type: "Point", coordinates }, properties });
test("address components come only from provider fields", () => {
  const [hit] = parseAddressResults({ features: [feature({ street: "Hauptstraße", housenumber: "12a", postcode: "51465", city: "Bergisch Gladbach", countrycode: "de" })] });
  assert.equal(hit.houseNumber, "12a"); assert.equal(hit.postalCode, "51465"); assert.equal(hit.countryCode, "DE");
  assert.equal(parseAddressResults({ features: [feature({ name: "Village" })] })[0].houseNumber, "");
});
test("rejects invalid coordinates and malformed responses without inventing addresses", () => {
  for (const coords of [[null, 51], [7, "51"], [181, 51], [0, 0]]) assert.deepEqual(parseAddressResults({ features: [feature({ name: "X" }, coords)] }), []);
  for (const body of [null, {}, { features: [null, {}, feature({})] }]) assert.deepEqual(parseAddressResults(body), []);
});
test("typed postal and settlement features use their provider-classified name", () => {
  const [postal] = parseAddressResults({ features: [feature({ osm_key: "place", osm_value: "postcode", name: "51465", city: "Bergisch Gladbach" })] });
  assert.equal(postal.postalCode, "51465");
  const [village] = parseAddressResults({ features: [feature({ osm_key: "place", osm_value: "village", name: "Dorf" })] });
  assert.equal(village.city, "Dorf"); assert.equal(village.street, "");
});
