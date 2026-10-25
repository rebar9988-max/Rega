import test from "node:test";
import assert from "node:assert/strict";
import { docsOnly } from "../scripts/deploy-scope.mjs";

test("docs-only deployment scope is shared and never skips unknown, empty or application diffs", () => {
  assert.equal(docsOnly(["REGA24_SYSTEM_MAP.md", "docs/generated/system-inventory.json"]), true);
  assert.equal(docsOnly(["scripts/generate-system-inventory.mjs", "scripts/validate-system-docs.mjs", "scripts/rega24-docs.mjs"]), true);
  for (const files of [[], ["src/app/admin/page.tsx"], ["README.md", "wrangler.jsonc"], ["package-lock.json"], ["scripts/verified-release.mjs"]]) assert.equal(docsOnly(files), false);
});
