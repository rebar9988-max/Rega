import test from "node:test";
import assert from "node:assert/strict";
import { hashToken, newToken, tokenIdentifier } from "../src/features/auth/tokens-core";
import { ownerDetails } from "../src/config/owner";

test("tokens: 256 random bits, URL-safe, unique", () => {
  const a = newToken();
  const b = newToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

test("tokens: only the SHA-256 hash is stored; same input, same hash; different input, different hash", async () => {
  const raw = newToken();
  const h = await hashToken(raw);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, await hashToken(raw));
  assert.notEqual(h, await hashToken(raw + "x"));
  assert.ok(!h.includes(raw));
  // Known vector: sha256("abc")
  assert.equal(await hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("tokens: a verification token can never be used as a reset token (purpose is part of the identifier); e-mail case is ignored", () => {
  assert.notEqual(tokenIdentifier("verify", "a@example.org"), tokenIdentifier("reset", "a@example.org"));
  assert.equal(tokenIdentifier("reset", " A@Example.ORG "), "reset:a@example.org");
});

test("owner: e-mail provider is named in the privacy policy only when one is configured", () => {
  assert.equal(ownerDetails({}).emailProvider, "");
  assert.match(ownerDetails({ EMAIL_PROVIDER: "resend" }).emailProvider, /Resend/);
  assert.equal(ownerDetails({ EMAIL_PROVIDER: "resend", LEGAL_EMAIL_PROVIDER: "Postmark" }).emailProvider, "Postmark");
});
