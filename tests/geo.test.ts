import test from "node:test";
import assert from "node:assert/strict";
import { boundingBox, coarsen, distanceKm, isOpenNow, parseRanges, timezoneFor } from "../src/lib/geo";

test("distance: known city pairs within 1%", () => {
  const berlin = { lat: 52.52, lng: 13.405 };
  const hamburg = { lat: 53.5511, lng: 9.9937 };
  const d = distanceKm(berlin, hamburg);
  assert.ok(Math.abs(d - 255.3) / 255.3 < 0.01, String(d));
  assert.equal(distanceKm(berlin, berlin), 0);
});

test("bounding box contains the whole radius and is clamped", () => {
  const c = { lat: 50, lng: 8 };
  const b = boundingBox(c, 10);
  for (const p of [{ lat: 50.089, lng: 8 }, { lat: 50, lng: 8.139 }, { lat: 49.94, lng: 7.9 }]) {
    assert.ok(distanceKm(c, p) <= 10.05);
    assert.ok(p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng, JSON.stringify(p));
  }
  const pole = boundingBox({ lat: 89.9, lng: 0 }, 500);
  assert.ok(pole.maxLat <= 90 && pole.minLng >= -180 && pole.maxLng <= 180);
});

test("coordinates are coarsened (~110 m)", () => {
  assert.equal(coarsen(52.520008), 52.52);
  assert.equal(coarsen(13.40495), 13.405);
});

test("opening hours: parsing, timezones, overnight and unknown", () => {
  assert.deepEqual(parseRanges("09:00–17:00"), [[540, 1020]]);
  assert.deepEqual(parseRanges("09:00-12:00, 14:00-18:00"), [[540, 720], [840, 1080]]);
  assert.deepEqual(parseRanges("closed"), []);
  assert.equal(timezoneFor("de"), "Europe/Berlin");
  assert.equal(timezoneFor("XX"), "UTC");
  // Wednesday 2026-09-30 10:00 UTC = 12:00 in Berlin (CEST)
  const wedNoonBerlin = new Date("2026-09-30T10:00:00Z");
  assert.equal(isOpenNow({ wed: "09:00–17:00" }, "DE", wedNoonBerlin), true);
  assert.equal(isOpenNow({ wed: "13:00–17:00" }, "DE", wedNoonBerlin), false);
  assert.equal(isOpenNow({ mon: "09:00–17:00" }, "DE", wedNoonBerlin), false);
  assert.equal(isOpenNow(null, "DE", wedNoonBerlin), null);
  assert.equal(isOpenNow({ note: "call us" }, "DE", wedNoonBerlin), null);
  // Overnight: Tue 20:00–02:00 is still open on Wed 01:00 local
  assert.equal(isOpenNow({ tue: "20:00–02:00" }, "DE", new Date("2026-09-29T23:00:00Z")), true);
  // Same instant is 02:00 in Baghdad (UTC+3): a Wed 01:00–03:00 slot there is open
  assert.equal(isOpenNow({ wed: "01:00–03:00" }, "IQ", new Date("2026-09-29T23:00:00Z")), true);
});
