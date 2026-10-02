import test from "node:test";
import assert from "node:assert/strict";
import { depthOf, descendantIds, treeOrder, wouldCreateCycle } from "../src/lib/category-tree";

const rows = [
  { id: "a", parentId: null }, { id: "a1", parentId: "a" }, { id: "a1x", parentId: "a1" }, { id: "a1x1", parentId: "a1x" },
  { id: "a2", parentId: "a" }, { id: "b", parentId: null }, { id: "orphan", parentId: "gone" },
];

test("descendants of any depth", () => {
  assert.deepEqual(descendantIds(rows, "a").sort(), ["a", "a1", "a1x", "a1x1", "a2"]);
  assert.deepEqual(descendantIds(rows, "a1x"), ["a1x", "a1x1"]);
  assert.deepEqual(descendantIds(rows, "b"), ["b"]);
});

test("tree order: each parent followed by its subtree, depth attached, orphans become roots", () => {
  assert.deepEqual(treeOrder(rows).map((r) => `${r.id}:${r.depth}`), ["a:0", "a1:1", "a1x:2", "a1x1:3", "a2:1", "b:0", "orphan:0"]);
});

test("a category cannot be moved below itself or its descendants", () => {
  assert.ok(wouldCreateCycle(rows, "a", "a1x1"));
  assert.ok(wouldCreateCycle(rows, "a", "a"));
  assert.ok(!wouldCreateCycle(rows, "a1", "b"));
  assert.ok(!wouldCreateCycle(rows, "b", "a1x"));
});

test("bad data with a cycle never loops forever", () => {
  const cyc = [{ id: "x", parentId: "y" }, { id: "y", parentId: "x" }];
  assert.deepEqual(descendantIds(cyc, "x").sort(), ["x", "y"]);
  assert.ok(depthOf(cyc, "x") < 20);
  assert.equal(treeOrder(cyc).length, 0 + treeOrder(cyc).length); // terminates
});
