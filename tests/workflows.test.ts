import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("beta health: a failed required check fails the workflow (no job-level continue-on-error)", () => {
  const wf = read(".github/workflows/production-health.yml");
  const job = wf.slice(wf.indexOf("  health:"), wf.indexOf("    steps:"));
  assert.ok(!/continue-on-error:\s*true/.test(job), "job-level continue-on-error turns failed smoke checks into a green run");
  // Every production probe shares the bounded, recorded retry helper instead of ad-hoc loops.
  assert.ok(wf.includes('. "$PROBE"'));
  assert.ok(!/for attempt in 1 2 3; do/.test(wf));
});

test("beta health probe: retries only transport errors and 5xx, records them, and keeps the first error", () => {
  const sh = read("scripts/health/probe.sh");
  assert.match(sh, /000\|5\?\?\)/);
  assert.match(sh, /\*\) break ;;/);
  assert.match(sh, /PROBE_FIRST_ERROR/);
  assert.match(sh, /PROBE_RETRIES_LOG/);
});

test("CI: runs on main are never cancelled by a newer push; pull requests still are", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /group: ci-\$\{\{ github\.event_name == 'pull_request' && github\.ref \|\| github\.sha \}\}/);
  assert.match(ci, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
});
