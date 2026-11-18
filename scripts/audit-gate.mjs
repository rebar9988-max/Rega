#!/usr/bin/env node
// npm audit gate with an explicit, owner-approved exception list (npm audit itself has no ignore option).
// Usage: node scripts/audit-gate.mjs --level low|moderate|high|critical [--omit-dev]
// Fails on every vulnerability at or above the level, unless every advisory it leads to is listed below.
import { execFileSync } from "node:child_process";

/** Owner approval 2026-11-18: no patched picomatch release exists (all versions affected). Remove once fixed upstream. */
export const ALLOWED_ADVISORIES = new Set(["GHSA-fc5q-39xc-vjpf"]);

const ORDER = ["info", "low", "moderate", "high", "critical"];
const args = process.argv.slice(2);
const level = args[args.indexOf("--level") + 1] ?? "low";
if (!args.includes("--level") || !ORDER.includes(level)) { console.error("usage: audit-gate.mjs --level <low|moderate|high|critical> [--omit-dev]"); process.exit(2); }

let raw;
try {
  raw = execFileSync("npm", ["audit", "--json", ...(args.includes("--omit-dev") ? ["--omit=dev"] : [])], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  raw = error.stdout; // npm audit exits 1 when it finds anything
}
const report = JSON.parse(raw);
if (report.error) { console.error("npm audit failed:", report.error); process.exit(1); }
const vulns = report.vulnerabilities ?? {};

const ghsa = (url = "") => url.match(/GHSA-[\w-]+/)?.[0] ?? url;
const memo = new Map();
/** True when every advisory reachable from this package is on the allow list. */
function onlyAllowed(name, seen = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (seen.has(name)) return true;
  seen.add(name);
  const v = vulns[name];
  const ok = Boolean(v) && v.via.every((via) => (typeof via === "string" ? onlyAllowed(via, seen) : ALLOWED_ADVISORIES.has(ghsa(via.url))));
  memo.set(name, ok);
  return ok;
}

const min = ORDER.indexOf(level);
const failing = Object.values(vulns).filter((v) => ORDER.indexOf(v.severity) >= min && !onlyAllowed(v.name));
const excepted = Object.values(vulns).filter((v) => ORDER.indexOf(v.severity) >= min && onlyAllowed(v.name));

if (excepted.length) console.log(`Excepted (owner-approved, no upstream fix): ${excepted.map((v) => v.name).join(", ")}`);
if (failing.length) {
  console.error(`npm audit gate FAILED at level ${level}:`);
  for (const v of failing) console.error(`  ${v.name} (${v.severity}) via ${v.via.map((x) => (typeof x === "string" ? x : ghsa(x.url))).join(", ")}`);
  process.exit(1);
}
console.log(`npm audit gate passed at level ${level}${args.includes("--omit-dev") ? " (production dependencies)" : ""}.`);
