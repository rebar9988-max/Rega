import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { can } from "../src/lib/rbac";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("owner delete: only administrators or business owners, always membership-checked, soft delete only, recover stays admin-only", () => {
  const src = read("src/app/dr/businesses/actions.ts");
  const del = src.slice(src.indexOf("export async function deleteBusiness"), src.indexOf("export async function recoverBusiness"));
  assert.match(del, /requirePermission\("business\.write"\)/);
  assert.match(del, /!can\(user\.role, "business\.delete"\) && user\.role !== "BUSINESS_OWNER"\) throw new HttpError\(403/);
  assert.ok(del.indexOf("assertBusinessAccess(user, id)") > del.indexOf("HttpError(403"), "membership check runs after the role check");
  assert.match(del, /deletedAt: now/);
  assert.doesNotMatch(del, /business\.delete\(/, "never a hard delete");
  const rec = src.slice(src.indexOf("export async function recoverBusiness"));
  assert.match(rec, /requirePermission\("business\.delete"\)/);
  // The RBAC table itself is unchanged: owners and employees still lack the general delete permission.
  for (const role of ["BUSINESS_OWNER", "EMPLOYEE", "MANAGER"] as const) assert.equal(can(role, "business.delete"), false, role);
});

test("account return path: only /{locale}/account, never an open redirect", () => {
  const src = read("src/app/dr/businesses/actions.ts");
  assert.match(src, /const ACCOUNT_PATH = \/\^\\\/\[a-z\]\{2,3\}\\\/account\$\//);
  assert.match(src, /own\.origin === "https:\/\/rega\.invalid" && ACCOUNT_PATH\.test\(own\.pathname\)/);
});

test("owner dashboard lists only managed businesses and reuses the server actions", () => {
  const src = read("src/features/account/OwnerBusinesses.tsx");
  assert.match(src, /deletedAt: null, \.\.\.managedBusinessWhere\(user\)/);
  assert.match(src, /import \{ deleteBusiness, updateBusiness \} from "@\/app\/dr\/businesses\/actions"/);
  const page = read("src/app/[locale]/account/page.tsx");
  assert.match(page, /owner \? \["business", "profile", "security"\] : \["profile", "security"\]/);
  assert.equal((page.match(/action=\{logout\}/g) ?? []).length, 1, "sign-out has exactly one place");
});
