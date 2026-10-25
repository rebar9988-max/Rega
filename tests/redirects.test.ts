import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";

type Rule = { source: string; has?: { type: string; value: string }[]; destination: string; permanent?: boolean; statusCode?: number };

async function apexRules(): Promise<Rule[]> {
  const rules = (await nextConfig.redirects!()) as Rule[];
  return rules.filter((r) => r.has?.some((h) => h.type === "host" && new RegExp(h.value).test("rega24.com")));
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
      assert.equal(re.test("rega24.com"), true, "apex must match");
      for (const other of ["www.rega24.com", "xrega24.com", "rega24.com.evil.io", "rega24Xcom", "localhost:3000", "rega-platform.workers.dev"]) {
        assert.equal(re.test(other), false, `${other} must NOT match`);
      }
    }
  }
});

test("apex redirect destinations are absolute, permanent, and never contain an unsubstituted :path*", async () => {
  for (const rule of await apexRules()) {
    assert.match(rule.destination, /^https:\/\/www\.rega24\.com\//);
    assert.equal(rule.statusCode, 301);
    assert.ok(!rule.destination.includes(":path*"), "':path*' is not substituted for the empty path");
  }
  const sources = (await apexRules()).map((r) => r.source).sort();
  assert.deepEqual(sources, ["/", "/:path+"]);
});


test("legacy website hosts redirect to the official canonical host, without touching media or other projects", async () => {
  const rules = (await nextConfig.redirects!()) as Rule[];
  const legacy = rules.filter(r => r.has?.some(h => h.type === "host" && new RegExp(h.value).test("regaplatform.com")));
  assert.equal(legacy.length, 2);
  for (const rule of legacy) {
    const host = new RegExp(rule.has![0].value);
    assert.equal(host.test("www.regaplatform.com"), true);
    for (const excluded of ["media.regaplatform.com", "www.rega24.com", "regaplatform.com.evil.org"]) assert.equal(host.test(excluded), false);
    assert.equal(rule.statusCode, 301);
    assert.match(rule.destination, /^https:\/\/www\.rega24\.com\//);
    assert.ok(!rule.destination.includes(":path*"));
  }
});
