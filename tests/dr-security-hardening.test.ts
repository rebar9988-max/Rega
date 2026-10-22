import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUPER_ADMIN_SESSION_MAX_AGE_MS, SESSION_MAX_AGE_SECONDS, superAdminSessionExpired } from "../src/features/auth/session-policy";
import { DURABLE_FAIL_DAY_LIMIT, DURABLE_SEND_DAY_LIMIT, DURABLE_SEND_HOUR_LIMIT, OWNER_PASSWORD_FAIL_HOUR_LIMIT } from "../src/features/auth/admin-code-core";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;

test("session: a SUPER_ADMIN session ends 7 days after sign-in; every other role keeps the 90-day policy", () => {
  assert.equal(SUPER_ADMIN_SESSION_MAX_AGE_MS, 7 * DAY);
  assert.equal(SESSION_MAX_AGE_SECONDS, 90 * 24 * 60 * 60);
  const now = Date.UTC(2026, 9, 23);
  assert.equal(superAdminSessionExpired("SUPER_ADMIN", now - 1000, now), false);
  assert.equal(superAdminSessionExpired("SUPER_ADMIN", now - 7 * DAY + 1000, now), false);
  assert.equal(superAdminSessionExpired("SUPER_ADMIN", now - 7 * DAY - 1000, now), true);
  // No or nonsensical sign-in time on a SUPER_ADMIN token fails closed.
  for (const bad of [undefined, null, 0, -5, "x", NaN, now + 10 * 60_000]) assert.equal(superAdminSessionExpired("SUPER_ADMIN", bad, now), true, String(bad));
  for (const role of ["ADMIN", "MANAGER", "EMPLOYEE", "BUSINESS_OWNER", "USER", undefined]) {
    assert.equal(superAdminSessionExpired(role, undefined, now), false, String(role));
    assert.equal(superAdminSessionExpired(role, now - 80 * DAY, now), false, String(role));
  }
});

test("session: the sign-in time is set once and the 7-day check runs on every token read, before revalidation", () => {
  const cfg = read("src/auth.config.ts");
  assert.match(cfg, /token\.authAt = Date\.now\(\);/);
  assert.equal((cfg.match(/token\.authAt = /g) ?? []).length, 1, "authAt is only written at sign-in, never renewed");
  const check = cfg.indexOf("superAdminSessionExpired(effectiveRole(");
  assert.ok(check > 0 && check < cfg.indexOf("Date.now() - Number(token.checkedAt"), "expiry check precedes revalidation");
});

test("codes: durable limits from the audit trail bound distributed guessing", () => {
  assert.equal(DURABLE_SEND_HOUR_LIMIT, 5);
  assert.equal(DURABLE_SEND_DAY_LIMIT, 12);
  assert.equal(DURABLE_FAIL_DAY_LIMIT, 10);
  // At most 10 wrong codes a day: about 0.4 % chance per year of guessing a six-digit code.
  assert.ok((DURABLE_FAIL_DAY_LIMIT * 365) / 1_000_000 < 0.005);
  const src = read("src/features/auth/admin-code.ts");
  const request = src.slice(src.indexOf("export async function requestAdminCode"), src.indexOf("export async function verifyAdminCode"));
  // Nothing is written for an address that is not served, and the durable limits run before any reservation or mail.
  assert.ok(request.indexOf("dashboardAccount(email)") < request.indexOf("adminSignInCode.updateMany"));
  assert.ok(request.indexOf('ownerEvents(account.id, "auth.dr_code.failed", DAY_MS)') < request.indexOf("adminSignInCode.updateMany"));
  assert.ok(request.indexOf('"auth.dr_code.sent", HOUR_MS') > 0 && request.indexOf('"auth.dr_code.sent", DAY_MS') > 0);
  assert.doesNotMatch(request, /adminSignInCode\.upsert/, "reservation is an atomic conditional update or a create, never an unconditional upsert");
  assert.match(request, /action: "auth\.dr_code\.sent"/);
  const verify = src.slice(src.indexOf("export async function verifyAdminCode"), src.indexOf("async function ownerEvents"));
  assert.ok(verify.indexOf('"auth.dr_code.failed", DAY_MS)) >= DURABLE_FAIL_DAY_LIMIT') < verify.indexOf("attempts: { increment: 1 }"));
  assert.match(verify, /action: "auth\.dr_code\.failed"/);
  assert.match(src, /prisma\.auditLog\.count\(\{ where: \{ actorId, action, createdAt: \{ gte:/);
});

test("password: the owner's account has a durable wrong-password limit and every attempt is audited", () => {
  assert.equal(OWNER_PASSWORD_FAIL_HOUR_LIMIT, 10);
  const cfg = read("src/auth.config.ts");
  const provider = cfg.slice(cfg.indexOf('name: "credentials"'), cfg.indexOf('id: "admin-code"'));
  assert.ok(provider.indexOf("ownerPasswordLocked(owner.id)") < provider.indexOf("bcrypt.compare(password, hash)"));
  assert.match(provider, /recordOwnerPassword\(owner, ok && owner\.status === "active"\)/);
  assert.match(provider, /isSuperAdminEmail\(user\.email\)/);
  const src = read("src/features/auth/admin-code.ts");
  assert.match(src, /ok \? "auth\.password\.sign_in" : "auth\.password\.failed"/);
});

test("audit: every dashboard mutation writes an audit row, contact message status included", () => {
  const src = read("src/app/dr/messages/actions.ts");
  assert.match(src, /action: "message\.status"/);
  assert.match(src, /const user = await requirePermission\("review\.moderate"\)/);
});
