import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROLES, SUPER_ADMIN_EMAILS, effectiveRole, isSuperAdminEmail, can } from "../src/lib/rbac";
import { DR_CODE_EMAILS, mayReceiveDrCode } from "../src/features/auth/admin-code-core";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const OWNER = "rebar9988@gmail.com";

test("owner-only SUPER_ADMIN: exactly one address, frozen, shared by /dr codes", () => {
  assert.deepEqual([...SUPER_ADMIN_EMAILS], [OWNER]);
  assert.ok(Object.isFrozen(SUPER_ADMIN_EMAILS));
  assert.equal(DR_CODE_EMAILS, SUPER_ADMIN_EMAILS);
  assert.ok(isSuperAdminEmail(OWNER) && isSuperAdminEmail(" Rebar9988@GMAIL.com "));
  for (const other of ["regaplatform1@gmail.com", "admin@example.org", "rebar9988@gmail.co", "rebar9988+a@gmail.com", "xrebar9988@gmail.com", "", null, undefined]) {
    assert.equal(isSuperAdminEmail(other as string), false, String(other));
    assert.equal(mayReceiveDrCode(String(other ?? "")), false, String(other));
  }
});

test("owner-only SUPER_ADMIN: a stored SUPER_ADMIN on any other address fails closed to USER", () => {
  assert.equal(effectiveRole("SUPER_ADMIN", OWNER), "SUPER_ADMIN");
  assert.equal(effectiveRole("SUPER_ADMIN", "Rebar9988@gmail.com"), "SUPER_ADMIN");
  for (const email of ["regaplatform1@gmail.com", "", null, undefined]) {
    assert.equal(effectiveRole("SUPER_ADMIN", email), "USER", String(email));
    assert.equal(can(effectiveRole("SUPER_ADMIN", email), "user.role"), false);
  }
  // Every other role is untouched, for every address.
  for (const role of ROLES.filter((r) => r !== "SUPER_ADMIN")) {
    assert.equal(effectiveRole(role, "someone@example.org"), role);
    assert.equal(effectiveRole(role, OWNER), role);
  }
  // Unknown or missing roles are USER.
  assert.equal(effectiveRole("ROOT", OWNER), "USER");
  assert.equal(effectiveRole(undefined, OWNER), "USER");
});

test("owner-only SUPER_ADMIN: applied at sign-in, session revalidation, every session read and every privileged guard", () => {
  const config = read("src/auth.config.ts");
  assert.match(config, /token\.role = effectiveRole\(user\.role, user\.email\)/, "sign-in, any provider");
  assert.match(config, /select: \{ role: true, email: true, status: true, passwordHash: true \}/);
  assert.match(config, /token\.role = effectiveRole\(current\.role, current\.email\)/, "periodic revalidation");
  assert.match(config, /session\.user\.role = effectiveRole\(token\.role/, "every session read, old tokens included");
  assert.doesNotMatch(config, /token\.role = (user|current)\.role\b/);

  const helpers = read("src/lib/auth-helpers.ts");
  assert.match(helpers, /role: effectiveRole\(session\.user\.role, session\.user\.email\)/, "currentUser");
  assert.match(helpers, /role: effectiveRole\(row\.role, row\.email\)/, "currentAccount, used by requirePermission/requireStaff");

  const admin = read("src/lib/user-admin.ts");
  assert.equal((admin.match(/input\.role === "SUPER_ADMIN" && !isSuperAdminEmail\(/g) ?? []).length, 2, "create and update refuse SUPER_ADMIN for other addresses");
  assert.match(admin, /email: \{ in: \[\.\.\.SUPER_ADMIN_EMAILS\], mode: "insensitive" \}/, "only the owner counts as the last SUPER_ADMIN");

  const code = read("src/features/auth/admin-code.ts");
  assert.match(code, /if \(!mayReceiveDrCode\(email\)\) return null;/);
});

test("owner-only SUPER_ADMIN: no code, secret or session value is logged by the /dr sign-in", () => {
  const code = read("src/features/auth/admin-code.ts");
  for (const m of code.matchAll(/log\.(info|warn|error)\(([^)]*)\)/g)) {
    assert.doesNotMatch(m[2], /\bcode\b(?!_)|codeHash|AUTH_SECRET|token/i, m[0]);
  }
});
