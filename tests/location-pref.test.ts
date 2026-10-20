import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCATION_PREF_MAX_AGE_MS,
  explicitlyAllCities,
  foldSearch,
  nearestCity,
  parseLocationPref,
  queryVariants,
  rankByQuery,
  savedCityQuery,
  serializeLocationPref,
} from "../src/lib/location-pref";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);

test("a saved place survives a round trip and keeps only the three expected ids", () => {
  const raw = serializeLocationPref({ cityId: "cl9abc123", countryCode: "de", regionId: "cl9reg456" }, NOW);
  assert.ok(raw);
  assert.deepEqual(parseLocationPref(raw, NOW + 1000), { cityId: "cl9abc123", countryCode: "DE", regionId: "cl9reg456", savedAt: NOW });
  assert.deepEqual(Object.keys(JSON.parse(raw!)).sort(), ["cityId", "countryCode", "regionId", "savedAt", "v"]);
});

test("a missing parent is stored as null, a bad city id is never written", () => {
  assert.deepEqual(parseLocationPref(serializeLocationPref({ cityId: "abc" }, NOW), NOW), { cityId: "abc", countryCode: null, regionId: null, savedAt: NOW });
  assert.equal(serializeLocationPref({ cityId: "" }, NOW), null);
  assert.equal(serializeLocationPref({ cityId: "a b" }, NOW), null);
  assert.equal(serializeLocationPref({ cityId: "x".repeat(65) }, NOW), null);
  assert.equal(serializeLocationPref({ cityId: "<script>" }, NOW), null);
});

test("stored values that are malformed, foreign, tampered with or stale are ignored", () => {
  assert.equal(parseLocationPref(null, NOW), null);
  assert.equal(parseLocationPref("", NOW), null);
  assert.equal(parseLocationPref("not json", NOW), null);
  assert.equal(parseLocationPref("[]", NOW), null);
  assert.equal(parseLocationPref(JSON.stringify({ v: 2, cityId: "abc", savedAt: NOW }), NOW), null);
  assert.equal(parseLocationPref(JSON.stringify({ v: 1, cityId: "../etc", savedAt: NOW }), NOW), null);
  assert.equal(parseLocationPref(JSON.stringify({ v: 1, cityId: "abc" }), NOW), null);
  assert.equal(parseLocationPref(JSON.stringify({ v: 1, cityId: "abc", savedAt: NOW - LOCATION_PREF_MAX_AGE_MS - 1 }), NOW), null);
  assert.equal(parseLocationPref(JSON.stringify({ v: 1, cityId: "abc", savedAt: NOW + 3 * 24 * 60 * 60 * 1000 }), NOW), null);
  // A bad optional field does not discard the city, it is only dropped.
  const partly = parseLocationPref(JSON.stringify({ v: 1, cityId: "abc", countryCode: "Germany", regionId: "no way", savedAt: NOW }), NOW);
  assert.deepEqual(partly, { cityId: "abc", countryCode: null, regionId: null, savedAt: NOW });
});

test("a saved city fills in a list URL only when the visitor did not choose one", () => {
  const pref = parseLocationPref(serializeLocationPref({ cityId: "berlin1" }, NOW), NOW);
  assert.equal(savedCityQuery("", pref), "city=berlin1");
  assert.equal(savedCityQuery("?q=recht&page=3", pref), "q=recht&city=berlin1");
  assert.equal(savedCityQuery("?city=hamburg1", pref), null);
  assert.equal(savedCityQuery("?city=", pref), null, "an explicit empty city means all cities");
  assert.equal(savedCityQuery("", null), null);
  assert.equal(explicitlyAllCities("?city="), true);
  assert.equal(explicitlyAllCities("?q=a&city="), true);
  assert.equal(explicitlyAllCities("?city=berlin1"), false);
  assert.equal(explicitlyAllCities(""), false);
});

test("search folding ignores case, accents and ß", () => {
  assert.equal(foldSearch("KÖLN"), "koln");
  assert.equal(foldSearch("Straße"), "strasse");
  assert.equal(foldSearch("  Düsseldorf "), "dusseldorf");
  assert.equal(foldSearch("هەولێر"), "هەولێر");
});

test("query variants cover the typed text, the German transliteration and the accent-free form", () => {
  assert.deepEqual(queryVariants("Köln"), ["köln", "koeln", "koln"]);
  assert.deepEqual(queryVariants("München"), ["münchen", "muenchen", "munchen"]);
  assert.deepEqual(queryVariants("koeln"), ["koeln", "köln"], "a transliteration also finds the umlaut spelling");
  assert.deepEqual(queryVariants("Düsseldorf"), ["düsseldorf", "duesseldorf", "dusseldorf"]);
  assert.deepEqual(queryVariants("berlin"), ["berlin"]);
  assert.deepEqual(queryVariants("   "), []);
  assert.ok(queryVariants("a".repeat(100)).length === 1);
});

test("matches that start with the query come first and the result is bounded", () => {
  const cities = [
    { id: "1", names: ["Neuberlin"] },
    { id: "2", names: ["Berlin", "بەرلین"] },
    { id: "3", names: ["Bernau bei Berlin"] },
    { id: "4", names: ["Hamburg"] },
  ];
  const names = (c: { names: string[] }) => c.names;
  assert.deepEqual(rankByQuery(cities, "ber", names).map((c) => c.id), ["2", "3", "1"]);
  assert.deepEqual(rankByQuery(cities, "BERLIN", names).map((c) => c.id), ["2", "1", "3"]);
  assert.deepEqual(rankByQuery(cities, "بەر", names).map((c) => c.id), ["2"]);
  assert.deepEqual(rankByQuery(cities, "zzz", names), []);
  assert.deepEqual(rankByQuery(cities, "", names, 2).map((c) => c.id), ["1", "2"]);
  assert.equal(rankByQuery(Array.from({ length: 100 }, (_, i) => ({ id: String(i), names: [`Stadt ${i}`] })), "stadt", names).length, 40);
  assert.deepEqual(rankByQuery([{ id: "k", names: ["Köln"] }], "koln", names).map((c) => c.id), ["k"]);
  assert.deepEqual(rankByQuery([{ id: "k", names: ["Köln"] }], "köln", names).map((c) => c.id), ["k"]);
});

test("nearby detection offers the closest known city and nothing when the position is far from all of them", () => {
  const cities = [
    { id: "berlin", latitude: 52.52, longitude: 13.405 },
    { id: "potsdam", latitude: 52.3906, longitude: 13.0645 },
    { id: "hamburg", latitude: 53.5511, longitude: 9.9937 },
    { id: "nowhere", latitude: null, longitude: null },
  ];
  const potsdamCentre = nearestCity({ lat: 52.40, lng: 13.06 }, cities);
  assert.equal(potsdamCentre?.city.id, "potsdam");
  assert.ok((potsdamCentre?.km ?? 99) < 2);
  assert.equal(nearestCity({ lat: 52.53, lng: 13.4 }, cities)?.city.id, "berlin");
  assert.equal(nearestCity({ lat: 48.1351, lng: 11.582 }, cities), null, "Munich is farther than 60 km from every listed city");
  const far = nearestCity({ lat: 48.1351, lng: 11.582 }, cities, 1000);
  assert.ok(far && ["berlin", "potsdam"].includes(far.city.id) && far.km > 400, "a wider limit finds the closest of the listed cities");
  assert.equal(nearestCity({ lat: 0, lng: 0 }, []), null);
});
