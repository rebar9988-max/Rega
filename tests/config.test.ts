import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SECTIONS, enabledSections, footerSections, sectionEnabled, sectionsFor, type SectionDef } from "../src/config/sections";
import { LOCALES, LOCALE_META, fallbackChain } from "../src/config/locales";
import { ownerDetails, placeholderOf } from "../src/config/owner";
import { RETRIEVER_KEYS } from "../src/lib/search/retriever-keys";

test("registry: disabled sections are invisible everywhere", () => {
  const off = { SECTIONS_DISABLED: "jobs,events,guides" };
  const keys = enabledSections(off).map((s) => s.key);
  assert.ok(!keys.includes("jobs") && !keys.includes("events") && !keys.includes("guides"));
  for (const surface of ["header", "mobile", "sitemap", "assistant"] as const) assert.ok(!sectionsFor(surface, off).some((s) => ["jobs", "events", "guides"].includes(s.key)), surface);
  assert.ok(!footerSections("explore", off).some((s) => s.key === "jobs"));
  assert.ok(!sectionEnabled("events", off));
  // Approved public defaults keep jobs/events hidden while guides remain available.
  for (const key of ["jobs", "events"]) assert.ok(!sectionEnabled(key, {}), key);
  assert.ok(sectionEnabled("guides", {}));
  for (const surface of ["header", "mobile", "sitemap", "search", "assistant"] as const) {
    assert.ok(!sectionsFor(surface, {}).some((s) => ["jobs", "events"].includes(s.key)), `${surface} defaults`);
  }
  assert.ok(!footerSections("explore", {}).some((s) => ["jobs", "events"].includes(s.key)), "footer defaults");
});

test("registry: a section added to the registry shows up in nav, footer and sitemap with no other edits (dummy section)", () => {
  const dummy: SectionDef = { key: "dummy", path: "/dummy", order: 55, enabled: true, header: true, mobile: true, footer: "explore", sitemap: true, search: true, assistant: true };
  const defs = [...SECTIONS, dummy];
  for (const surface of ["header", "mobile", "sitemap", "search", "assistant"] as const) assert.ok(sectionsFor(surface, {}, defs).some((s) => s.key === "dummy"), surface);
  assert.ok(footerSections("explore", {}, defs).some((s) => s.key === "dummy"));
  assert.ok(!sectionsFor("header", {}).some((s) => s.key === "dummy"), "and it is gone again when removed");
});

test("registry: environment switches sections without code changes; DISABLED wins", () => {
  assert.ok(sectionEnabled("jobs", { SECTIONS_ENABLED: "jobs" }));
  assert.ok(!sectionEnabled("jobs", { SECTIONS_DISABLED: "jobs" }));
  assert.ok(!sectionEnabled("nearby", { SECTIONS_DISABLED: "nearby" }));
  assert.ok(!sectionEnabled("jobs", { SECTIONS_ENABLED: "jobs", SECTIONS_DISABLED: "jobs" }));
});

test("registry: orders and keys are unique", () => {
  assert.equal(new Set(SECTIONS.map((s) => s.key)).size, SECTIONS.length);
  assert.equal(new Set(SECTIONS.map((s) => s.order)).size, SECTIONS.length);
});

test("every section has a nav label in every locale", () => {
  for (const l of LOCALES) {
    const nav = JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8")).nav;
    for (const s of SECTIONS) assert.ok(nav[s.labelKey ?? s.key], `nav.${s.labelKey ?? s.key} missing in ${l}`);
  }
});

test("locales: one source; fallback chains never include the locale itself and cover the others", () => {
  for (const l of LOCALES) {
    const chain = fallbackChain(l);
    assert.ok(!chain.includes(l));
    assert.deepEqual([...chain].sort(), LOCALES.filter((x) => x !== l).sort(), `fallbacks of ${l}`);
    assert.ok(LOCALE_META[l].dir === "rtl" || LOCALE_META[l].dir === "ltr");
  }
});

test("no source file outside config/ and messages/ hard-codes the locale list", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (f !== "messages" && f !== "config") walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const text = readFileSync(p, "utf8");
      if (/["']ckb["']\s*,\s*["']kmr["']\s*,\s*["']de["']/.test(text)) offenders.push(p);
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});

test("owner details: empty required fields become visible placeholders and are reported; optional ones stay empty", () => {
  const o = ownerDetails({});
  assert.equal(o.legalName, "[[LEGAL_NAME]]");
  assert.equal(placeholderOf("streetAddress"), "[[LEGAL_STREET_ADDRESS]]");
  assert.ok(o.missing.includes("legalName") && o.missing.includes("streetAddress") && o.missing.includes("aiProvider"));
  assert.equal(o.vatId, "");
  assert.ok(!o.missing.includes("vatId"));
  assert.equal(ownerDetails({ LEGAL_NAME: "Max Mustermann" }).legalName, "Max Mustermann");
});

test(".env.example documents every variable of the environment schema", () => {
  const schema = readFileSync("src/lib/env.ts", "utf8");
  const names = [...schema.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):\s*z\./gm)].map((m) => m[1]);
  const example = readFileSync(".env.example", "utf8");
  const optionalInternal = new Set(["NODE_ENV", "APP_ENV", "STORAGE_REGION", "LOG_LEVEL", "GEMINI_BASE_URL", "OPENAI_BASE_URL", "GROQ_BASE_URL", "DEEPSEEK_BASE_URL", "OPENROUTER_BASE_URL", "ANTHROPIC_BASE_URL", "GEOCODING_TIMEOUT_MS"]);
  const missing = names.filter((n) => !optionalInternal.has(n) && !new RegExp(`^#?\\s*${n}=`, "m").test(example));
  assert.deepEqual(missing, []);
});

test("every enabled section flagged for the assistant has a retriever (so REGA Assistant and search include it automatically)", () => {
  const has = (key: string) => (RETRIEVER_KEYS as readonly string[]).includes(key);
  assert.deepEqual(SECTIONS.filter((s) => s.assistant && s.enabled && !has(s.key)).map((s) => s.key), []);
  // A section registered later without a retriever is reported until its retriever exists.
  const dummy: SectionDef = { key: "dummy", path: "/dummy", order: 55, enabled: true, assistant: true };
  assert.deepEqual(enabledSections({}, [...SECTIONS, dummy]).filter((s) => s.assistant && !has(s.key)).map((s) => s.key), ["dummy"]);
});
