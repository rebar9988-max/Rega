import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  ACCESS_TIERS, APPROVAL_GATES, COMMON_FORBIDDEN, ENGINEERING_AGENTS, ENGINEERING_AGENT_IDS, ENGINEERING_LIMITS, ROUTES,
  TIER_TOOLS, globToRegExp, parseProfile, profilePath, registryProblems, routeChange,
} from "../src/lib/ops/engineering";
import { AGENT_IDS } from "../src/lib/ops/types";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const diskProfiles = () =>
  Object.fromEntries(ENGINEERING_AGENTS.map((a) => [profilePath(a.id), existsSync(new URL(profilePath(a.id), root)) ? read(profilePath(a.id)) : undefined]));

test("registry: ten engineering agents, every profile on disk matches its tier, every reused inspector exists", () => {
  assert.equal(ENGINEERING_AGENT_IDS.length, 10);
  assert.deepEqual(registryProblems(diskProfiles(), AGENT_IDS), []);
});

test("registry: the Digital Operations Inspector reuses all ten runtime inspectors instead of re-implementing them", () => {
  const inspector = ENGINEERING_AGENTS.find((a) => a.id === "inspector")!;
  assert.deepEqual([...inspector.uses].sort(), [...AGENT_IDS].sort());
});

test("permissions: read-only tiers cannot edit, write or run commands; no profile can start another agent", () => {
  for (const tier of ["read", "propose"] as const) for (const tool of ["Edit", "Write", "Bash", "NotebookEdit"]) assert.ok(!TIER_TOOLS[tier].includes(tool), `${tier} has ${tool}`);
  for (const tier of ACCESS_TIERS) for (const tool of ["Agent", "Task"]) assert.ok(!TIER_TOOLS[tier].includes(tool));
  assert.ok(COMMON_FORBIDDEN.some((f) => /merge to main or deploy/.test(f)));
  assert.ok(COMMON_FORBIDDEN.some((f) => /R&L/.test(f)));
  assert.ok(COMMON_FORBIDDEN.some((f) => /€0/.test(f)));
  // The plan's access column: orchestrator, security, localization and inspector read; UI/UX proposes.
  const tier = Object.fromEntries(ENGINEERING_AGENTS.map((a) => [a.id, a.tier]));
  assert.deepEqual([tier.orchestrator, tier.security, tier.localization, tier.inspector, tier["ui-ux"]], ["read", "read", "read", "read", "propose"]);
});

test("permissions: tampering with a profile or the registry is detected", () => {
  const profiles = diskProfiles();
  const sec = profilePath("security");
  const widened = { ...profiles, [sec]: profiles[sec]!.replace("tools: Read, Grep, Glob", "tools: Read, Grep, Glob, Edit, Bash") };
  assert.ok(registryProblems(widened, AGENT_IDS).some((p) => p.startsWith("security: profile tools")));
  assert.ok(registryProblems({ ...profiles, [sec]: undefined }, AGENT_IDS).some((p) => p.includes("missing")));
  assert.ok(registryProblems(profiles, AGENT_IDS.filter((id) => id !== "security-inspector")).some((p) => p.includes("unknown inspector security-inspector")));
  assert.equal(parseProfile("no front matter").name, null);
});

test("routing: picks the minimum agents for a change, never all ten", () => {
  assert.deepEqual(routeChange(["src/app/dr/geography/page.tsx"]).agents, ["orchestrator", "ui-ux", "fullstack", "qa"]);
  assert.deepEqual(routeChange(["tests/geo.test.ts"]).agents, ["orchestrator", "qa"]);
  assert.deepEqual(routeChange(["src/messages/ckb.json"]).agents, ["orchestrator", "qa", "localization"]);
  assert.deepEqual(routeChange(["prisma/schema.prisma"]).agents, ["orchestrator", "database", "qa"]);
  assert.deepEqual(routeChange(["src/lib/rbac.ts"]).agents, ["orchestrator", "fullstack", "security", "qa"]);
  assert.deepEqual(routeChange(["src/lib/ops/core.ts"]).agents, ["orchestrator", "fullstack", "qa", "inspector"]);
  const docs = routeChange(["README.md", "docs/DEPLOYMENT.md"]);
  assert.deepEqual(docs.agents, ["orchestrator"]);
  assert.equal(docs.docsOnly, true);
  assert.equal(routeChange([]).docsOnly, false);
  for (const id of ENGINEERING_AGENT_IDS) assert.ok(id === "orchestrator" || ROUTES.some((r) => r.agent === id), `${id} unreachable`);
});

test("routing: duplicate paths count once, the input is bounded, oversized changes are flagged", () => {
  const plan = routeChange(["src/lib/rbac.ts", "./src/lib/rbac.ts", " src/lib/rbac.ts ", ""]);
  assert.equal(plan.inspected, 1);
  assert.equal(plan.approvals.length, 1);
  assert.equal(new Set(plan.agents).size, plan.agents.length);
  const many = Array.from({ length: ENGINEERING_LIMITS.maxPaths + 5 }, (_, i) => `docs/f${i}.md`);
  const bounded = routeChange(many);
  assert.equal(bounded.inspected, ENGINEERING_LIMITS.maxPaths);
  assert.equal(bounded.truncated, true);
  assert.equal(routeChange(["src/app/dr/geography/page.tsx"]).oversized, false);
  assert.equal(routeChange(["prisma/schema.prisma", "src/lib/rbac.ts", "src/messages/ckb.json", ".github/workflows/ci.yml", "src/lib/ops/core.ts"]).oversized, true);
});

test("approval gates: schema, auth/RBAC, CI/deploy, brand, AI cost policy, dependencies and rules need the owner", () => {
  const gated = ["prisma/migrations/0001_x/migration.sql", "src/lib/rbac.ts", ".github/workflows/deploy.yml", "public/brand/logo.svg", "src/app/globals.css", "src/lib/ai/routing.ts", "package.json", "CLAUDE.md"];
  for (const path of gated) assert.equal(routeChange([path]).approvals.length, 1, path);
  assert.equal(routeChange(["src/app/dr/geography/page.tsx", "tests/geo.test.ts"]).approvals.length, 0);
  assert.equal(new Set(APPROVAL_GATES.map((g) => g.reasonCkb)).size, APPROVAL_GATES.length);
});

test("glob: ** spans folders and may be empty, * stays inside one folder", () => {
  assert.ok(globToRegExp("**/*.md").test("README.md"));
  assert.ok(globToRegExp("**/*.md").test("docs/a/b.md"));
  assert.ok(globToRegExp("docs/**").test("docs/a/b.txt"));
  assert.ok(globToRegExp("src/app/**/*.tsx").test("src/app/page.tsx"));
  assert.ok(!globToRegExp("public/*.png").test("public/brand/logo.png"));
  assert.ok(!globToRegExp("src/**/*.ts").test("src/app/page.tsx"));
  assert.ok(!globToRegExp("src/lib/rbac.ts").test("src/lib/rbacXts"));
});

test("hybrid: routing is deterministic and independent of any AI provider or network", () => {
  for (const file of ["src/lib/ops/engineering.ts", "scripts/agent-audit.mjs"]) {
    const src = read(file);
    assert.ok(!/(?:from\s+|import\s*\(\s*)["'][^"']*lib\/ai(?:\/|["'])/.test(src), `${file} imports the AI gateway`);
    assert.ok(!/\bfetch\(|node:https?\b|process\.env\.(AI_|GEMINI|GROQ|OPENROUTER)/.test(src), `${file} reaches the network or an AI key`);
  }
  const input = ["src/lib/rbac.ts", "tests/a.test.ts"];
  assert.deepEqual(routeChange(input), routeChange(input));
  assert.deepEqual(routeChange(input).agents, routeChange([...input].reverse()).agents);
});

test("workflow: read-only, no secrets, bounded, deduplicated, free runner, guard first", () => {
  const wf = read(".github/workflows/rega24-agent-audit.yml");
  assert.match(wf, /^permissions:\n {2}contents: read\n/m);
  assert.ok(!/:\s*write\b/.test(wf), "no write permission");
  assert.ok(!/secrets\./.test(wf), "no secrets");
  assert.ok(!/pull_request_target/.test(wf), "no privileged PR trigger");
  assert.ok(!/continue-on-error/.test(wf));
  assert.match(wf, new RegExp(`timeout-minutes: ${ENGINEERING_LIMITS.workflowTimeoutMinutes}\\n`));
  assert.match(wf, /concurrency:\n {2}group: agent-audit-[^\n]+\n {2}cancel-in-progress: true/);
  assert.match(wf, /runs-on: ubuntu-24\.04/);
  assert.ok(!/wrangler|deploy\.yml|gh pr merge|\/merge/.test(wf.replace(/^#.*$/gm, "")), "never deploys or merges");
  assert.ok(wf.indexOf("project-identity-guard.mjs --project REGA") < wf.indexOf("scripts/agent-audit.mjs"), "identity guard runs first");
});

test("audit log: the router prints one structured result under plain Node (no dependencies)", () => {
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/agent-audit.mjs", "--files", "src/lib/rbac.ts"], { cwd: new URL(".", root), encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
  const result = JSON.parse(out.trim().split("\n").pop()!);
  assert.equal(result.status, "PASS");
  assert.equal(result.mode, "route");
  assert.ok(result.task_id);
  assert.deepEqual(result.agents, ["orchestrator", "fullstack", "security", "qa"]);
  assert.equal(result.approvals[0].path, "src/lib/rbac.ts");
  assert.ok(result.evidence.length > 0);
});

test("dashboard: the engineering registry is shown on the owner-only /dr/operations page, Sorani text marked RTL", () => {
  const page = read("src/app/dr/operations/page.tsx");
  assert.match(page, /requireDr\("operations\.manage"\)/);
  assert.match(page, /ENGINEERING_AGENTS/);
  assert.match(page, /lang="ckb" dir="rtl"[^>]*>\{a\.roleCkb\}/);
});

test("docs: the single AI agent inventory lists every engineering agent and the workflow", () => {
  const doc = read("docs/AI_AGENT_SYSTEM.md");
  for (const id of ENGINEERING_AGENT_IDS) assert.ok(doc.includes(`\`rega24-${id}\``), `rega24-${id} missing from docs/AI_AGENT_SYSTEM.md`);
  assert.ok(doc.includes("rega24-agent-audit.yml"));
  assert.ok(read("REGA24_SYSTEM_MAP.md").includes("rega24-agent-audit.yml"));
});
