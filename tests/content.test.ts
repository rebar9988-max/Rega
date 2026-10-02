import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMAS, isLive, isUpcoming, listingJsonLd, listingSlugBase, readTranslations, translationsOk } from "../src/features/content/pure";
import { CONTENT, CONTENT_SECTIONS } from "../src/features/content/config";
import { SECTIONS } from "../src/config/sections";

test("translations: one entry per language that has a title; empty languages are dropped", () => {
  const tr = readTranslations({ titleDe: "Koch gesucht", summaryDe: "Kurz", bodyDe: "Text", titleCkb: "", titleEn: "Cook wanted", bodyEn: "" });
  assert.deepEqual(tr.map((t) => t.locale), ["de", "en"]);
  assert.equal(tr[0].summary, "Kurz");
  assert.equal(tr[1].body, undefined);
  assert.deepEqual(readTranslations({}), []);
});

test("a guide needs a body in every language it has; jobs and events only need a title", () => {
  assert.ok(translationsOk("jobs", [{ title: "x" }]));
  assert.ok(!translationsOk("jobs", []));
  assert.ok(!translationsOk("guides", [{ title: "x" }]));
  assert.ok(translationsOk("guides", [{ title: "x", body: "y" }]));
});

test("job input: needs a way to apply; employment type and optional closing date are validated", () => {
  assert.ok(!SCHEMAS.jobs.safeParse({ employmentType: "full_time" }).success);
  assert.ok(SCHEMAS.jobs.safeParse({ applyEmail: "jobs@example.org" }).success);
  assert.ok(SCHEMAS.jobs.safeParse({ applyUrl: "https://example.org/jobs/1" }).success);
  assert.ok(!SCHEMAS.jobs.safeParse({ applyUrl: "javascript:alert(1)" }).success);
  assert.ok(!SCHEMAS.jobs.safeParse({ applyEmail: "jobs@example.org", employmentType: "slave" }).success);
  assert.ok(!SCHEMAS.jobs.safeParse({ applyEmail: "jobs@example.org", expiresAt: "not a date" }).success);
});

test("event input: start date required, end not before start", () => {
  assert.ok(!SCHEMAS.events.safeParse({}).success);
  assert.ok(SCHEMAS.events.safeParse({ startsAt: "2027-03-21T18:00" }).success);
  assert.ok(!SCHEMAS.events.safeParse({ startsAt: "2027-03-21T18:00", endsAt: "2027-03-20T18:00" }).success);
});

test("slugs: transliterated, safe, bounded", () => {
  assert.equal(listingSlugBase({ de: "Köchin / Koch (m/w/d) in Köln" }), "kochin-koch-mwd-in-koln");
  assert.equal(listingSlugBase({ de: "Straßenfest" }), "strassenfest");
  assert.equal(listingSlugBase({ ckb: "ڕێکەوتن" }), "entry"); // nothing Latin: caller adds a unique suffix
  assert.ok(listingSlugBase({ en: "x".repeat(200) }).length <= 60);
});

test("visibility: only published; jobs disappear after their closing date; events stay (the list decides upcoming vs past)", () => {
  const now = new Date("2027-01-10T12:00:00Z");
  assert.ok(isLive({ status: "published" }, "jobs", now));
  assert.ok(!isLive({ status: "pending" }, "jobs", now));
  assert.ok(!isLive({ status: "published", expiresAt: new Date("2027-01-09T00:00:00Z") }, "jobs", now));
  assert.ok(isLive({ status: "published", expiresAt: new Date("2027-01-11T00:00:00Z") }, "jobs", now));
  assert.ok(isLive({ status: "published" }, "events", now));
  assert.ok(isUpcoming({ startsAt: new Date("2027-01-12T00:00:00Z") }, now));
  assert.ok(!isUpcoming({ startsAt: new Date("2027-01-01T00:00:00Z"), endsAt: new Date("2027-01-02T00:00:00Z") }, now));
  assert.ok(isUpcoming({ startsAt: new Date("2027-01-01T00:00:00Z"), endsAt: new Date("2027-01-31T00:00:00Z") }, now)); // multi-day, still running
});

test("a job shown 'until a day' stays visible through that whole day", () => {
  const parsed = SCHEMAS.jobs.parse({ applyEmail: "jobs@example.org", expiresAt: "2027-02-01" });
  assert.equal(parsed.expiresAt?.toISOString(), "2027-02-01T23:59:59.000Z");
  assert.ok(isLive({ status: "published", expiresAt: parsed.expiresAt }, "jobs", new Date("2027-02-01T12:00:00Z")));
  assert.ok(!isLive({ status: "published", expiresAt: parsed.expiresAt }, "jobs", new Date("2027-02-02T00:00:01Z")));
});

test("structured data: JobPosting, Event and Article carry only stored facts", () => {
  const base = { url: "https://www.regaplatform.com/de/jobs/koch", title: "Koch", inLanguage: "de-DE", city: "Köln", countryCode: "DE" };
  const job = listingJsonLd({ ...base, section: "jobs", business: { name: "Zagros" }, datePublished: new Date("2027-01-01T00:00:00Z"), job: { employmentType: "part_time", expiresAt: new Date("2027-02-01T00:00:00Z") } }) as Record<string, unknown>;
  assert.equal(job["@type"], "JobPosting");
  assert.equal(job.employmentType, "PART_TIME");
  assert.deepEqual(job.hiringOrganization, { "@type": "Organization", name: "Zagros" });
  assert.equal(job.validThrough, "2027-02-01T00:00:00.000Z");
  const ev = listingJsonLd({ ...base, section: "events", title: "Newroz", event: { startsAt: new Date("2027-03-21T18:00:00Z"), venue: "Stadthalle" } }) as Record<string, unknown>;
  assert.equal(ev["@type"], "Event");
  assert.equal(ev.startDate, "2027-03-21T18:00");
  assert.ok(!("endDate" in ev));
  assert.equal((ev.location as { name: string }).name, "Stadthalle");
  const art = listingJsonLd({ ...base, section: "guides", title: "Anmeldung" }) as Record<string, unknown>;
  assert.equal(art["@type"], "Article");
  assert.ok(!("author" in art) && !("datePublished" in art), "nothing is invented");
});

test("every content section has a configuration and a registry entry flagged as content", () => {
  for (const key of CONTENT_SECTIONS) {
    assert.ok(CONTENT[key], key);
    const entry = SECTIONS.find((s) => s.key === key);
    assert.ok(entry, `${key} in the section registry`);
    assert.equal((entry as { content?: boolean }).content, true, `${key} is flagged content`);
  }
  assert.deepEqual(SECTIONS.filter((s) => (s as { content?: boolean }).content).map((s) => s.key).sort(), [...CONTENT_SECTIONS].sort());
});
