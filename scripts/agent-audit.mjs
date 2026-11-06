#!/usr/bin/env node
// REGA24 AI Operations Center — deterministic agent router and registry check. Read-only, no dependencies, no AI,
// no network, no secrets. Runs in the `rega24-agent-audit.yml` workflow and locally:
//
//   node --experimental-strip-types scripts/agent-audit.mjs                 # registry check only
//   node --experimental-strip-types scripts/agent-audit.mjs --base <sha>    # + route the change <sha>...HEAD
//   node --experimental-strip-types scripts/agent-audit.mjs --files a b c   # + route these paths
//
// The registry and routing rules live in src/lib/ops/engineering.ts (read through Node's type stripping, so this file
// adds no logic of its own). Exit 1 only when the registry or a profile is broken; approval gates are reported, never
// enforced here: the owner decides at merge time.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINEERING_AGENTS, ENGINEERING_LIMITS, TIER_LABEL_CKB, profilePath, registryProblems, routeChange } from "../src/lib/ops/engineering.ts";
import { AGENT_IDS } from "../src/lib/ops/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const profiles = Object.fromEntries(
  ENGINEERING_AGENTS.map((a) => {
    const path = profilePath(a.id);
    return [path, existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : undefined];
  }),
);
const problems = registryProblems(profiles, AGENT_IDS);

/** Changed paths: explicit --files, or the diff against --base / BASE_SHA. Neither = registry check only. */
function changedPaths() {
  const i = args.indexOf("--files");
  if (i >= 0) return args.slice(i + 1).filter((a) => !a.startsWith("--"));
  const base = argValue("--base") || process.env.BASE_SHA;
  if (!base) return null;
  if (!/^[0-9a-f]{7,40}$/i.test(base)) throw new Error(`invalid base revision: ${base}`);
  const out = execFileSync("git", ["diff", "--name-only", "--no-renames", `${base}...HEAD`], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return out.split("\n").filter(Boolean);
}

const paths = changedPaths();
const plan = paths ? routeChange(paths) : null;
const byId = new Map(ENGINEERING_AGENTS.map((a) => [a.id, a]));
const result = {
  task_id: process.env.GITHUB_RUN_ID ? `gh-${process.env.GITHUB_RUN_ID}` : "local",
  mode: plan ? "route" : "registry",
  status: problems.length ? "FAIL" : "PASS",
  agents: plan?.agents ?? [],
  approvals: plan?.approvals ?? [],
  docs_only: plan?.docsOnly ?? null,
  oversized: plan?.oversized ?? false,
  inspected_paths: plan?.inspected ?? 0,
  truncated: plan?.truncated ?? false,
  problems,
  evidence: [`registry: ${ENGINEERING_AGENTS.length} engineering agents, ${AGENT_IDS.length} runtime inspectors`, `profiles: .claude/agents/rega24-*.md`, `limits: ${JSON.stringify(ENGINEERING_LIMITS)}`],
};

console.log(JSON.stringify(result));

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `## REGA24 agent audit — ${result.status}`,
    "",
    `Mode: \`${result.mode}\` · task \`${result.task_id}\` · no AI, no secrets, read-only`,
    "",
  ];
  if (plan) {
    lines.push(`### Agents for this change (${plan.agents.length}/10)`, "", "| # | Agent | Access |", "| --- | --- | --- |");
    for (const id of plan.agents) {
      const a = byId.get(id);
      lines.push(`| ${a.number} | ${a.name} (\`${a.id}\`) | ${TIER_LABEL_CKB[a.tier]} |`);
    }
    lines.push("", plan.docsOnly ? "Documentation only: no specialist verification needed." : "", "");
    if (plan.approvals.length) {
      lines.push(`### Owner approval needed before merge (${plan.approvals.length})`, "", "| Path | Reason |", "| --- | --- |");
      for (const g of plan.approvals.slice(0, 100)) lines.push(`| \`${g.path}\` | ${g.reasonCkb} |`);
      lines.push("");
    } else lines.push("No path needs owner approval.", "");
    if (plan.oversized) lines.push(`More than ${ENGINEERING_LIMITS.maxSpecialistsPerTask} specialists: consider splitting this change into smaller pull requests.`, "");
    if (plan.truncated) lines.push(`Only the first ${plan.inspected} paths were routed.`, "");
  }
  if (problems.length) lines.push("### Registry problems", "", ...problems.map((p) => `- ${p}`), "");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

process.exit(problems.length ? 1 : 0);
