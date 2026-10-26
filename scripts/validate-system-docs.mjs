#!/usr/bin/env node
/**
 * Lightweight documentation check. No network, no secrets, no deploy.
 * Usage: node scripts/validate-system-docs.mjs
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const generated = spawnSync(process.execPath, ["scripts/generate-system-inventory.mjs", "--check"], {
  cwd: root,
  encoding: "utf8",
});
if (generated.status !== 0) fail((generated.stderr || generated.stdout || "inventory check failed").trim());

const docs = ["REGA24_SYSTEM_MAP.md", "REGA24_TROUBLESHOOTING.md", "AGENTS.md", "CLAUDE.md"];
for (const path of docs) {
  if (!existsSync(join(root, path))) fail(`missing ${path}`);
}

const map = read("REGA24_SYSTEM_MAP.md");
const trouble = read("REGA24_TROUBLESHOOTING.md");
const agents = read("AGENTS.md");
const deploy = read(".github/workflows/deploy.yml");
const ci = read(".github/workflows/ci.yml");

const mapHeadings = [
  "Official Rega24 project identity",
  "Architecture",
  "Service inventory and ownership",
  "Source-code folder mapping",
  "Service dependencies",
  "Database and storage",
  "Production domains and routing",
  "Environment variable names and locations",
  "Deployment pipeline",
  "Monitoring and debugging entry points",
  "Known technical risks and blockers",
  "Last verification",
];
for (const heading of mapHeadings) {
  if (!map.includes(`## ${heading}`) && !map.includes(`# ${heading}`)) fail(`system map missing heading: ${heading}`);
}

const issues = [
  "Website downtime",
  "HTTP 4xx and 5xx",
  "Cloudflare deployment failures",
  "Neon and database connection failures",
  "AI service errors",
  "Authentication and OTP failures",
  "Missing media and R2 errors",
  "DNS and SSL",
  "Performance problems",
  "CI/CD failures",
];
const labels = ["SYMPTOM", "LOCATION", "DIAGNOSTIC STEPS", "SAFE FIX", "VERIFICATION", "ROLLBACK"];
for (const issue of issues) {
  if (!trouble.includes(`## ${issue}`)) fail(`troubleshooting missing section: ${issue}`);
}
for (const label of labels) {
  const count = trouble.split(`**${label}**`).length - 1;
  if (count < issues.length) fail(`${label} appears ${count} times, expected at least ${issues.length}`);
}

const agentRules = [
  "REGA24_SYSTEM_MAP.md",
  "REGA24_TROUBLESHOOTING.md",
  "Never invent system information",
  "Never store credentials",
];
for (const rule of agentRules) {
  if (!agents.includes(rule)) fail(`AGENTS.md missing: ${rule}`);
}

if (!deploy.includes("DOCS_ONLY_SKIP")) fail("deploy.yml is missing the DOCS_ONLY_SKIP guard");
if (!ci.includes("scripts/validate-system-docs.mjs")) fail("ci.yml does not run the documentation validator");

const allowlistMarkers = [
  "*.md",
  "docs/*",
  "scripts/generate-system-inventory.mjs",
  "scripts/validate-system-docs.mjs",
  ".github/workflows/deploy.yml",
  ".github/workflows/ci.yml",
];
for (const marker of allowlistMarkers) {
  if (!deploy.includes(marker)) fail(`deploy.yml docs-only allowlist missing ${marker}`);
}

function checkLinks(path, text) {
  const re = /\[[^\]]+\]\(([^)\s]+)\)/g;
  for (const match of text.matchAll(re)) {
    const raw = match[1];
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    const noAnchor = raw.split("#")[0];
    if (!noAnchor) continue;
    const decoded = decodeURIComponent(noAnchor);
    const target = normalize(join(root, dirname(path), decoded));
    if (!target.startsWith(root)) {
      fail(`${path} link escapes the repository: ${raw}`);
      continue;
    }
    if (!existsSync(target)) fail(`${path} broken link: ${raw}`);
    else if (statSync(target).isDirectory()) fail(`${path} link points at a directory: ${raw}`);
  }
}

for (const path of ["REGA24_SYSTEM_MAP.md", "REGA24_TROUBLESHOOTING.md", "AGENTS.md"]) {
  checkLinks(path, read(path));
}

const secretText = [map, trouble, read("docs/generated/system-inventory.json")].join("\n");
const secretPatterns = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
  [/sk-[A-Za-z0-9_-]{20,}/, "API key"],
  [/postgres(?:ql)?:\/\/[^:\s]+:(?!password(?:@|$))[^\s@]+@/i, "database URL with a password"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
];
for (const [pattern, label] of secretPatterns) {
  if (pattern.test(secretText)) fail(`possible ${label} in documentation`);
}

if (errors.length) {
  console.error(`documentation validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("documentation validation passed");
