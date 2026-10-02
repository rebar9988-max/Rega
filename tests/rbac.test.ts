import test from "node:test";
import assert from "node:assert/strict";
import { assignableRoles, can, canManageUser } from "../src/lib/rbac";

test("nobody manages their own account (no self-escalation or self-lockout)", () => {
  assert.equal(canManageUser({ id: "a", role: "SUPER_ADMIN" }, { id: "a", role: "SUPER_ADMIN" }), false);
  assert.equal(canManageUser({ id: "a", role: "ADMIN" }, { id: "a", role: "ADMIN" }), false);
});

test("only strictly lower ranks can be managed, except by a super admin", () => {
  assert.equal(canManageUser({ id: "a", role: "ADMIN" }, { id: "b", role: "EMPLOYEE" }), true);
  assert.equal(canManageUser({ id: "a", role: "ADMIN" }, { id: "b", role: "ADMIN" }), false);
  assert.equal(canManageUser({ id: "a", role: "ADMIN" }, { id: "b", role: "SUPER_ADMIN" }), false);
  assert.equal(canManageUser({ id: "a", role: "MANAGER" }, { id: "b", role: "EMPLOYEE" }), true);
  assert.equal(canManageUser({ id: "a", role: "EMPLOYEE" }, { id: "b", role: "USER" }), true);
  assert.equal(canManageUser({ id: "a", role: "SUPER_ADMIN" }, { id: "b", role: "SUPER_ADMIN" }), true);
});

test("roles that can be given never exceed the giver's own rank", () => {
  assert.deepEqual(assignableRoles("SUPER_ADMIN"), ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "USER"]);
  assert.deepEqual(assignableRoles("ADMIN"), ["MANAGER", "EMPLOYEE", "USER"]);
  assert.deepEqual(assignableRoles("USER"), []);
});

test("permission matrix: role changes stay with super admins; employees cannot publish or manage users", () => {
  assert.equal(can("SUPER_ADMIN", "user.role"), true);
  assert.equal(can("ADMIN", "user.role"), false);
  assert.equal(can("ADMIN", "user.write"), true);
  assert.equal(can("MANAGER", "user.write"), false);
  assert.equal(can("EMPLOYEE", "service.publish"), false);
  assert.equal(can("EMPLOYEE", "service.write"), true);
  assert.equal(can("USER", "business.read"), false);
});
