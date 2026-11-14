import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AVAILABILITY, MAX_RECIPIENTS, REQUEST_TTL_DAYS, cleanText, createRequestSchema, distanceLabel, effectiveStatus, expiryFrom, formatEuro, isActionable, offerSchema, parsePriceCents, roundCoord,
} from "../src/features/smart-request/rules";

const base = { categoryId: "cat_1", title: "Brake pads VW Polo", description: "", radiusKm: "10", consent: "on", locale: "ckb" };

test("coordinates are rounded to ~1 km before storage", () => {
  assert.equal(roundCoord(51.123456), 51.12);
  assert.equal(roundCoord(-6.987654), -6.99);
});

test("price parsing: comma or dot, up to two decimals, bounded", () => {
  assert.equal(parsePriceCents("12,50"), 1250);
  assert.equal(parsePriceCents("120"), 12000);
  assert.equal(parsePriceCents(" 0.01 "), 1);
  for (const bad of ["", "0", "-5", "abc", "1.234", "1e5", "10000000", "1,2,3"]) assert.equal(parsePriceCents(bad), null, bad);
  assert.equal(formatEuro(12050), "120,50 €");
});

test("text is cleaned of control characters", () => {
  assert.equal(cleanText("  a\u0000b \n c  "), "a b c");
  assert.equal(cleanText("a\n\n\n\nb", true), "a\n\nb");
});

test("request schema: location is a city or a coordinate pair; consent is required", () => {
  assert.equal(createRequestSchema.safeParse({ ...base }).success, false);
  assert.equal(createRequestSchema.safeParse({ ...base, cityId: "city_1" }).success, true);
  assert.equal(createRequestSchema.safeParse({ ...base, lat: "51.2", lng: "6.8" }).success, true);
  assert.equal(createRequestSchema.safeParse({ ...base, lat: "51.2" }).success, false);
  assert.equal(createRequestSchema.safeParse({ ...base, lat: "95", lng: "6.8" }).success, false);
  assert.equal(createRequestSchema.safeParse({ ...base, cityId: "c", consent: undefined }).success, false);
  assert.equal(createRequestSchema.safeParse({ ...base, cityId: "c", radiusKm: "7" }).success, false);
  assert.equal(createRequestSchema.safeParse({ ...base, cityId: "c", title: "ab" }).success, false);
  assert.equal(createRequestSchema.safeParse({ ...base, cityId: "c", categoryId: "x y;drop" }).success, false);
  const ok = createRequestSchema.parse({ ...base, cityId: "c", title: "  Hello\u0000  world " });
  assert.equal(ok.title, "Hello world");
  assert.equal(ok.radiusKm, 10);
});

test("offer schema: price, availability and message are validated", () => {
  const offer = { requestId: "r1", businessId: "b1", price: "99,90", availability: "today", message: "ok" };
  const parsed = offerSchema.parse(offer);
  assert.equal(parsed.price, 9990);
  for (const bad of [{ price: "free" }, { availability: "never" }, { message: "x".repeat(501) }, { businessId: "" }]) {
    assert.equal(offerSchema.safeParse({ ...offer, ...bad }).success, false, JSON.stringify(bad));
  }
  assert.deepEqual([...AVAILABILITY], ["now", "today", "tomorrow", "thisWeek", "onRequest"]);
});

test("status: open requests expire by date, closed and cancelled stay", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const future = new Date(now.getTime() + 1000);
  const past = new Date(now.getTime() - 1000);
  assert.equal(effectiveStatus({ status: "open", expiresAt: future }, now), "open");
  assert.equal(effectiveStatus({ status: "open", expiresAt: past }, now), "expired");
  assert.equal(effectiveStatus({ status: "closed", expiresAt: future }, now), "closed");
  assert.equal(effectiveStatus({ status: "cancelled", expiresAt: future }, now), "cancelled");
  assert.equal(isActionable({ status: "open", expiresAt: past }, now), false);
  assert.equal(expiryFrom(now).getTime() - now.getTime(), REQUEST_TTL_DAYS * 86_400_000);
  assert.ok(MAX_RECIPIENTS <= 25);
});

test("business-facing distance is rounded and never an exact figure", () => {
  assert.equal(distanceLabel(0.4), "< 1 km");
  assert.equal(distanceLabel(3.449), "3.4 km");
});

test("privacy and authorization structure of the service (source checks)", () => {
  const service = readFileSync("src/features/smart-request/service.ts", "utf8");
  // A business never selects the requester's coordinates, user id or contact data.
  const inbox = service.slice(service.indexOf("export async function businessInbox"), service.indexOf("export async function markSeen"));
  for (const forbidden of ["latitude", "longitude", "userId: true", "email", "phone"]) assert.ok(!inbox.includes(forbidden), `inbox must not select ${forbidden}`);
  // Requester reads and writes are always scoped to the owner.
  assert.match(service, /findFirst\(\{\s*where: \{ id, userId \}/);
  assert.match(service, /updateMany\(\{ where: \{ id, userId \}/);
  // Offer actions require an active membership of a published business and a matched recipient row.
  assert.equal((service.match(/businessMember\.findFirst\(\{ where: \{ userId: actor\.id/g) ?? []).length, 3);
  assert.match(service, /requestId_businessId/);
  // Contact details are only returned for the selected offer.
  assert.match(service, /contact: selected \? \{ phone, whatsapp \} : null/);
});

test("migrations are additive and repeatable; D1 metadata knows the new tables", () => {
  const d1 = readFileSync("prisma/d1/migrations/0006_smart_request.sql", "utf8");
  const pg = readFileSync("prisma/migrations/20261114120000_smart_request/migration.sql", "utf8");
  for (const sql of [d1, pg]) {
    assert.ok(!/\bDROP\s+(TABLE|COLUMN)\b(?![^\n]*--)/i.test(sql.split("\n").filter((l) => !l.startsWith("--")).join("\n")), "no destructive statement outside comments");
    assert.ok(!/\bALTER\s+TABLE\b/i.test(sql.split("\n").filter((l) => !l.startsWith("--")).join("\n")), "no existing table is altered");
    for (const table of ["SmartRequest", "SmartRequestRecipient", "SmartOffer", "SmartRequestPref"]) assert.match(sql, new RegExp(`CREATE TABLE (IF NOT EXISTS )?"${table}"`));
  }
  assert.ok(/CREATE TABLE IF NOT EXISTS/.test(d1) && /CREATE UNIQUE INDEX IF NOT EXISTS "SmartOffer_requestId_businessId_key"/.test(d1));
  const meta = JSON.parse(readFileSync("src/lib/d1-models.json", "utf8")) as { models: { name: string }[] };
  for (const table of ["SmartRequest", "SmartRequestRecipient", "SmartOffer", "SmartRequestPref"]) assert.ok(meta.models.some((m) => m.name === table), table);
});

test("Radar guest access: signed device cookie lists only the guest's own requests", async () => {
  const { GUEST_MAX_IDS, normalizeIds, signGuestIds, verifyGuestIds, withRequest } = await import("../src/features/smart-request/guest-core");
  const secret = "test-secret-at-least-16";
  const signed = await signGuestIds(secret, ["req_a", "req_b"]);
  assert.deepEqual(await verifyGuestIds(secret, signed), ["req_a", "req_b"]);
  // Forged, tampered, foreign-secret and malformed cookies yield nothing.
  const [payload, sig] = signed.split(".");
  const forged = Buffer.from("req_a,req_b,someone_else").toString("base64url");
  for (const bad of [`${forged}.${sig}`, `${payload}.x${sig.slice(1)}`, `${payload}`, "", ".", "a.b", undefined]) assert.deepEqual(await verifyGuestIds(secret, bad), [], String(bad));
  assert.deepEqual(await verifyGuestIds("another-secret-16chars", signed), []);
  // New requests go first, duplicates and malformed ids are dropped, the list is capped.
  assert.deepEqual(withRequest(["a", "b"], "b"), ["b", "a"]);
  assert.deepEqual(normalizeIds(["ok", "x y", "", 5, "ok", "drop;table"]), ["ok"]);
  assert.equal(withRequest(Array.from({ length: 40 }, (_, i) => `r${i}`), "new").length, GUEST_MAX_IDS);
});

test("Radar is public: no login gate on the requester flow; guests are scoped to their own requests", () => {
  const actions = readFileSync("src/features/smart-request/actions.ts", "utf8");
  const create = actions.slice(actions.indexOf("export async function createRequestAction"), actions.indexOf("export async function submitOfferAction"));
  assert.ok(!create.includes('error: "signin"') && !create.includes("currentAccount"), "creating a request needs no account");
  assert.match(create, /guardForm\(formData, "sr-create", 5\)/);
  assert.match(create, /sr-create-day:\$\{ip\}/);
  assert.match(create, /rememberGuestRequest/);
  for (const page of ["src/app/[locale]/smart-request/page.tsx", "src/app/[locale]/smart-request/new/page.tsx", "src/app/[locale]/smart-request/[id]/page.tsx"]) {
    const src = readFileSync(page, "utf8");
    assert.ok(!src.includes("/login") && !src.includes("redirect("), `${page} must not redirect to login`);
  }
  // The business inbox stays a signed-in business tool.
  assert.match(readFileSync("src/app/[locale]/smart-request/inbox/page.tsx", "utf8"), /login\?next=/);
  const service = readFileSync("src/features/smart-request/service.ts", "utf8");
  for (const fn of ["getMyRequest", "markOffersSeen", "ownOpenRequest"]) {
    const body = service.slice(service.indexOf(`function ${fn}`));
    assert.match(body.slice(0, 200), /if \(!ownsId\(owner, id\)\)/, `${fn} checks the guest's own ids`);
  }
  assert.match(service, /const ownScope = \(owner: Owner\) => \(\{ userId: owner\.id, \.\.\.\(owner\.requestIds \? \{ id: \{ in: owner\.requestIds \} \} : \{\}\) \}\)/);
  const guest = readFileSync("src/features/smart-request/guest.ts", "utf8");
  assert.match(guest, /httpOnly: true/);
  assert.match(guest, /status: "suspended"/);
});
