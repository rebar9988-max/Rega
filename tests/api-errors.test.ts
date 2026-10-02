import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { knownDbError } from "../src/lib/api-types";

const prismaError = (code: string) => Object.assign(new Error("db"), { name: "PrismaClientKnownRequestError", code });

test("unique-constraint and missing-record database errors become 409 / 404, not 500", () => {
  assert.deepEqual(knownDbError(prismaError("P2002"))?.status, 409);
  assert.deepEqual(knownDbError(prismaError("P2025"))?.status, 404);
  assert.equal(knownDbError(prismaError("P2025"))?.code, "not_found");
});

test("other errors stay unmapped (logged 500)", () => {
  assert.equal(knownDbError(prismaError("P1001")), null); // database unreachable is a server problem
  assert.equal(knownDbError(Object.assign(new Error("x"), { code: "P2002" })), null); // not a Prisma error
  assert.equal(knownDbError(new Error("boom")), null);
  assert.equal(knownDbError(null), null);
  assert.equal(knownDbError("P2002"), null);
});

test("the login stand-in hash is a well-formed 60-character cost-12 bcrypt hash", () => {
  // bcryptjs returns false immediately for any other length, which skips the hashing and makes unknown e-mail
  // addresses answer faster than real accounts (user enumeration by timing).
  const source = readFileSync(path.join(__dirname, "../src/auth.config.ts"), "utf8");
  const match = source.match(/const DUMMY_HASH = "([^"]+)"/);
  assert.ok(match, "DUMMY_HASH constant not found");
  assert.equal(match[1].length, 60);
  assert.match(match[1], /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
});
