import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCoordinate, publishReadiness } from "../src/lib/coordinates";
import { isCompletePostalCode, parseNominatim, parsePostal } from "../src/lib/geocoder-parse";

test("isValidCoordinate: range, finiteness and the (0, 0) placeholder", () => {
  assert.equal(isValidCoordinate(52.52, 13.405), true);
  assert.equal(isValidCoordinate(-90, -180), true);
  assert.equal(isValidCoordinate(90.0001, 10), false);
  assert.equal(isValidCoordinate(10, 180.5), false);
  assert.equal(isValidCoordinate(0, 0), false);
  assert.equal(isValidCoordinate(NaN, 1), false);
  assert.equal(isValidCoordinate(null, 1), false);
  assert.equal(isValidCoordinate("52", "13"), false);
});

const complete = { name: "Test GmbH", categoryId: "c1", primary: { addressLine1: "Oranienstraße 1", cityId: "berlin", countryCode: "DE", latitude: 52.5, longitude: 13.4, coordsVerifiedAt: new Date() } };

test("publishReadiness: complete business with a confirmed location may be published", () => {
  assert.deepEqual(publishReadiness(complete), { ok: true, missing: [] });
});

test("publishReadiness: no location, unconfirmed or invalid location, or missing fields block publishing", () => {
  assert.deepEqual(publishReadiness({ ...complete, primary: null }).missing, ["address", "city", "country", "location", "locationVerified"]);
  assert.deepEqual(publishReadiness({ ...complete, primary: { ...complete.primary, coordsVerifiedAt: null } }).missing, ["locationVerified"]);
  assert.deepEqual(publishReadiness({ ...complete, primary: { ...complete.primary, latitude: 0, longitude: 0 } }).missing, ["location"]);
  assert.deepEqual(publishReadiness({ ...complete, primary: { ...complete.primary, latitude: 95 } }).missing, ["location"]);
  assert.deepEqual(publishReadiness({ ...complete, categoryId: null, name: " " }).missing, ["name", "category"]);
});

test("parseNominatim: precision from the result type, invalid rows dropped, values rounded", () => {
  const hits = parseNominatim([
    { lat: "52.5022381", lon: "13.4180123", addresstype: "building", display_name: "1, Oranienstraße, Berlin" },
    { lat: "52.5", lon: "13.41", addresstype: "road", display_name: "Oranienstraße, Berlin" },
    { lat: "52.52", lon: "13.405", addresstype: "city", display_name: "Berlin" },
    { lat: "999", lon: "13", addresstype: "building" },
    { lat: "0", lon: "0", addresstype: "building" },
    "garbage",
  ]);
  assert.deepEqual(hits.map((h) => h.precision), ["address", "street", "area"]);
  assert.equal(hits[0].lat, 52.502238);
  assert.equal(hits[0].lng, 13.418012);
  assert.deepEqual(parseNominatim({ error: "x" }), []);
});

test("parsePostal returns the area centre and its city, town or village; rejects unusable rows", () => {
  assert.deepEqual(
    parsePostal([{ lat: "50.99180001", lon: "7.1363", display_name: "51465, Bergisch Gladbach, Deutschland", address: { postcode: "51465", city: "Bergisch Gladbach", county: "Rheinisch-Bergischer Kreis" } }]),
    { lat: 50.9918, lng: 7.1363, place: "Bergisch Gladbach", label: "51465, Bergisch Gladbach, Deutschland" },
  );
  assert.equal(parsePostal([{ lat: "47.1", lon: "9.5", address: { village: "Dorf", county: "Kreis" } }])?.place, "Dorf");
  assert.equal(parsePostal([{ lat: "47.1", lon: "9.5", address: { suburb: "Viertel" } }])?.place, "Viertel");
  assert.equal(parsePostal([{ lat: "47.1", lon: "9.5" }])?.place, "");
  assert.equal(parsePostal([{ lat: "0", lon: "0", address: { city: "X" } }, { lat: "48", lon: "11", address: { city: "München" } }])?.place, "München");
  assert.equal(parsePostal([]), null);
  assert.equal(parsePostal({ error: "x" }), null);
  assert.equal(parsePostal([{ lat: "abc", lon: "7" }]), null);
});

test("isCompletePostalCode waits for a whole code per country", () => {
  assert.ok(isCompletePostalCode("51465", "DE"));
  assert.ok(isCompletePostalCode(" 51465 ", "de"));
  assert.ok(!isCompletePostalCode("5146", "DE"));
  assert.ok(!isCompletePostalCode("514650", "DE"));
  assert.ok(!isCompletePostalCode("5146a", "DE"));
  assert.ok(isCompletePostalCode("1012 AB", "NL") && isCompletePostalCode("1012ab", "NL") && !isCompletePostalCode("1012", "NL"));
  assert.ok(isCompletePostalCode("1010", "AT") && !isCompletePostalCode("101", "AT"));
  assert.ok(isCompletePostalCode("114 55", "SE") && isCompletePostalCode("SW1A 1AA", "GB"));
  assert.ok(isCompletePostalCode("H3Z 2Y7", "CA") && !isCompletePostalCode("H3", "CA") && !isCompletePostalCode("", "CA"));
});
