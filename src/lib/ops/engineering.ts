/**
 * REGA24 AI Operations Center — the ten ENGINEERING agents (code work), next to the ten runtime inspectors in
 * `./types.ts`. These are role profiles for owner-run Claude Code / Codex sessions on this repository
 * (`.claude/agents/rega24-<id>.md`) plus a deterministic router for repository changes
 * (`scripts/agent-audit.mjs`, workflow `rega24-agent-audit.yml`). Nothing here runs in the Worker, calls an AI model,
 * merges, deploys or changes configuration.
 *
 * Pure module without runtime imports: the /dr/operations page, unit tests and `scripts/agent-audit.mjs` (plain Node
 * with type stripping) all read it. Keep to erasable TypeScript syntax (no enums, namespaces or parameter properties).
 */
import type { AgentId } from "./types";

export const ENGINEERING_AGENT_IDS = [
  "orchestrator",
  "ui-ux",
  "fullstack",
  "database",
  "security",
  "qa",
  "devops",
  "performance",
  "localization",
  "inspector",
] as const;
export type EngineeringAgentId = (typeof ENGINEERING_AGENT_IDS)[number];

/**
 * read = inspects and reports · propose = also drafts a change for the owner, edits nothing ·
 * branch = edits on a feature branch and opens a pull request · workflow = branch, plus may start an EXISTING
 * authorized GitHub workflow. No tier merges to `main`, deploys, or changes secrets.
 */
export const ACCESS_TIERS = ["read", "propose", "branch", "workflow"] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

/** Claude Code tools per tier. Read-only tiers get no Edit, Write or Bash, so the limit is enforced by the tool. */
export const TIER_TOOLS: Readonly<Record<AccessTier, readonly string[]>> = Object.freeze({
  read: ["Read", "Grep", "Glob"],
  propose: ["Read", "Grep", "Glob", "WebFetch"],
  branch: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
  workflow: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
});

export const TIER_LABEL_CKB: Readonly<Record<AccessTier, string>> = Object.freeze({
  read: "تەنها خوێندنەوە",
  propose: "پێشنیار، بێ دەستکاری",
  branch: "Branch و PR",
  workflow: "Branch، PR و workflowی ڕێپێدراو",
});

/** Forbidden for every engineering agent (CLAUDE.md sections 0, 5, 7, 8 stay the full rule set). */
export const COMMON_FORBIDDEN = Object.freeze([
  "merge to main or deploy to production",
  "bypass CI, branch protection or the project identity guard",
  "delete or modify production data",
  "read, print, commit or change secrets",
  "activate any paid service, model, plan or billing (€0)",
  "touch R&L (rebar9988-max/rega-cargo, rlgo.net)",
  "start another agent (no recursive agent loops)",
] as const);

export type EngineeringAgent = {
  id: EngineeringAgentId;
  number: string;
  /** English name (code, logs, profile files). */
  name: string;
  /** Owner-facing name and responsibility, Kurdish Sorani. */
  nameCkb: string;
  roleCkb: string;
  tier: AccessTier;
  /** Runtime inspectors (./types.ts) this role reads instead of re-implementing them. */
  uses: readonly AgentId[];
  /** Forbidden on top of COMMON_FORBIDDEN. */
  forbidden: readonly string[];
  /** Checks that must pass before the agent reports PASS. */
  validation: readonly string[];
};

const CODE_CHECKS = ["node scripts/project-identity-guard.mjs --project REGA", "npm run lint", "npm run typecheck", "npm test"] as const;

export const ENGINEERING_AGENTS: readonly EngineeringAgent[] = Object.freeze([
  {
    id: "orchestrator", number: "01", name: "Master Orchestrator", tier: "read",
    nameCkb: "ڕێکخەری سەرەکی", roleCkb: "دابەشکردنی ئەرک و کۆکردنەوەی ئەنجام",
    uses: [], forbidden: ["edit files", "run every agent for every task"], validation: [],
  },
  {
    id: "ui-ux", number: "02", name: "Product UI/UX Engineer", tier: "propose",
    nameCkb: "ئەندازیاری UI/UX", roleCkb: "پشکنینی دیزاین، ڕەنگ و RTL/LTR",
    uses: ["qa-automation"], forbidden: ["edit files", "change REGA24 colours, typography, logo, banner or layout identity"], validation: [],
  },
  {
    id: "fullstack", number: "03", name: "Senior Full-Stack Engineer", tier: "branch",
    nameCkb: "ئەندازیاری Full-Stack", roleCkb: "چاککردنی کۆد، API و Next.js",
    uses: ["qa-automation"], forbidden: ["change routes, architecture or auth without an owner task"], validation: [...CODE_CHECKS],
  },
  {
    id: "database", number: "04", name: "Cloudflare D1 Database Engineer", tier: "branch",
    nameCkb: "ئەندازیاری داتابەیسی D1", roleCkb: "D1، Schema و Migration — پشکنین، بێ سڕینەوە",
    uses: ["business-inspector", "category-inspector", "location-inspector"],
    forbidden: ["destructive migration (drop, truncate, delete)", "apply a migration to production"], validation: [...CODE_CHECKS, "npm run test:d1"],
  },
  {
    id: "security", number: "05", name: "Security & Access Control Engineer", tier: "read",
    nameCkb: "ئەندازیاری ئاسایش و دەستگەیشتن", roleCkb: "Auth، RBAC، Secrets و /dr",
    uses: ["security-inspector"], forbidden: ["edit files", "widen SUPER_ADMIN beyond the owner address"], validation: [],
  },
  {
    id: "qa", number: "06", name: "QA & Testing Engineer", tier: "branch",
    nameCkb: "ئەندازیاری QA و تاقیکردنەوە", roleCkb: "Unit، Integration و E2E",
    uses: ["qa-automation"], forbidden: ["weaken, skip or delete an existing test to make a check pass"], validation: [...CODE_CHECKS],
  },
  {
    id: "devops", number: "07", name: "DevOps & Cloudflare Engineer", tier: "workflow",
    nameCkb: "ئەندازیاری DevOps و Cloudflare", roleCkb: "CI/CD، GitHub و Cloudflare — چاودێری",
    uses: ["qa-automation"], forbidden: ["run wrangler deploy or a production workflow by hand", "disable a required check"], validation: [...CODE_CHECKS],
  },
  {
    id: "performance", number: "08", name: "Performance, SEO & Accessibility Engineer", tier: "branch",
    nameCkb: "ئەندازیاری خێرایی، SEO و Accessibility", roleCkb: "SEO، خێرایی و WCAG 2.2 AA — پشکنین و چاکسازی",
    uses: ["performance-inspector", "ai-discovery-inspector"], forbidden: ["change visual identity for a score"], validation: [...CODE_CHECKS],
  },
  {
    id: "localization", number: "09", name: "Localization & Content Quality Engineer", tier: "read",
    nameCkb: "ئەندازیاری زمان و ناوەڕۆک", roleCkb: "کوردی، ئەڵمانی و زمانەکانی تر — پشکنینی وەرگێڕان",
    uses: ["translation-inspector", "content-inspector"], forbidden: ["edit files"], validation: [],
  },
  {
    id: "inspector", number: "10", name: "Digital Operations Inspector", tier: "read",
    nameCkb: "پشکنەری ئۆپەراسیۆنی دیجیتاڵ", roleCkb: "کاروبار، دووبارەکان و کوالێتیی داتا — لەسەر ناوەندی ئۆپەراسیۆنی هەنووکەیی",
    uses: [
      "business-inspector", "security-inspector", "qa-automation", "performance-inspector", "category-inspector",
      "location-inspector", "translation-inspector", "content-inspector", "analytics-inspector", "ai-discovery-inspector",
    ],
    forbidden: ["edit files", "build a second inspection engine"], validation: [],
  },
] satisfies EngineeringAgent[]);

/** Public results of the routing workflow (the repository is public; nothing is fetched from the Worker). */
export const AUDIT_WORKFLOW_URL = "https://github.com/rebar9988-max/Rega/actions/workflows/rega24-agent-audit.yml";

export const profileName = (id: EngineeringAgentId) => `rega24-${id}`;
export const profilePath = (id: EngineeringAgentId) => `.claude/agents/${profileName(id)}.md`;

/** Hard bounds of the deterministic router and its workflow (tests compare the workflow file with these). */
export const ENGINEERING_LIMITS = Object.freeze({
  /** Changed paths read per routing run; more are reported as truncated, never silently dropped. */
  maxPaths: 3_000,
  /** Wall-clock limit of the routing workflow job. */
  workflowTimeoutMinutes: 5,
  /** Deterministic checks are not retried: the same input gives the same result. */
  maxRetries: 0,
  /** Specialists the orchestrator may hand one task to (it never needs all ten). */
  maxSpecialistsPerTask: 4,
});

/** Path ownership: which specialists a changed file concerns. `**` spans folders, `*` stays inside one. */
export const ROUTES: readonly { agent: EngineeringAgentId; patterns: readonly string[] }[] = Object.freeze([
  { agent: "ui-ux", patterns: ["src/app/**/*.tsx", "src/components/**", "src/app/globals.css", "public/brand/**", "public/*.png", "public/manifest.webmanifest"] },
  { agent: "fullstack", patterns: ["src/**/*.ts", "src/**/*.tsx", "services/ai-python/src/**"] },
  { agent: "database", patterns: ["prisma/**", "src/lib/db*.ts", "src/lib/d1*", "scripts/*d1*", "tests/d1/**"] },
  {
    agent: "security",
    patterns: ["src/auth.ts", "src/auth.config.ts", "src/middleware.ts", "src/lib/rbac.ts", "src/lib/auth-helpers.ts", "src/lib/dr-auth.ts", "src/lib/env.ts", "src/app/dr/sign-in*", "src/app/owner-login/**", "src/app/api/auth/**", ".env.example", "public/_headers", "scripts/project-identity-guard.mjs"],
  },
  { agent: "qa", patterns: ["tests/**", "playwright.config.ts"] },
  { agent: "devops", patterns: [".github/**", "scripts/**", "wrangler.jsonc", "services/ai-python/wrangler.jsonc", "open-next.config.ts", "next.config.ts", "Dockerfile", "package.json", "package-lock.json"] },
  { agent: "performance", patterns: ["src/app/robots.ts", "src/app/sitemap*", "src/app/sitemaps/**", "src/lib/seo*.ts", "src/lib/sitemap.ts", "src/app/**/layout.tsx", "public/sw.js", "public/_headers", "next.config.ts"] },
  { agent: "localization", patterns: ["src/messages/**", "src/config/locales.ts", "src/config/glossary.ts", "src/i18n/**"] },
  { agent: "inspector", patterns: ["src/lib/ops/**", "src/app/dr/operations/**"] },
]);

/** Documentation-only changes need no specialist verification (the deploy workflow skips them too). */
export const DOC_PATTERNS: readonly string[] = Object.freeze(["**/*.md", "docs/**"]);

/** Paths whose change needs the owner's approval before merge (CLAUDE.md 0.8, 2, 3, 8.5). Reported, never auto-approved. */
export const APPROVAL_GATES: readonly { reasonCkb: string; patterns: readonly string[] }[] = Object.freeze([
  { reasonCkb: "Schema یان Migration ی داتابەیس", patterns: ["prisma/schema.prisma", "prisma/d1/**", "prisma/migrations/**"] },
  { reasonCkb: "Auth، RBAC یان SUPER_ADMIN", patterns: ["src/auth.ts", "src/auth.config.ts", "src/middleware.ts", "src/lib/rbac.ts", "src/lib/auth-helpers.ts", "src/lib/dr-auth.ts"] },
  { reasonCkb: "CI/CD، Deploy یان پاسەوانی ناسنامە", patterns: [".github/workflows/**", "wrangler.jsonc", "services/ai-python/wrangler.jsonc", "scripts/project-identity-guard.mjs", "scripts/production-target.mjs"] },
  { reasonCkb: "ناسنامە و براندی REGA24", patterns: ["public/brand/**", "src/app/globals.css", "public/icon.png", "public/apple-icon.png", "public/favicon.ico", "public/opengraph-image.png"] },
  { reasonCkb: "سیاسەتی تێچووی AI (€0)", patterns: ["src/lib/ai/routing.ts", "src/lib/ai/budget.ts"] },
  { reasonCkb: "Dependency (تێچوو و ئاسایش)", patterns: ["package.json", "package-lock.json", "services/ai-python/pyproject.toml"] },
  { reasonCkb: "یاساکانی پڕۆژە", patterns: ["CLAUDE.md", "AGENTS.md"] },
]);

const regexCache = new Map<string, RegExp>();
export function globToRegExp(glob: string): RegExp {
  let re = regexCache.get(glob);
  if (!re) {
    const body = glob
      .split("**")
      .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"))
      .join("§");
    // "dir/**" also matches "dir" itself; "**/x" also matches "x" at the root.
    re = new RegExp(`^${body.replace(/§\//g, "(?:.*/)?").replace(/\/§$/, "(?:/.*)?").replace(/§/g, ".*")}$`);
    regexCache.set(glob, re);
  }
  return re;
}

export const matchesAny = (path: string, patterns: readonly string[]) => patterns.some((p) => globToRegExp(p).test(path));

export type RoutePlan = {
  /** Agents the task needs, in registry order (orchestrator first). Deduplicated. */
  agents: EngineeringAgentId[];
  /** Changed paths that need the owner's approval before merge, with the reason (Sorani). */
  approvals: { path: string; reasonCkb: string }[];
  docsOnly: boolean;
  /** More specialists than one task may use (ENGINEERING_LIMITS.maxSpecialistsPerTask): split the change. */
  oversized: boolean;
  inspected: number;
  truncated: boolean;
};

/** Deterministic routing of one change (no AI): duplicate paths count once, the input is bounded. */
export function routeChange(paths: readonly string[]): RoutePlan {
  const unique = [...new Set(paths.map((p) => p.trim().replace(/^\.\//, "")).filter(Boolean))];
  const files = unique.slice(0, ENGINEERING_LIMITS.maxPaths);
  const picked = new Set<EngineeringAgentId>(["orchestrator"]);
  const approvals: RoutePlan["approvals"] = [];
  let docsOnly = files.length > 0;
  for (const path of files) {
    for (const route of ROUTES) if (matchesAny(path, route.patterns)) picked.add(route.agent);
    const gate = APPROVAL_GATES.find((g) => matchesAny(path, g.patterns));
    if (gate) approvals.push({ path, reasonCkb: gate.reasonCkb });
    if (!matchesAny(path, DOC_PATTERNS)) docsOnly = false;
  }
  // Every non-documentation change is verified by QA; documentation-only changes need nobody else.
  if (!docsOnly && files.length) picked.add("qa");
  const agents = ENGINEERING_AGENT_IDS.filter((id) => picked.has(id));
  return {
    agents,
    approvals,
    docsOnly,
    oversized: agents.length - 1 > ENGINEERING_LIMITS.maxSpecialistsPerTask,
    inspected: files.length,
    truncated: unique.length > files.length,
  };
}

/** `name` and `tools` from a profile's YAML front matter (the subset Claude Code reads). */
export function parseProfile(text: string): { name: string | null; tools: string[]; description: string | null } {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const field = (key: string) => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(fm)?.[1].trim() ?? null;
  return { name: field("name"), description: field("description"), tools: (field("tools") ?? "").split(",").map((t) => t.trim()).filter(Boolean) };
}

/**
 * Registry integrity, shared by the unit tests and the routing workflow. `profiles` maps a profile path to its text
 * (missing = absent file); `inspectorIds` is the runtime registry (AGENT_IDS). Returns problems; empty = valid.
 */
export function registryProblems(profiles: Readonly<Record<string, string | undefined>>, inspectorIds: readonly string[]): string[] {
  const problems: string[] = [];
  const ids = ENGINEERING_AGENTS.map((a) => a.id);
  if (ids.length !== 10 || new Set(ids).size !== 10) problems.push("registry must hold exactly ten unique agents");
  if (ids.join() !== ENGINEERING_AGENT_IDS.join()) problems.push("ENGINEERING_AGENTS order must follow ENGINEERING_AGENT_IDS");
  ENGINEERING_AGENTS.forEach((a, i) => {
    if (a.number !== String(i + 1).padStart(2, "0")) problems.push(`${a.id}: number ${a.number} out of sequence`);
    if (!(ACCESS_TIERS as readonly string[]).includes(a.tier)) problems.push(`${a.id}: unknown tier ${a.tier}`);
    for (const u of a.uses) if (!inspectorIds.includes(u)) problems.push(`${a.id}: uses unknown inspector ${u}`);
    if ((a.tier === "read" || a.tier === "propose") && !a.forbidden.includes("edit files")) problems.push(`${a.id}: read-only tier must forbid editing`);
    if ((a.tier === "branch" || a.tier === "workflow") && !a.validation.includes("npm test")) problems.push(`${a.id}: code-changing tier must run npm test`);
    const text = profiles[profilePath(a.id)];
    if (text === undefined) { problems.push(`${a.id}: missing ${profilePath(a.id)}`); return; }
    const p = parseProfile(text);
    if (p.name !== profileName(a.id)) problems.push(`${a.id}: profile name ${p.name} ≠ ${profileName(a.id)}`);
    if (!p.description) problems.push(`${a.id}: profile needs a description`);
    if (p.tools.join(",") !== TIER_TOOLS[a.tier].join(",")) problems.push(`${a.id}: profile tools [${p.tools}] ≠ tier ${a.tier} [${TIER_TOOLS[a.tier]}]`);
    if (p.tools.includes("Agent") || p.tools.includes("Task")) problems.push(`${a.id}: profiles may not start other agents`);
  });
  const routed = new Set(ROUTES.map((r) => r.agent));
  for (const id of ENGINEERING_AGENT_IDS) if (id !== "orchestrator" && !routed.has(id)) problems.push(`${id}: no route reaches this agent`);
  return problems;
}
