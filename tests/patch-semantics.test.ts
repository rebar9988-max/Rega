import test from "node:test";
import assert from "node:assert/strict";
import { businessUpdateSchema, locationUpdateSchema, serviceUpdateSchema, categoryUpdateSchema } from "../src/lib/validation";

test("PATCH omission never applies create defaults after the Zod security upgrade", () => {
  for (const schema of [businessUpdateSchema, locationUpdateSchema, serviceUpdateSchema, categoryUpdateSchema]) assert.deepEqual(schema.parse({}), {});
  assert.deepEqual(businessUpdateSchema.parse({ name: "Updated business" }), { name: "Updated business" });
  assert.deepEqual(businessUpdateSchema.parse({ featured: false, tags: [] }), { featured: false, tags: [] });
  assert.deepEqual(serviceUpdateSchema.parse({ sortOrder: 0 }), { sortOrder: 0 });
});
