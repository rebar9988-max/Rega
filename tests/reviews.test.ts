import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, isStarRating } from "../src/features/reviews/rating";

test("rating aggregate: average to one decimal over approved star ratings; invalid values are ignored", () => {
  assert.deepEqual(aggregate([]), { avg: 0, count: 0 });
  assert.deepEqual(aggregate([5, 4]), { avg: 4.5, count: 2 });
  assert.deepEqual(aggregate([5, 4, 4]), { avg: 4.3, count: 3 });
  assert.deepEqual(aggregate([5, 0, 6, 2.5, 3]), { avg: 4, count: 2 });
});

test("star ratings are integers from 1 to 5", () => {
  for (const n of [1, 2, 3, 4, 5]) assert.ok(isStarRating(n));
  for (const n of [0, 6, -1, 2.5, NaN]) assert.ok(!isStarRating(n));
});
