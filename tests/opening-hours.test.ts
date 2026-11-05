import test from "node:test";
import assert from "node:assert/strict";
import { composeOpeningHours, guessHoursMode, hasHours, hasHoursInfo, hoursRows, isAppointmentOnly, normalizeDay, openingHoursMode, parseOpeningHours } from "../src/lib/opening-hours";
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

test("hours mode: stored, read and composed; never falls back to 'appointment' from mere absence", () => {
  const allDay = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, "00:00–24:00"]));
  assert.equal(openingHoursMode({ mode: "always_open" }), "always_open");
  assert.equal(openingHoursMode({ mode: "not_a_mode" }), null);
  assert.equal(openingHoursMode(null), null);
  assert.equal(openingHoursMode({}), null);

  assert.equal(isAppointmentOnly({ mode: "appointment" }), true);
  assert.equal(isAppointmentOnly({}), false);
  assert.equal(isAppointmentOnly(null), false);

  // Legacy data (no `mode` key) is guessed from the weekly shape; nothing at all or an unrecognised shape is "custom",
  // never "appointment" — unset hours mean "not filled in yet", not a deliberate appointment-only choice.
  assert.equal(guessHoursMode(allDay), "always_open");
  assert.equal(guessHoursMode({ mon: "09:00–17:00", tue: "09:00–17:00", wed: "09:00–17:00", thu: "09:00–17:00", fri: "09:00–17:00" }), "five_day");
  assert.equal(guessHoursMode({ mon: "09:00–17:00", tue: "09:00–17:00", wed: "09:00–17:00", thu: "09:00–17:00", fri: "09:00–17:00", sat: "closed", sun: "closed" }), "five_day");
  assert.equal(guessHoursMode({ mon: "09:00–17:00", tue: "10:00–18:00", wed: "09:00–17:00", thu: "09:00–17:00", fri: "09:00–17:00" }), "custom");
  assert.equal(guessHoursMode(null), "custom");
  assert.equal(guessHoursMode({}), "custom");
  // Stored hint always wins over the guess, even if the weekly shape alone would suggest something else.
  assert.equal(guessHoursMode({ ...allDay, mode: "custom" }), "custom");

  // composeOpeningHours stores the mode alongside the weekly data; appointment-only stores no weekly hours at all,
  // and an appointment-only location still counts as "has hours info" so its card isn't hidden on the profile.
  assert.deepEqual(composeOpeningHours({ mon: "09:00–17:00" }, false, [], "custom"), { mon: "09:00–17:00", mode: "custom" });
  assert.deepEqual(composeOpeningHours(null, false, [], "appointment"), { mode: "appointment" });
  assert.equal(hasHoursInfo({ mode: "appointment" }), true);
  assert.equal(hasHoursInfo(null), false);
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
