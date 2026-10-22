import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  cleanCode,
  codesMatch,
  hashAdminCode,
  newAdminCode,
  normalizeEmail,
} from "../src/features/auth/admin-code-core";

const SECRET = "a".repeat(32);

test("admin code: six digits, uniform, and not guessable from the last one", () => {
  const seen = new Set<string>();
  const firstDigit = new Map<string, number>();
  for (let i = 0; i < 3000; i += 1) {
    const code = newAdminCode();
    assert.match(code, /^\d{6}$/);
    seen.add(code);
    firstDigit.set(code[0]!, (firstDigit.get(code[0]!) ?? 0) + 1);
  }
  assert.ok(seen.size > 2900, `too many repeats: ${seen.size}`);
  // Every leading digit appears; a modulo-biased generator starves the high ones.
  assert.equal(firstDigit.size, 10);
  for (const [digit, n] of firstDigit) assert.ok(n > 150, `digit ${digit} only ${n}`);
});

test("admin code: codes are stored as an HMAC, bound to the address", async () => {
  const code = "123456";
  const a = await hashAdminCode(SECRET, "owner@example.test", code);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await hashAdminCode(SECRET, "owner@example.test", code));
  // The same code for another address, or under another secret, is a different hash.
  assert.notEqual(a, await hashAdminCode(SECRET, "someone@example.test", code));
  assert.notEqual(a, await hashAdminCode("b".repeat(32), "owner@example.test", code));
  assert.notEqual(a, await hashAdminCode(SECRET, "owner@example.test", "123457"));
  // The code itself never appears in what is stored.
  assert.ok(!a.includes(code));
});

test("admin code: comparison does not leak the answer through length", () => {
  assert.ok(codesMatch("abc", "abc"));
  assert.ok(!codesMatch("abc", "abd"));
  assert.ok(!codesMatch("abc", "abcd"));
  assert.ok(!codesMatch("", "a"));
});

test("admin code: only six digits count as a code", () => {
  assert.equal(cleanCode("123456"), "123456");
  assert.equal(cleanCode(" 12 34 56 "), "123456");
  for (const bad of ["12345", "1234567", "12345a", "", null, undefined, 123456, "  "]) {
    assert.equal(cleanCode(bad), null, String(bad));
  }
});

test("admin code: addresses are normalised, and nothing exotic passes", () => {
  assert.equal(normalizeEmail("  Owner@Example.TEST "), "owner@example.test");
  for (const bad of [
    "no-at-sign",
    "a@b",
    "a@@b.co",
    "a b@c.co",
    ".lead@c.co",
    "two..dots@c.co",
    "trail.@c.co",
    "a@c.co\nbcc: x@y.co",
    "",
    null,
    42,
  ]) {
    assert.equal(normalizeEmail(bad), null, String(bad));
  }
});

test("admin code: the limits are the ones the sign-in promises", () => {
  assert.equal(MAX_ATTEMPTS, 5);
  assert.equal(RESEND_COOLDOWN_SECONDS, 30);
});

// Policy checks on the server code that cannot run here without a database.
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("admin code: only an active, verified SUPER_ADMIN can be signed in", () => {
  const src = read("src/features/auth/admin-code.ts");
  assert.match(src, /deletedAt: null, status: "active"/);
  assert.match(src, /user\.role !== "SUPER_ADMIN" \|\| !user\.emailVerified/);
  // It never creates accounts or changes roles.
  assert.doesNotMatch(src, /prisma\.user\.(create|upsert|update)\b/);
  assert.doesNotMatch(src, /role:\s*["A-Z]/);
});

test("admin code: the provider re-reads the account and trusts no caller-sent IP", () => {
  const src = read("src/auth.config.ts");
  const provider = src.slice(src.indexOf('id: "admin-code"'), src.indexOf("...socialProviders()"));
  assert.ok(provider.length > 0);
  assert.match(provider, /clientIp\(request\.headers\)/);
  assert.doesNotMatch(provider, /input\.ip|ip: \{/);
  assert.match(provider, /adminCodeAccount\(checked\.email\)/);
  assert.match(provider, /recordAdminSignIn\(/);
});

test("admin code: the sign-in notice carries no code, token or link", () => {
  const src = read("src/features/auth/admin-code.ts");
  const notice = src.slice(src.indexOf("export async function recordAdminSignIn"));
  assert.match(notice, /action: "auth\.dr_code\.sign_in"/);
  assert.doesNotMatch(notice, /https?:\/\//);
  // The six digits are never in scope here: the function has no code argument to leak.
  assert.match(notice, /recordAdminSignIn\(user: \{ id: string; email: string \}, ip: string\)/);
  assert.doesNotMatch(notice, /newAdminCode|codeHash/);
  assert.doesNotMatch(notice, /token/i);
});

test("admin code: the code is stored only as a hash and the table is additive", () => {
  const sql = read("prisma/migrations/20261022120000_admin_sign_in_codes/migration.sql");
  assert.match(sql, /CREATE TABLE "AdminSignInCode"/);
  assert.doesNotMatch(sql, /\b(DROP|ALTER|DELETE|UPDATE|TRUNCATE)\b/i);
  assert.match(sql, /"codeHash"/);
  assert.doesNotMatch(sql, /"code" /);
});

test("the /dr sign-in actions module exports async functions only (Next.js rejects anything else at runtime)", () => {
  const src = read("src/app/dr/sign-in-actions.ts");
  assert.match(src, /^"use server";/);
  assert.doesNotMatch(src, /^export (const|let|var|class|\{|default)/m);
  for (const m of src.matchAll(/^export (?!type )(\w+)/gm)) assert.equal(m[1], "async", m[0]);
});
