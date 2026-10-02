import test from "node:test";
import assert from "node:assert/strict";
import { isMissingBusinessTable } from "./e2e/database-safety";

test("E2E permits only the specific missing Business table probe error", () => {
  assert.equal(isMissingBusinessTable({ code: "P2021", meta: { table: "public.Business" } }), true);
  assert.equal(isMissingBusinessTable({ code: "P2021", meta: { table: "Business" } }), true);
  for (const error of [null, new Error("connection failed"), { code: "P1000" }, { code: "P1001" },
    { code: "P2024" }, { code: "P2022" }, { code: "P2021" }, { code: "P2021", meta: { table: "User" } }]) {
    assert.equal(isMissingBusinessTable(error), false);
  }
});
