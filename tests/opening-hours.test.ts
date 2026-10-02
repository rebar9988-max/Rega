import test from "node:test";
import assert from "node:assert/strict";
import { hasHours, hoursRows, normalizeDay, parseOpeningHours } from "../src/lib/opening-hours";
import { isOpenNow } from "../src/lib/geo";

test("day values are validated and normalized", () => {
  assert.equal(normalizeDay("9:00-17:00"), "09:00–17:00");
  assert.equal(normalizeDay("09:00 – 12:00, 14:00-18:30"), "09:00–12:00, 14:00–18:30");
  assert.equal(normalizeDay("20:00–02:00"), "20:00–02:00");
  assert.equal(normalizeDay("closed"), "closed");
  assert.equal(normalizeDay("داخراوە"), "closed");
  assert.equal(normalizeDay(""), "");
  for (const bad of ["9-17", "25:00-26:00", "09:00", "09:00-09:00", "abc", "09:00-12:00-14:00", "09:60-10:00"]) assert.equal(normalizeDay(bad), null, bad);
});

test("a week is parsed; unknown days and bad values are rejected; all-empty means unknown", () => {
  assert.deepEqual(parseOpeningHours({ mon: "9:00-17:00", sun: "closed", tue: "" }), { ok: true, value: { mon: "09:00–17:00", sun: "closed" } });
  assert.deepEqual(parseOpeningHours({ mon: "", tue: " " }), { ok: true, value: null });
  assert.deepEqual(parseOpeningHours({ mon: "nope" }), { ok: false, invalid: ["mon"] });
  assert.deepEqual(parseOpeningHours({ holiday: "09:00-10:00" }), { ok: false, invalid: ["holiday"] });
});

test("display rows are Monday first and tolerate bad data", () => {
  assert.deepEqual(hoursRows({ sun: "closed", mon: "09:00–17:00" }).map((r) => r.day), ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  assert.equal(hoursRows(null).length, 7);
  assert.equal(hasHours(null), false);
  assert.equal(hasHours({ mon: "09:00–17:00" }), true);
  assert.equal(hasHours([1, 2]), false);
});

test("open now: never falsely open; unknown stays unknown", () => {
  const wedNoonBerlin = new Date("2026-09-30T10:00:00Z");
  assert.equal(isOpenNow({ wed: "09:00–17:00" }, "DE", wedNoonBerlin), true);
  assert.equal(isOpenNow({ wed: "closed", thu: "09:00–17:00" }, "DE", wedNoonBerlin), false);
  assert.equal(isOpenNow({ mon: "closed" }, "DE", wedNoonBerlin), false); // explicitly known, not open today
  assert.equal(isOpenNow({ wed: "all day" }, "DE", wedNoonBerlin), null); // nothing readable -> unknown, not open
  assert.equal(isOpenNow({ wed: "09:00-12:00-13:00" }, "DE", wedNoonBerlin), null);
  assert.equal(isOpenNow([], "DE", wedNoonBerlin), null);
  assert.equal(isOpenNow({}, "DE", wedNoonBerlin), null);
});
