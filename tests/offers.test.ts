import test from "node:test";
import assert from "node:assert/strict";
import {
  OFFER_LIMITS, activeOfferWhere, addDaysYmd, localYmd, misleadingIssues, offerDates, offerState, offerWindow, percentClaims, validateDiscount, zonedMidnight,
} from "../src/lib/offers";

const d = (iso: string) => new Date(iso);

test("offerState: the owner's switch wins, then the dates decide; the end is exclusive", () => {
  const offer = { isActive: true, startsAt: d("2026-11-01T00:00:00Z"), endsAt: d("2026-11-10T00:00:00Z") };
  assert.equal(offerState(offer, d("2026-10-31T23:59:59Z")), "scheduled");
  assert.equal(offerState(offer, d("2026-11-01T00:00:00Z")), "active");
  assert.equal(offerState(offer, d("2026-11-09T23:59:59.999Z")), "active");
  assert.equal(offerState(offer, d("2026-11-10T00:00:00Z")), "expired");
  assert.equal(offerState({ ...offer, isActive: false }, d("2026-11-05T00:00:00Z")), "deactivated");
  assert.equal(offerState({ ...offer, isActive: false }, d("2027-01-01T00:00:00Z")), "deactivated");
});

test("activeOfferWhere mirrors offerState: on, started, not ended", () => {
  const now = d("2026-11-05T12:00:00Z");
  assert.deepEqual(activeOfferWhere(now), { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } });
});

test("validateDiscount: none, whole percent 1-90, positive amount with a currency", () => {
  assert.deepEqual(validateDiscount({ type: "none" }), { ok: true, type: "none", value: null, currency: null });
  assert.deepEqual(validateDiscount({ type: "percent", value: 20 }), { ok: true, type: "percent", value: 20, currency: null });
  assert.deepEqual(validateDiscount({ type: "amount", value: 5.5, currency: "EUR" }), { ok: true, type: "amount", value: 5.5, currency: "EUR" });
  const bad = [
    { type: "none", value: 10 }, { type: "none", currency: "EUR" },
    { type: "percent" }, { type: "percent", value: 0 }, { type: "percent", value: 91 }, { type: "percent", value: 100 }, { type: "percent", value: -5 },
    { type: "percent", value: 12.5 }, { type: "percent", value: Number.NaN }, { type: "percent", value: Infinity }, { type: "percent", value: 20, currency: "EUR" },
    { type: "amount", value: 5 }, { type: "amount", value: 5, currency: "XXX" }, { type: "amount", value: 0, currency: "EUR" }, { type: "amount", value: -1, currency: "EUR" },
    { type: "amount", value: 5.555, currency: "EUR" }, { type: "amount", value: OFFER_LIMITS.amountMax + 1, currency: "EUR" },
    { type: "free", value: 1 },
  ] as const;
  for (const input of bad) assert.deepEqual(validateDiscount(input as never), { ok: false, issue: "discount_invalid" }, JSON.stringify(input));
  assert.equal(validateDiscount({ type: "percent", value: 90 }).ok, true);
  assert.equal(validateDiscount({ type: "percent", value: 1 }).ok, true);
  assert.equal(validateDiscount({ type: "amount", value: OFFER_LIMITS.amountMax, currency: "IQD" }).ok, true);
});

test("percentClaims reads %, ٪, Arabic-Indic and Persian digits, and the Turkish %20 form", () => {
  assert.deepEqual(percentClaims("20% off"), [20]);
  assert.deepEqual(percentClaims("20 % Rabatt, 12,5 % extra"), [20, 12.5]);
  assert.deepEqual(percentClaims("%20 indirim"), [20]);
  assert.deepEqual(percentClaims("٢٠٪ خصم"), [20]);
  assert.deepEqual(percentClaims("۳۰٪ تخفیف"), [30]);
  assert.deepEqual(percentClaims("٥٠ ٪ تخفيض"), [50]);
  assert.deepEqual(percentClaims("Free coffee with every lunch"), []);
  assert.deepEqual(percentClaims("Open 10-18, save 5 euros"), []);
});

test("misleadingIssues: text may only claim the declared percentage", () => {
  const pct = (value: number) => ({ type: "percent" as const, value });
  assert.deepEqual(misleadingIssues({ title: "20% off all haircuts" }, pct(20)), []);
  assert.deepEqual(misleadingIssues({ title: "Haircut", description: "Now 20 % cheaper" }, pct(20)), []);
  assert.deepEqual(misleadingIssues({ title: "50% off all haircuts" }, pct(20)), ["percent_mismatch"]);
  assert.deepEqual(misleadingIssues({ title: "20% off", description: "up to 70% on selected items" }, pct(20)), ["percent_mismatch"]);
  assert.deepEqual(misleadingIssues({ title: "100% off today" }, pct(20)), ["percent_mismatch"]);
  assert.deepEqual(misleadingIssues({ title: "%20 indirim" }, pct(20)), []);
  assert.deepEqual(misleadingIssues({ title: "٢٠٪ خصم" }, pct(20)), []);
  assert.deepEqual(misleadingIssues({ title: "٣٠٪ خصم" }, pct(20)), ["percent_mismatch"]);
  // No percent discount declared: the text may not state a percentage at all.
  assert.deepEqual(misleadingIssues({ title: "30% off" }, { type: "none", value: null }), ["percent_without_discount"]);
  assert.deepEqual(misleadingIssues({ title: "Save 5 EUR", description: "also 10% off" }, { type: "amount", value: 5 }), ["percent_without_discount"]);
  assert.deepEqual(misleadingIssues({ title: "Free coffee with lunch" }, { type: "none", value: null }), []);
  assert.deepEqual(misleadingIssues({ title: "5 EUR off" }, { type: "amount", value: 5 }), []);
});

test("zonedMidnight: start of the calendar day in the business's zone, across daylight saving", () => {
  assert.equal(zonedMidnight("2026-11-01", "Europe/Berlin")?.toISOString(), "2026-10-31T23:00:00.000Z"); // CET (+1)
  assert.equal(zonedMidnight("2026-07-01", "Europe/Berlin")?.toISOString(), "2026-06-30T22:00:00.000Z"); // CEST (+2)
  assert.equal(zonedMidnight("2026-03-29", "Europe/Berlin")?.toISOString(), "2026-03-28T23:00:00.000Z"); // spring-forward day starts in CET
  assert.equal(zonedMidnight("2026-03-30", "Europe/Berlin")?.toISOString(), "2026-03-29T22:00:00.000Z"); // the day after is CEST
  assert.equal(zonedMidnight("2026-10-25", "Europe/Berlin")?.toISOString(), "2026-10-24T22:00:00.000Z"); // fall-back day starts in CEST
  assert.equal(zonedMidnight("2026-11-01", "Asia/Baghdad")?.toISOString(), "2026-10-31T21:00:00.000Z"); // +3, no DST
  assert.equal(zonedMidnight("2026-11-01", "America/New_York")?.toISOString(), "2026-11-01T04:00:00.000Z"); // EDT until 01:59 that morning
  assert.equal(zonedMidnight("2026-11-01", "UTC")?.toISOString(), "2026-11-01T00:00:00.000Z");
});

test("zonedMidnight / addDaysYmd reject impossible dates", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-11-31", "26-11-01", "2026/11/01", "", "tomorrow", "2026-11-01T00:00"]) {
    assert.equal(zonedMidnight(bad, "UTC"), null, bad);
    assert.equal(addDaysYmd(bad, 1), null, bad);
  }
  assert.equal(addDaysYmd("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysYmd("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysYmd("2026-03-01", -1), "2026-02-28");
});

test("offerWindow: the last day is included; the end instant is the start of the next day (exclusive)", () => {
  const now = d("2026-10-20T10:00:00Z");
  const w = offerWindow("2026-11-01", "2026-11-30", "Europe/Berlin", now);
  assert.ok(w.ok);
  assert.equal(w.startsAt.toISOString(), "2026-10-31T23:00:00.000Z");
  assert.equal(w.endsAt.toISOString(), "2026-11-30T23:00:00.000Z");
  // One day offer.
  const one = offerWindow("2026-11-01", "2026-11-01", "Europe/Berlin", now);
  assert.ok(one.ok);
  assert.equal(one.endsAt.getTime() - one.startsAt.getTime(), 86_400_000);
  // The same offer is active during its last day and gone right after.
  const live = { isActive: true, startsAt: w.startsAt, endsAt: w.endsAt };
  assert.equal(offerState(live, d("2026-11-30T22:59:59Z")), "active"); // 23:59:59 Berlin time on the last day
  assert.equal(offerState(live, d("2026-11-30T23:00:00Z")), "expired"); // 00:00 on 1 December in Berlin
});

test("offerWindow rejects bad ranges", () => {
  const now = d("2026-10-20T10:00:00Z");
  const issue = (a: string, b: string) => { const w = offerWindow(a, b, "Europe/Berlin", now); return w.ok ? "ok" : w.issue; };
  assert.equal(issue("2026-11-10", "2026-11-01"), "end_before_start");
  assert.equal(issue("2026-10-01", "2026-10-19"), "ended"); // already over
  assert.equal(issue("2026-10-01", "2026-10-20"), "ok"); // ends tonight: still running, so allowed
  assert.equal(issue("2026-11-01", "2027-12-31"), "too_long");
  assert.equal(issue("2028-01-01", "2028-01-10"), "too_far");
  assert.equal(issue("2026-02-30", "2026-11-01"), "date_invalid");
  assert.equal(issue("2026-11-01", "nope"), "date_invalid");
  assert.equal(issue("2026-10-20", "2027-10-20"), "ok"); // 366 days
});

test("offerDates / localYmd round-trip a stored window back to the owner's dates", () => {
  const now = d("2026-10-20T10:00:00Z");
  for (const tz of ["Europe/Berlin", "Asia/Baghdad", "America/New_York", "UTC", "Australia/Sydney"]) {
    const w = offerWindow("2026-11-01", "2026-11-30", tz, now);
    assert.ok(w.ok, tz);
    assert.deepEqual(offerDates(w, tz), { startDate: "2026-11-01", endDate: "2026-11-30" }, tz);
  }
  assert.equal(localYmd(d("2026-10-31T23:30:00Z"), "Europe/Berlin"), "2026-11-01");
  assert.equal(localYmd(d("2026-10-31T23:30:00Z"), "UTC"), "2026-10-31");
});
