import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSocialUrl, normalizeWebsite, socialLinks } from "../src/lib/social-links";
import { dayFromStored, dayToStored } from "../src/lib/hours-form";
import { normalizeDay } from "../src/lib/opening-hours";

const ok = (value: string | null) => ({ ok: true, value });
const refused = { ok: false };

test("social links: empty is allowed for every platform (all four are optional)", () => {
  for (const p of ["facebook", "instagram", "tiktok", "snapchat"] as const) {
    assert.deepEqual(normalizeSocialUrl(p, ""), ok(null));
    assert.deepEqual(normalizeSocialUrl(p, "   "), ok(null));
    assert.deepEqual(normalizeSocialUrl(p, undefined), ok(null));
  }
});

test("social links: profile URLs of the platform are stored as canonical https links", () => {
  assert.deepEqual(normalizeSocialUrl("facebook", "https://facebook.com/kebabamin"), ok("https://www.facebook.com/kebabamin"));
  assert.deepEqual(normalizeSocialUrl("facebook", "http://m.facebook.com/kebabamin/?ref=share#top"), ok("https://www.facebook.com/kebabamin"));
  assert.deepEqual(normalizeSocialUrl("facebook", "facebook.com/profile.php?id=100012345"), ok("https://www.facebook.com/profile.php?id=100012345"));
  assert.deepEqual(normalizeSocialUrl("instagram", "www.instagram.com/kebab.amin/"), ok("https://www.instagram.com/kebab.amin"));
  assert.deepEqual(normalizeSocialUrl("tiktok", "https://www.tiktok.com/@kebabamin?lang=de"), ok("https://www.tiktok.com/@kebabamin"));
  assert.deepEqual(normalizeSocialUrl("tiktok", "https://vm.tiktok.com/ZMabc123/"), ok("https://vm.tiktok.com/ZMabc123"));
  assert.deepEqual(normalizeSocialUrl("snapchat", "https://snapchat.com/add/kebabamin"), ok("https://www.snapchat.com/add/kebabamin"));
});

test("social links: a bare handle becomes the platform's profile link", () => {
  assert.deepEqual(normalizeSocialUrl("instagram", "@kebab.amin"), ok("https://www.instagram.com/kebab.amin"));
  assert.deepEqual(normalizeSocialUrl("tiktok", "kebabamin"), ok("https://www.tiktok.com/@kebabamin"));
  assert.deepEqual(normalizeSocialUrl("snapchat", "@kebab_amin"), ok("https://www.snapchat.com/add/kebab_amin"));
  assert.deepEqual(normalizeSocialUrl("facebook", "kebabamin"), ok("https://www.facebook.com/kebabamin"));
});

test("social links: other sites, lookalike domains, unsafe schemes and tricks are refused", () => {
  for (const [p, v] of [
    ["facebook", "javascript:alert(1)"],
    ["facebook", "JAVASCRIPT:alert(1)//facebook.com/x"],
    ["facebook", "data:text/html,<script>alert(1)</script>"],
    ["facebook", "https://facebook.com.evil.example/kebab"],
    ["facebook", "https://evilfacebook.com/kebab"],
    ["facebook", "https://facebook.com@evil.example/kebab"],
    ["facebook", "https://user:pass@facebook.com/kebab"],
    ["facebook", "https://facebook.com:8443/kebab"],
    ["facebook", "https://facebook.com/"],
    ["facebook", "https://facebook.com/profile.php?id=abc"],
    ["facebook", "https://facebook.com/l.php?u=https://evil.example"],
    ["instagram", "https://www.facebook.com/kebabamin"],
    ["instagram", "https://instagram.com/%2F%2Fevil.example"],
    ["tiktok", "https://tiktok.example.org/@rega"],
    ["tiktok", "ftp://tiktok.com/@x"],
    ["snapchat", "https://snapchat.com/add/<b>x</b>"],
    ["snapchat", "https://snapchat.com/add/x y"],
    ["snapchat", "x".repeat(400)],
  ] as const) assert.deepEqual(normalizeSocialUrl(p, v), refused, `${p}: ${v}`);
  // Dot segments are resolved by the URL parser and can never leave the platform's host.
  assert.deepEqual(normalizeSocialUrl("instagram", "https://instagram.com/../../x"), ok("https://www.instagram.com/x"));
});

test("social links: the profile shows only valid saved links, in a fixed order", () => {
  assert.deepEqual(socialLinks({ facebookUrl: null, instagramUrl: "", tiktokUrl: undefined, snapchatUrl: null }), []);
  assert.deepEqual(socialLinks({ snapchatUrl: "https://www.snapchat.com/add/a", facebookUrl: "https://www.facebook.com/a" }), [
    { platform: "facebook", url: "https://www.facebook.com/a" },
    { platform: "snapchat", url: "https://www.snapchat.com/add/a" },
  ]);
  // A stored value that fails today's rules is simply not shown.
  assert.deepEqual(socialLinks({ instagramUrl: "javascript:alert(1)" }), []);
});

test("website: optional, https added when missing, unsafe values refused", () => {
  assert.deepEqual(normalizeWebsite(""), ok(null));
  assert.deepEqual(normalizeWebsite("placejuice.com"), ok("https://placejuice.com/"));
  assert.deepEqual(normalizeWebsite("https://www.placejuice.com/menu?x=1"), ok("https://www.placejuice.com/menu?x=1"));
  assert.deepEqual(normalizeWebsite("http://placejuice.de"), ok("http://placejuice.de/"));
  for (const v of ["javascript:alert(1)", "ftp://example.com", "https://user:pw@example.com", "localhost", "https://intranet", "exa mple.com", "<script>"])
    assert.deepEqual(normalizeWebsite(v), refused, v);
});

test("opening hours editor: stored values round-trip through the controls", () => {
  for (const stored of ["09:00–17:00", "09:00–12:00, 14:00–18:00", "20:00–02:00", "00:00–24:00", "closed", "18:00–24:00"]) {
    assert.equal(dayToStored(dayFromStored(stored)), normalizeDay(stored), stored);
  }
  // An empty day (once other days are set) is a closed day, as every reader treats it.
  assert.equal(dayToStored(dayFromStored("")), "closed");
  // Split shift, overnight and all-day from the controls.
  assert.equal(dayToStored({ open: true, allDay: false, ranges: [{ from: "10:00", to: "14:00" }, { from: "17:00", to: "22:00" }] }), "10:00–14:00, 17:00–22:00");
  assert.equal(dayToStored({ open: true, allDay: false, ranges: [{ from: "20:00", to: "02:00" }] }), "20:00–02:00");
  assert.equal(dayToStored({ open: true, allDay: false, ranges: [{ from: "18:00", to: "00:00" }] }), "18:00–24:00");
  assert.equal(dayToStored({ open: true, allDay: true, ranges: [] }), "00:00–24:00");
  // Incomplete or zero-length ranges are not silently saved.
  assert.equal(dayToStored({ open: true, allDay: false, ranges: [{ from: "10:00", to: "" }] }), null);
  assert.equal(dayToStored({ open: true, allDay: false, ranges: [{ from: "10:00", to: "10:00" }] }), null);
});
