import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("both Workers have preview config and isolate inherited production credentials", () => {
  for (const file of ["wrangler.jsonc", "services/ai-python/wrangler.jsonc"]) {
    const { config, error } = ts.parseConfigFileTextToJson(file, read(file));
    assert.equal(error, undefined);
    assert.equal(config.previews.vars.REGA_ISOLATED_PREVIEW, "1");
    for (const name of Object.keys(config.previews.vars)) assert.doesNotMatch(name, /SECRET|API_KEY|DATABASE_URL/);
    assert.equal(config.previews.ai, undefined, "no billed AI in previews");
    assert.equal(config.previews.hyperdrive, undefined, "no production database binding");
  }
});

test("CI audits every dependency severity and retains real disposable database validation", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /npm audit --audit-level=low/);
  assert.match(ci, /image: postgres:16/);
  assert.match(ci, /prisma migrate deploy/);
  assert.match(ci, /npm run e2e/);
});

test("unconsumed Neon provisioner cannot create or delete external resources automatically", () => {
  const policy = read(".github/workflows/neon-branch.yml");
  assert.match(policy, /workflow_dispatch:/);
  assert.doesNotMatch(policy, /pull_request:|create-branch-action|delete-branch-action|NEON_API_KEY/);
});


test("release tag records the checked-out verified SHA even if main advances", () => {
  const deploy = read(".github/workflows/deploy.yml");
  assert.match(deploy, /RELEASE_SHA:.*github.event.workflow_run.head_sha/);
  assert.ok(deploy.includes('test "$RELEASE_SHA" = "$(git rev-parse HEAD)"'));
  assert.ok(deploy.includes('wrangler deploy --tag "$RELEASE_SHA"'));
});
