import test from "node:test";
import assert from "node:assert/strict";
import { addDays, easterSunday, holidaysOn } from "../src/lib/holidays";
import { isOpenNow, openStatus } from "../src/lib/geo";
import { composeOpeningHours, hoursExceptions, parseHoursExceptions } from "../src/lib/opening-hours";

const erbil = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+03:00`); // Iraq: UTC+3 all year
const berlin = (date: string, hhmm: string, offset = "+01:00") => new Date(`${date}T${hhmm}:00${offset}`);
const WEEK_9_17 = { mon: "09:00–17:00", tue: "09:00–17:00", wed: "09:00–17:00", thu: "09:00–17:00", fri: "09:00–17:00", sat: "09:00–17:00", sun: "09:00–17:00" };

test("holiday rules: Easter dates, German federal and state holidays, Iraq fixed dates", () => {
  assert.equal(easterSunday(2026), "2026-04-05");
  assert.equal(easterSunday(2027), "2027-03-28");
  assert.equal(easterSunday(2024), "2024-03-31");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  const keys = (cc: string, region: string | null, date: string) => holidaysOn(cc, region, date).map((h) => h.key);
  assert.deepEqual(keys("DE", null, "2026-04-03"), ["good-friday"]);
  assert.deepEqual(keys("DE", null, "2026-05-14"), ["ascension"]);
  assert.deepEqual(keys("DE", null, "2026-10-03"), ["unity-day"]);
  // State holidays only in their states.
  assert.deepEqual(keys("DE", "bayern", "2026-01-06"), ["epiphany"]);
  assert.deepEqual(keys("DE", "berlin", "2026-01-06"), []);
  assert.deepEqual(keys("DE", null, "2026-01-06"), []); // unknown state: no state holiday is assumed
  assert.deepEqual(keys("DE", "nordrhein-westfalen", "2026-06-04"), ["corpus-christi"]);
  assert.deepEqual(keys("DE", "sachsen", "2026-11-18"), ["repentance-day"]); // Wednesday before 23 November
  assert.deepEqual(keys("DE", "sachsen", "2027-11-17"), ["repentance-day"]);
  assert.deepEqual(keys("DE", "berlin", "2026-03-08"), ["womens-day"]);
  // Iraq: the fixed-date official holidays, country-wide (also in the Kurdistan Region).
  for (const d of ["2026-01-01", "2026-01-06", "2026-03-21", "2026-05-01", "2026-10-03", "2026-12-10", "2026-12-25"]) {
    assert.equal(holidaysOn("IQ", "kurdistan-region", d).length, 1, d);
  }
  assert.deepEqual(keys("IQ", null, "2026-07-14"), []); // not a public holiday under the 2024 law
  assert.deepEqual(keys("FR", null, "2026-01-01"), []); // no data: no holidays assumed
  assert.equal(holidaysOn("IQ", null, "2026-03-21")[0].names.ckb, "نەورۆز");
});

test("exceptions are validated: real dates, order, length, hours and a one-line reason", () => {
  assert.deepEqual(parseHoursExceptions([{ from: "2026-12-24", to: "2026-12-26", hours: "closed", reason: "  Family\nholiday " }]),
    { ok: true, value: [{ from: "2026-12-24", to: "2026-12-26", hours: "closed", reason: "Family holiday" }] });
  assert.deepEqual(parseHoursExceptions([{ from: "2026-12-31", hours: "10:00-14:00" }]), { ok: true, value: [{ from: "2026-12-31", to: "2026-12-31", hours: "10:00–14:00" }] });
  assert.deepEqual(parseHoursExceptions([
    { from: "2026-02-30", hours: "closed" }, // not a date
    { from: "2026-05-02", to: "2026-05-01", hours: "closed" }, // ends before it starts
    { from: "2026-01-01", to: "2027-06-01", hours: "closed" }, // longer than a year
    { from: "2026-05-01", hours: "9 to 5" }, // unreadable hours
    { from: "2026-05-01", hours: "closed" }, // valid
  ]), { ok: false, invalid: [0, 1, 2, 3] });
  assert.deepEqual(parseHoursExceptions(Array.from({ length: 31 }, () => ({ from: "2026-05-01", hours: "closed" }))), { ok: false, invalid: [-1] });
  assert.deepEqual(parseHoursExceptions(undefined), { ok: true, value: [] });
  // Stored data is read tolerantly: a broken entry is skipped, never thrown on.
  assert.equal(hoursExceptions({ exceptions: [{ from: "x" }, { from: "2026-05-01", hours: "closed" }] }).length, 1);
  assert.equal(composeOpeningHours(null, false, []), null);
  assert.deepEqual(composeOpeningHours({ mon: "09:00–17:00" }, true, []), { mon: "09:00–17:00", holidays: "closed" });
});

test("temporary closure: TEMPORARILY_CLOSED with its last day and reason; next opening after it", () => {
  const hours = { ...WEEK_9_17, exceptions: [{ from: "2026-10-28", to: "2026-11-02", hours: "closed", reason: "Renovation" }] };
  const s = openStatus(hours, "IQ", erbil("2026-10-28", "12:00"));
  assert.equal(s.status, "TEMPORARILY_CLOSED");
  assert.equal(s.exception?.to, "2026-11-02");
  assert.equal(s.exception?.reason, "Renovation");
  assert.deepEqual(s.next, { day: "tue", date: "2026-11-03", time: "09:00", inMinutes: 6 * 1440 - 180 });
  assert.equal(isOpenNow(hours, "IQ", erbil("2026-10-28", "12:00")), false);
  // Before and after the closure the weekly hours apply.
  assert.equal(openStatus(hours, "IQ", erbil("2026-10-27", "12:00")).status, "OPEN");
  assert.equal(openStatus(hours, "IQ", erbil("2026-11-03", "12:00")).status, "OPEN");
  // Still open the evening before: the closure only changes the next morning's state.
  assert.deepEqual(openStatus(hours, "IQ", erbil("2026-10-27", "16:30")).next, { day: "tue", date: "2026-10-27", time: "17:00", inMinutes: 30 });
  // A closure decides today even when no weekly hours are known.
  assert.equal(openStatus({ exceptions: hours.exceptions }, "IQ", erbil("2026-10-29", "12:00")).status, "TEMPORARILY_CLOSED");
  assert.equal(openStatus({ exceptions: hours.exceptions }, "IQ", erbil("2026-11-05", "12:00")).status, "HOURS_UNKNOWN");
});

test("special hours replace the weekly hours on their dates, including overnight ones", () => {
  const hours = { ...WEEK_9_17, exceptions: [{ from: "2026-12-31", to: "2026-12-31", hours: "20:00–02:00" }] };
  assert.equal(openStatus(hours, "IQ", erbil("2026-12-31", "12:00")).status, "CLOSED");
  assert.deepEqual(openStatus(hours, "IQ", erbil("2026-12-31", "12:00")).next?.time, "20:00");
  const night = openStatus(hours, "IQ", erbil("2027-01-01", "01:30"));
  assert.equal(night.status, "CLOSING_SOON"); // the overnight special range belongs to 31 December
  assert.equal(night.next?.time, "02:00");
  // A one-day change inside a longer closure wins (shortest range first).
  const mixed = { ...WEEK_9_17, exceptions: [
    { from: "2026-12-20", to: "2027-01-05", hours: "closed" },
    { from: "2026-12-24", to: "2026-12-24", hours: "10:00–13:00" },
  ] };
  assert.equal(openStatus(mixed, "IQ", erbil("2026-12-24", "11:00")).status, "OPEN");
  assert.equal(openStatus(mixed, "IQ", erbil("2026-12-23", "11:00")).status, "TEMPORARILY_CLOSED");
  assert.equal(openStatus(mixed, "IQ", erbil("2026-12-23", "11:00")).next?.date, "2026-12-24");
});

test("public holidays: noted always; closed only when the business says so; regional in Germany", () => {
  // Nowruz in Erbil, regular hours kept: open, holiday shown.
  const regular = openStatus(WEEK_9_17, "IQ", erbil("2026-03-21", "12:00"), 60, "kurdistan-region");
  assert.equal(regular.status, "OPEN");
  assert.equal(regular.holiday?.key, "nowruz");
  // Closed on holidays: closed, next opening the following day.
  const closed = openStatus({ ...WEEK_9_17, holidays: "closed" }, "IQ", erbil("2026-03-21", "12:00"));
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.next?.date, "2026-03-22");
  // Special hours on the holiday override the holiday closure.
  const special = { ...WEEK_9_17, holidays: "closed", exceptions: [{ from: "2026-03-21", to: "2026-03-21", hours: "10:00–14:00" }] };
  assert.equal(openStatus(special, "IQ", erbil("2026-03-21", "12:00")).status, "OPEN");
  // Germany: Epiphany closes a Bavarian business, not a Berlin one (Berlin is UTC+1 in January).
  const de = { ...WEEK_9_17, holidays: "closed" };
  assert.equal(openStatus(de, "DE", berlin("2026-01-06", "12:00"), 60, "bayern").status, "CLOSED");
  assert.equal(openStatus(de, "DE", berlin("2026-01-06", "12:00"), 60, "berlin").status, "OPEN");
  assert.equal(isOpenNow(de, "DE", berlin("2026-01-06", "12:00"), "bayern"), false);
});

test("time zones and daylight saving: the business's own calendar and clock decide", () => {
  // 21:00 UTC on 2 October is 00:00 on 3 October (National Day) in Erbil (UTC+3), but 23:00 on 2 October in Berlin (UTC+2).
  const instant = new Date("2026-10-02T21:00:00Z");
  const night = { mon: "00:00–24:00", tue: "00:00–24:00", wed: "00:00–24:00", thu: "00:00–24:00", fri: "00:00–24:00", sat: "00:00–24:00", sun: "00:00–24:00", holidays: "closed" };
  assert.equal(openStatus(night, "IQ", instant).holiday?.key, "national-day");
  assert.equal(openStatus(night, "IQ", instant).status, "CLOSED");
  assert.equal(openStatus(night, "DE", instant).holiday, undefined);
  // Open around the clock, but closed on holidays: at 23:00 it closes in an hour because tomorrow is Unity Day.
  assert.deepEqual(openStatus(night, "DE", instant).next, { day: "sat", date: "2026-10-03", time: "00:00", inMinutes: 60 });
  assert.equal(openStatus(night, "DE", instant).status, "CLOSING_SOON");
  assert.equal(openStatus(night, "DE", new Date("2026-10-02T22:30:00Z")).holiday?.key, "unity-day"); // 00:30 on 3 Oct
  // Across the end of summer time (25 Oct 2026 in Germany) the local clock is used.
  assert.equal(openStatus(WEEK_9_17, "DE", berlin("2026-10-25", "08:30", "+01:00")).status, "OPENS_SOON");
  assert.equal(openStatus(WEEK_9_17, "DE", berlin("2026-10-24", "08:30", "+02:00")).status, "OPENS_SOON");
});

test("status and isOpenNow always agree, with closures and holidays too", () => {
  const samples: unknown[] = [
    { ...WEEK_9_17, holidays: "closed", exceptions: [{ from: "2026-03-22", to: "2026-03-23", hours: "closed" }, { from: "2026-03-24", to: "2026-03-24", hours: "18:00–02:00" }] },
    { tue: "20:00–02:00", exceptions: [{ from: "2026-03-21", to: "2026-03-21", hours: "closed" }] },
    null,
  ];
  for (const hours of samples) {
    for (let m = 0; m < 5 * 24 * 60; m += 30) {
      const now = new Date(erbil("2026-03-20", "00:00").getTime() + m * 60_000);
      const open = isOpenNow(hours, "IQ", now);
      const { status } = openStatus(hours, "IQ", now);
      assert.equal(open === null, status === "HOURS_UNKNOWN");
      assert.equal(open === true, status === "OPEN" || status === "CLOSING_SOON", `${JSON.stringify(hours)} @${m}`);
    }
  }
});
