import test from "node:test";
import assert from "node:assert/strict";
import { isOpenNow, openStatus } from "../src/lib/geo";

// Wednesday 2026-10-28. Iraq is UTC+3 all year, so 09:00Z is 12:00 in Erbil.
const erbil = (hhmm: string, date = "2026-10-28") => new Date(`${date}T${hhmm}:00+03:00`);

test("unknown hours are never reported as open or closed", () => {
  assert.deepEqual(openStatus(null, "IQ", erbil("12:00")), { status: "HOURS_UNKNOWN" });
  assert.deepEqual(openStatus({ wed: "nonsense" }, "IQ", erbil("12:00")), { status: "HOURS_UNKNOWN" });
  assert.deepEqual(openStatus([1, 2], "IQ", erbil("12:00")), { status: "HOURS_UNKNOWN" });
});

test("open, closing soon and the closing time in the business timezone", () => {
  assert.deepEqual(openStatus({ wed: "09:00–17:00" }, "IQ", erbil("12:00")), { status: "OPEN", next: { day: "wed", date: "2026-10-28", time: "17:00", inMinutes: 300 } });
  assert.deepEqual(openStatus({ wed: "09:00–17:00" }, "IQ", erbil("16:15")), { status: "CLOSING_SOON", next: { day: "wed", date: "2026-10-28", time: "17:00", inMinutes: 45 } });
  // The viewer's clock does not matter: the same instant in Berlin is 10:00, still before opening there.
  assert.equal(openStatus({ wed: "11:00–17:00" }, "IQ", erbil("12:00")).status, "OPEN");
  assert.equal(openStatus({ wed: "11:00–17:00" }, "DE", erbil("12:00")).status, "OPENS_SOON");
});

test("closed, opens soon and the next opening day", () => {
  assert.deepEqual(openStatus({ wed: "13:00–17:00" }, "IQ", erbil("12:30")), { status: "OPENS_SOON", next: { day: "wed", date: "2026-10-28", time: "13:00", inMinutes: 30 } });
  assert.deepEqual(openStatus({ wed: "09:00–17:00", thu: "08:00–16:00" }, "IQ", erbil("18:00")), { status: "CLOSED", next: { day: "thu", date: "2026-10-29", time: "08:00", inMinutes: 840 } });
  // Next opening wraps over the week end.
  assert.deepEqual(openStatus({ mon: "09:00–17:00", wed: "closed" }, "IQ", erbil("12:00")), { status: "CLOSED", next: { day: "mon", date: "2026-11-02", time: "09:00", inMinutes: 5 * 1440 - 180 } });
  // Only "closed" days: closed with no next opening.
  assert.deepEqual(openStatus({ wed: "closed" }, "IQ", erbil("12:00")), { status: "CLOSED" });
});

test("overnight and split hours", () => {
  // Tuesday's 20:00–02:00 still runs at 01:00 on Wednesday.
  assert.deepEqual(openStatus({ tue: "20:00–02:00" }, "IQ", erbil("01:00")), { status: "CLOSING_SOON", next: { day: "wed", date: "2026-10-28", time: "02:00", inMinutes: 60 } });
  assert.deepEqual(openStatus({ wed: "09:00–12:00, 14:00–18:00" }, "IQ", erbil("12:30")), { status: "CLOSED", next: { day: "wed", date: "2026-10-28", time: "14:00", inMinutes: 90 } });
  // Adjacent ranges are one opening period: 20:00–24:00 then 00:00–03:00 closes at 03:00 Thursday.
  assert.deepEqual(openStatus({ wed: "20:00–24:00", thu: "00:00–03:00" }, "IQ", erbil("23:30")), { status: "OPEN", next: { day: "thu", date: "2026-10-29", time: "03:00", inMinutes: 210 } });
  // Around the clock every day: open, nothing to announce.
  const always = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, "00:00–24:00"]));
  assert.deepEqual(openStatus(always, "IQ", erbil("12:00")), { status: "OPEN" });
});

test("status always agrees with isOpenNow", () => {
  const samples = [{ wed: "09:00–17:00" }, { tue: "20:00–02:00", wed: "closed" }, { wed: "09:00–12:00, 14:00–18:00" }, { mon: "08:00–16:00" }, null];
  for (const hours of samples) {
    for (let m = 0; m < 24 * 60; m += 15) {
      const now = new Date(erbil("00:00").getTime() + m * 60_000);
      const open = isOpenNow(hours, "IQ", now);
      const { status } = openStatus(hours, "IQ", now);
      assert.equal(open === null, status === "HOURS_UNKNOWN");
      assert.equal(open === true, status === "OPEN" || status === "CLOSING_SOON", `${JSON.stringify(hours)} @${m}`);
    }
  }
});
