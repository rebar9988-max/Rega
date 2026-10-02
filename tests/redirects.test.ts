import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";

type Rule = { source: string; has?: { type: string; value: string }[]; destination: string; permanent?: boolean; statusCode?: number };

async function apexRules(): Promise<Rule[]> {
  const rules = (await nextConfig.redirects!()) as Rule[];
  return rules.filter((r) => r.has?.some((h) => h.type === "host"));
}

test("apex→www redirect matches ONLY the apex host (regression: www redirected to itself)", async () => {
  const rules = await apexRules();
  assert.ok(rules.length >= 2);
  // Router implementations differ: some anchor the pattern, some do not. It must be correct either way.
  const matchers = [(v: string) => new RegExp(v), (v: string) => new RegExp(`^${v}$`)];
  for (const rule of rules) {
    const value = rule.has![0].value;
    for (const make of matchers) {
      const re = make(value);
      assert.equal(re.test("regaplatform.com"), true, "apex must match");
      for (const other of ["www.regaplatform.com", "xregaplatform.com", "regaplatform.com.evil.io", "regaplatformXcom", "localhost:3000", "rega-platform.workers.dev"]) {
        assert.equal(re.test(other), false, `${other} must NOT match`);
      }
    }
  }
});

test("apex redirect destinations are absolute, permanent, and never contain an unsubstituted :path*", async () => {
  for (const rule of await apexRules()) {
    assert.match(rule.destination, /^https:\/\/www\.regaplatform\.com\//);
    assert.equal(rule.statusCode, 301);
    assert.ok(!rule.destination.includes(":path*"), "':path*' is not substituted for the empty path");
  }
  const sources = (await apexRules()).map((r) => r.source).sort();
  assert.deepEqual(sources, ["/", "/:path+"]);
});
