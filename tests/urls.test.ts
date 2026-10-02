import test from "node:test";
import assert from "node:assert/strict";
import { safeHttpUrl, safeTel } from "../src/lib/urls";

test("safeHttpUrl only allows http(s)", () => {
  assert.equal(safeHttpUrl("https://example.org"), "https://example.org/");
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,x"), null);
  assert.equal(safeHttpUrl("not a url"), null);
  assert.equal(safeHttpUrl(null), null);
});

test("safeTel strips everything but digits and a leading +", () => {
  assert.equal(safeTel("+49 (30) 123-4567"), "+49301234567");
  assert.equal(safeTel("12"), null);
  assert.equal(safeTel("0049+30123456"), "004930123456");
});
