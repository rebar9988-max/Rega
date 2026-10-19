import test from "node:test";
import assert from "node:assert/strict";
import { isStoredWhatsapp, normalizeWhatsapp, whatsappLink } from "../src/lib/whatsapp";

const ok = (input: string, country?: string) => {
  const r = normalizeWhatsapp(input, country);
  return r.ok ? r.value : `ERR:${r.reason}`;
};

test("international numbers are normalised to +<digits>", () => {
  assert.equal(ok("+49 178 4228269"), "+491784228269");
  assert.equal(ok("+49-178-4228269"), "+491784228269");
  assert.equal(ok("  +49 (178) 422 82 69 "), "+491784228269");
  assert.equal(ok("0049 178 4228269"), "+491784228269");
  assert.equal(ok("+964 750 123 4567"), "+9647501234567");
  assert.equal(ok("+1 (202) 555-0123"), "+12025550123");
});

test("a bracketed trunk zero after the country code is dropped", () => {
  assert.equal(ok("+49 (0) 178 4228269"), "+491784228269");
  assert.equal(ok("0049 (0)178 4228269"), "+491784228269");
});

test("national numbers need the business's country and a trunk-0 country", () => {
  assert.equal(ok("0178 4228269", "DE"), "+491784228269");
  assert.equal(ok("0178/4228269", "de"), "+491784228269");
  assert.equal(ok("0750 123 4567", "IQ"), "+9647501234567");
  assert.equal(ok("0178 4228269"), "ERR:invalid"); // no country: never guess
  assert.equal(ok("0178 4228269", "XX"), "ERR:invalid");
  assert.equal(ok("0612 345 678", "IT"), "ERR:invalid"); // Italy keeps its leading 0: must be typed with +39
  assert.equal(ok("2025550123", "US"), "ERR:invalid"); // no trunk zero: must be typed with +1
  assert.equal(ok("178 4228269", "DE"), "ERR:invalid"); // not national (no 0) and not international (no +)
});

test("empty input is reported as empty, not invalid", () => {
  assert.equal(ok(""), "ERR:empty");
  assert.equal(ok("   "), "ERR:empty");
  assert.equal(normalizeWhatsapp(undefined).ok, false);
  assert.equal(normalizeWhatsapp(null).ok, false);
});

test("anything that is not a phone number is rejected, never cleaned up", () => {
  for (const bad of [
    "https://wa.me/491784228269", "wa.me/491784228269", "javascript:alert(1)", "+49 178 4228269?text=hi", "+49 178 4228269&x=1",
    "+49 178 4228269 <script>", "+49178abc4228", "call me +49 178 4228269", "+49 178 4228269@evil.test", "+49%20178%204228269",
    "+", "00", "+++49178422826", "++491784228269", "+49 178 42+28269", "+49\u0000178", "+49\n178 4228269",
  ]) assert.equal(normalizeWhatsapp(bad, "DE").ok, false, `should reject ${JSON.stringify(bad)}`);
});

test("surrounding whitespace is trimmed, not rejected", () => {
  assert.equal(ok("  +491784228269\n"), "+491784228269");
});

test("length limits follow E.164 (8 to 15 digits, first digit not 0)", () => {
  assert.equal(ok("+4917"), "ERR:invalid");
  assert.equal(ok("+491784"), "ERR:invalid");
  assert.equal(ok("+4917842"), "ERR:invalid"); // 7 digits
  assert.equal(ok("+49178422"), "+49178422"); // 8 digits
  assert.equal(ok("+123456789012345"), "+123456789012345"); // 15 digits
  assert.equal(ok("+1234567890123456"), "ERR:invalid"); // 16 digits
  assert.equal(ok("+0491784228269"), "ERR:invalid"); // country code never starts with 0
  assert.equal(ok("0".repeat(60)), "ERR:invalid");
});

test("whatsappLink builds https://wa.me/<digits> only from a stored, valid number", () => {
  assert.equal(whatsappLink("+491784228269"), "https://wa.me/491784228269");
  assert.equal(whatsappLink("+9647501234567"), "https://wa.me/9647501234567");
  for (const bad of [null, undefined, "", "491784228269", "+49178", "+49 178 4228269", "https://evil.test", "+491784228269?text=x", "+491784228269/../x", "javascript:alert(1)"]) {
    assert.equal(whatsappLink(bad), null, `no link for ${JSON.stringify(bad)}`);
  }
});

test("a normalised number always produces a link that contains only digits after wa.me/", () => {
  for (const input of ["+49 178 4228269", "0049 178 4228269", "+1 (202) 555-0123"]) {
    const r = normalizeWhatsapp(input, "DE");
    assert.ok(r.ok);
    assert.ok(isStoredWhatsapp(r.value));
    assert.match(whatsappLink(r.value)!, /^https:\/\/wa\.me\/[1-9]\d{7,14}$/);
  }
});
