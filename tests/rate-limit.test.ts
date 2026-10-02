import test from "node:test";
import assert from "node:assert/strict";
import { allow } from "../src/lib/rate-limit";

test("allow() permits up to the limit then blocks within the window", () => {
  const key = `t:${Math.random()}`;
  const results = Array.from({ length: 5 }, () => allow(key, 3, 60_000));
  assert.deepEqual(results, [true, true, true, false, false]);
});

test("allow() keys are independent", () => {
  assert.equal(allow("a:" + Math.random(), 1, 1000), true);
  assert.equal(allow("b:" + Math.random(), 1, 1000), true);
});
