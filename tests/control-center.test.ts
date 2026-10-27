import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import nextConfig from "../next.config";
import { edgeCacheKey } from "../src/lib/edge-cache";
import { canManageSystem, isManagedFlag } from "../src/lib/control-center";
import { ROLES } from "../src/lib/rbac";

test("one canonical dashboard routes admin to the shared implementation and legacy links forward", async () => {
  assert.equal(existsSync("src/app/admin/page.tsx"), true);
  assert.equal(existsSync("src/app/dr/page.tsx"), false);
  const redirects = await nextConfig.redirects!();
  assert.ok(redirects.some(r => r.source === "/dr" && r.destination === "/admin" && r.permanent));
  assert.ok(redirects.some(r => r.source === "/dr/:path+" && r.destination === "/admin/:path+" && r.permanent));
});

test("all canonical and legacy admin paths bypass public cache including token-bearing requests", () => {
  for (const path of ["/admin", "/admin/media", "/admin/system?token=private", "/dr", "/dr/system"]) {
    assert.equal(edgeCacheKey(new Request(`https://www.rega24.com${path}`)), null);
  }
});

test("system operations are Super Admin only; settings reject secrets and arbitrary keys", () => {
  for (const role of ROLES) assert.equal(canManageSystem(role), role === "SUPER_ADMIN");
  assert.equal(isManagedFlag("public.reviews"), true);
  for (const key of ["DATABASE_URL", "AUTH_SECRET", "public.aiSearch", "__proto__", null, "", []]) assert.equal(isManagedFlag(key), false);
});
