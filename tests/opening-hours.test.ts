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


test("appointment mode survives parsing and never advertises retained hours as open", () => {
  const parsed = parseOpeningHours({ mode: "appointment", mon: "00:00–24:00" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value?.mon, "00:00–24:00");
  assert.equal(parsed.value?.mode, "appointment");
  assert.equal(isOpenNow(parsed.value, "DE", new Date("2026-11-02T12:00:00Z")), null);
  assert.equal(parseOpeningHours({ mode: "invalid" }).ok, false);
});

test("24/7 is open on every day in both business timezones", () => {
  const hours = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(d => [d, "00:00–24:00"]));
  for (const country of ["DE", "IQ"]) for (let d = 1; d <= 7; d++) {
    assert.equal(isOpenNow(hours, country, new Date(`2026-11-0${d}T23:30:00Z`)), true);
  }
});

test("five-day metadata preserves weekday overrides and closed weekends", () => {
  const parsed = parseOpeningHours({ mode: "five", mon: "20:00-02:00", tue: "09:00-17:00", sat: "closed", sun: "closed" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(isOpenNow(parsed.value, "IQ", new Date("2026-11-02T22:30:00Z")), true);
  assert.equal(isOpenNow(parsed.value, "IQ", new Date("2026-11-07T10:00:00Z")), false);
});

test("master hours synchronize untouched selected days, preserve overrides and closed days", async () => {
  const { applyMasterHours } = await import("../src/lib/opening-hours");
  const settings = { start: "10:00", end: "19:00", chosen: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], customized: ["sat"] } as const;
  const editor = { ...settings, chosen: [...settings.chosen], customized: [...settings.customized] };
  const days = applyMasterHours({ sat: "09:00–17:00", sun: "closed" }, editor);
  assert.equal(days.mon, "10:00–19:00");
  assert.equal(days.fri, "10:00–19:00");
  assert.equal(days.sat, "09:00–17:00");
  assert.equal(days.sun, "closed");
  const changed = applyMasterHours({ ...days, mon: "10:00–07:00" }, { ...editor, start: "11:00", customized: ["mon", "sat"] });
  assert.equal(changed.mon, "10:00–07:00");
  assert.equal(changed.tue, "11:00–19:00");
  assert.equal(changed.sat, "09:00–17:00");
  assert.equal(changed.sun, "closed");
  const bulk = applyMasterHours(changed, { ...editor, chosen: ["sat"], start: "12:00", end: "07:00" }, true);
  assert.equal(bulk.sat, "12:00–07:00");
  assert.equal(bulk.mon, changed.mon);
  assert.equal(bulk.sun, "closed");
  assert.deepEqual(applyMasterHours(bulk, { ...editor, start: "", end: "" }), bulk);
});

test("editor settings and overnight schedules survive JSON save/reload without losing manual intent", async () => {
  const { readHoursEditor, applyMasterHours, composeOpeningHours } = await import("../src/lib/opening-hours");
  const editor = { start: "10:00", end: "07:00", chosen: ["mon", "tue", "sat"] as const, customized: ["sat"] as const };
  const stored = JSON.parse(JSON.stringify(composeOpeningHours({ mon: "10:00–07:00", tue: "10:00–07:00", sat: "09:00–17:00", sun: "closed", editor: { ...editor, chosen: [...editor.chosen], customized: [...editor.customized] } }, true, [{ from: "2026-12-25", to: "2026-12-25", hours: "closed" }])));
  const restored = readHoursEditor(stored.editor)!;
  assert.deepEqual(restored.customized, ["sat"]);
  const updated = applyMasterHours(stored, { ...restored, start: "11:00" });
  assert.equal(updated.mon, "11:00–07:00");
  assert.equal(updated.sat, "09:00–17:00");
  assert.equal(updated.sun, "closed");
  assert.equal(stored.holidays, "closed");
  assert.equal(stored.exceptions[0].hours, "closed");
  assert.equal(readHoursEditor({ ...editor, chosen: ["bogus"] }), undefined);
  assert.equal(readHoursEditor({ ...editor, start: "24:01" }), undefined);
  assert.equal(readHoursEditor(undefined), undefined);
  assert.equal(normalizeDay("10:00–07:00"), "10:00–07:00");
});
