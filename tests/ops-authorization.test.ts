import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROLES, can, effectiveRole, permissionsOf, SUPER_ADMIN_EMAILS } from "../src/lib/rbac";

test("operations.manage is owner-only: SUPER_ADMIN (the owner's address) and no other role", () => {
  for (const role of ROLES) assert.equal(can(role, "operations.manage"), role === "SUPER_ADMIN", role);
  assert.ok(!permissionsOf("ADMIN").includes("operations.manage"));
  // A stored SUPER_ADMIN on any other address acts as USER, so it cannot reach the Operations Center either.
  assert.equal(can(effectiveRole("SUPER_ADMIN", "attacker@example.org"), "operations.manage"), false);
  assert.equal(can(effectiveRole("SUPER_ADMIN", SUPER_ADMIN_EMAILS[0]), "operations.manage"), true);
  assert.deepEqual([...SUPER_ADMIN_EMAILS], ["rebar9988@gmail.com"]);
});

test("every entry point of /dr/operations checks operations.manage on the server", () => {
  const page = readFileSync("src/app/dr/operations/page.tsx", "utf8");
  assert.match(page, /await requireDr\("operations\.manage"\)/);
  assert.ok(page.indexOf('requireDr("operations.manage")') < page.indexOf("recentReports("), "guard runs before any data is read");
  const actions = readFileSync("src/app/dr/operations/actions.ts", "utf8");
  assert.match(actions, /^"use server";/);
  const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(exported.sort(), ["runAgentAction", "runAllAction"]);
  for (const name of exported) {
    const body = actions.slice(actions.indexOf(`function ${name}`)).split("export async function")[0];
    assert.match(body, /const user = await requirePermission\("operations\.manage"\);/, name);
    assert.ok(body.indexOf("requirePermission") < body.indexOf("await runA"), `${name}: authorization before execution`);
  }
  const nav = readFileSync("src/components/dr/nav.ts", "utf8");
  assert.match(nav, /href: "\/dr\/operations", permission: "operations\.manage"/);
});

test("/dr/operations stays private: dashboard routes are noindex and excluded from the public edge cache", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /source: "\/dr\/:path\*", headers: \[\{ key: "X-Robots-Tag", value: "noindex, nofollow" \}\]/);
  const cache = readFileSync("src/lib/edge-cache.ts", "utf8");
  assert.match(cache, /\/dr/);
});
