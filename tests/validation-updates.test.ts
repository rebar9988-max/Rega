import test from "node:test";
import assert from "node:assert/strict";
import {
  businessUpdateSchema,
  locationUpdateSchema,
  serviceUpdateSchema,
  categoryUpdateSchema,
} from "../src/lib/validation";

// A validation-library upgrade must never turn a partial edit into an overwrite.
for (const [name, schema, values] of [
  ["business", businessUpdateSchema, { status: "published", verified: true, featured: false, tags: [] }],
  ["location", locationUpdateSchema, { status: "active", isPrimary: false }],
  ["service", serviceUpdateSchema, { currency: "usd", status: "published", featured: false, sortOrder: 0 }],
  ["category", categoryUpdateSchema, { sortOrder: 0, isActive: false }],
] as const) {
  test(`${name}: partial updates preserve omitted values and accept explicit replacements`, () => {
    assert.deepEqual(schema.parse({}), {});
    assert.deepEqual(schema.parse(values), name === "service" ? { ...values, currency: "USD" } : values);
    for (const key of Object.keys(values)) {
      const patch = schema.parse({ [key]: values[key as keyof typeof values] });
      assert.deepEqual(Object.keys(patch), [key]);
    }
  });
}
