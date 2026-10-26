import test from "node:test";
import assert from "node:assert/strict";
import {
  businessCreateSchema, businessUpdateSchema, locationUpdateSchema,
  serviceUpdateSchema, categoryUpdateSchema,
} from "../src/lib/validation";

for (const [name, schema, input] of [
  ["business", businessUpdateSchema, { name: "Changed" }],
  ["location", locationUpdateSchema, { addressLine1: "Changed street 12" }],
  ["service", serviceUpdateSchema, { name: "Changed" }],
  ["category", categoryUpdateSchema, { nameDe: "Changed" }],
] as const) {
  test(`partial ${name} update never resets omitted production fields to create defaults`, () => {
    assert.deepEqual(schema.parse({}), {});
    assert.deepEqual(schema.parse(input), input);
  });
}

test("business creation keeps its approved defaults", () => {
  assert.deepEqual(businessCreateSchema.parse({ name: "Example" }), {
    name: "Example", status: "draft", verified: false, featured: false, tags: [],
  });
});

test("bounded collections reject oversize input without accumulating per-item errors", () => {
  const parsed = businessCreateSchema.safeParse({ name: "Example", tags: Array(1000).fill(null) });
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.ok(parsed.error.issues.length <= 2);
});
