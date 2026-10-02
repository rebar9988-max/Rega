import { test } from "node:test";
import assert from "node:assert/strict";
import { circleRing, forwardGeocode, reverseGeocode, zoomForRadius, type Place } from "../src/lib/geocode";
import { distanceKm } from "../src/lib/geo";

const places: Place[] = [
  { id: "ber", lat: 52.52, lng: 13.405, countryCode: "DE", names: ["Berlin", "بەرلین", "Berlîn"] },
  { id: "ham", lat: 53.55, lng: 9.99, countryCode: "DE", names: ["Hamburg", "هامبۆرگ"] },
  { id: "erb", lat: 36.191, lng: 44.009, countryCode: "IQ", names: ["Erbil", "هەولێر", "Hewlêr"] },
];

test("forwardGeocode matches any language, exact before prefix before contains, keeps input order", () => {
  assert.deepEqual(forwardGeocode("berl", places).map((p) => p.id), ["ber"]);
  assert.deepEqual(forwardGeocode("بەرلین", places).map((p) => p.id), ["ber"]);
  assert.deepEqual(forwardGeocode("HEWLÊR", places).map((p) => p.id), ["erb"]);
  assert.deepEqual(forwardGeocode("bur", places).map((p) => p.id), ["ham"]);
  assert.deepEqual(forwardGeocode("b", places), []);
  assert.deepEqual(forwardGeocode("zzz", places), []);
});

test("reverseGeocode returns the nearest known place within range, else null", () => {
  assert.equal(reverseGeocode({ lat: 52.5, lng: 13.3 }, places)?.id, "ber");
  assert.equal(reverseGeocode({ lat: 36.2, lng: 44.0 }, places)?.id, "erb");
  assert.equal(reverseGeocode({ lat: 48.1, lng: 11.6 }, places), null); // Munich: no known place within 40 km
});

test("zoomForRadius shrinks as the radius grows and stays in range", () => {
  assert.ok(zoomForRadius(1) > zoomForRadius(10));
  assert.ok(zoomForRadius(10) > zoomForRadius(100));
  assert.ok(zoomForRadius(0.1) <= 15 && zoomForRadius(10_000) >= 3);
});

test("circleRing is closed and every vertex lies on the radius", () => {
  const c = { lat: 52.52, lng: 13.405 };
  const ring = circleRing(c, 10);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  for (const [lng, lat] of ring) assert.ok(Math.abs(distanceKm(c, { lat, lng }) - 10) < 0.2);
});
