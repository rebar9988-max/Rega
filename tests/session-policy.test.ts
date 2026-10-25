import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_RENEW_INTERVAL_MS,
  SESSION_RENEW_PATH,
  passwordChanged,
  passwordMarker,
  renewalDue,
} from "../src/features/auth/session-policy";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("session policy: 90 days, renewed far more often than it expires", () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, 90 * 24 * 60 * 60);
  assert.ok(SESSION_RENEW_INTERVAL_MS <= 24 * 60 * 60 * 1000, "renewal must happen at least daily while the site is used");
  assert.ok(SESSION_RENEW_INTERVAL_MS < SESSION_MAX_AGE_SECONDS * 1000);
  assert.equal(SESSION_RENEW_PATH, "/api/auth/session");
});

test("renewal: due on a page's first look, then only after the interval; a clock that went backwards renews", () => {
  const t0 = Date.UTC(2026, 9, 20, 12);
  assert.equal(renewalDue(null, t0), true);
  assert.equal(renewalDue(Number.NaN, t0), true);
  assert.equal(renewalDue(t0, t0 + 1_000), false);
  assert.equal(renewalDue(t0, t0 + SESSION_RENEW_INTERVAL_MS - 1), false);
  assert.equal(renewalDue(t0, t0 + SESSION_RENEW_INTERVAL_MS), true);
  assert.equal(renewalDue(t0, t0 - 60_000), true);
  assert.equal(renewalDue(t0, t0 + 5_000, 1_000), true);
});

test("password marker: stable, short, one-way; a different hash gives a different marker", async () => {
  const a = await passwordMarker("$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await passwordMarker("$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456"));
  assert.notEqual(a, await passwordMarker("$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123457"));
  assert.ok(!a.includes("abcdefgh"));
  // Accounts without a password (social sign-in only) still have a stable marker.
  assert.equal(await passwordMarker(null), await passwordMarker(undefined));
  assert.equal(await passwordMarker(null), await passwordMarker(""));
});

test("password change ends sessions; tokens without a marker (issued before it existed) are kept", async () => {
  const before = await passwordMarker("hash-one");
  const after = await passwordMarker("hash-two");
  assert.equal(passwordChanged(before, before), false);
  assert.equal(passwordChanged(before, after), true);
  assert.equal(passwordChanged(undefined, after), false, "an old token must not be signed out by a deployment");
  assert.equal(passwordChanged("", after), false);
  assert.equal(passwordChanged(null, after), false);
  assert.equal(passwordChanged(42, after), false);
});

test("auth config: persistent 90-day JWT session from the shared policy, marker checked on every re-check", () => {
  const cfg = read("src/auth.config.ts");
  assert.match(cfg, /session:\s*\{\s*strategy:\s*"jwt",\s*maxAge:\s*SESSION_MAX_AGE_SECONDS\s*\}/);
  assert.ok(!/maxAge:\s*60 \* 60 \* 24 \* 14/.test(cfg), "the old 14-day limit must be gone");
  assert.match(cfg, /passwordChanged\(token\.pv, marker\)/);
  assert.match(cfg, /pv: await passwordMarker\(user\.passwordHash\)/);
  // A session ends only through these explicit paths: no account / not active / password changed.
  assert.match(cfg, /!current \|\| current\.status !== "active"\) return null/);
});

test("session renewal: rendered for signed-in visitors only, never stores anything in the browser", () => {
  const header = read("src/components/shell/Header.tsx");
  assert.match(header, /\{signedIn && <SessionRenewal \/>\}/);
  assert.match(read("src/app/admin/layout.tsx"), /<SessionRenewal \/>/);
  for (const file of ["src/features/auth/SessionRenewal.tsx", "src/features/auth/session-policy.ts", "src/auth.config.ts"]) {
    const src = read(file);
    assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(src), `${file} must not keep session data in browser storage`);
  }
  const renewal = read("src/features/auth/SessionRenewal.tsx");
  assert.match(renewal, /credentials:\s*"same-origin"/);
  assert.match(renewal, /cache:\s*"no-store"/);
  assert.match(renewal, /await res\.text\(\)/, "the answer must be consumed, or the request never finishes for the browser");
});

test("legal texts: every language states the 90-day, renewed session (no stale 14-day wording)", () => {
  for (const loc of ["ckb", "kmr", "ar", "fa", "en", "de", "tr"]) {
    const text = read(`src/features/legal/texts/${loc}.ts`);
    assert.ok(/(?:90|۹۰)/.test(text.slice(text.indexOf("Auth.js"), text.indexOf("Auth.js") + 200)), `${loc}: session duration`);
    assert.ok(!/(?:\b14 (?:days|Tage|gün|roj|يوم|ڕۆژ)|۱۴ روز)/.test(text), `${loc}: stale 14-day wording`);
  }
});
