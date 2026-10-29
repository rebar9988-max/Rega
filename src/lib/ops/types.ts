/**
 * REGA24 Digital Operations Center — shared types of the ten logical inspection agents.
 * Pure module (no server/database imports): used by the engine, the agents, the /dr/operations page and unit tests.
 *
 * Every agent is READ-ONLY. None approves, rejects, deletes, merges, publishes or changes configuration: they inspect
 * and report; every decision stays with the owner.
 */

export const AGENT_IDS = [
  "business-inspector",
  "security-inspector",
  "qa-automation",
  "performance-inspector",
  "category-inspector",
  "location-inspector",
  "translation-inspector",
  "content-inspector",
  "analytics-inspector",
  "ai-discovery-inspector",
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && (AGENT_IDS as readonly string[]).includes(value);
}

/** PASS = every check passed · WARN = something needs the owner's attention · FAIL = a broken rule · SKIPPED = nothing
 * could run in this environment · BLOCKED = the engine refused to run (quota, lock, error before inspection). */
export const RUN_STATUSES = ["PASS", "WARN", "FAIL", "SKIPPED", "BLOCKED"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Result of one check. `info` counts as passed but is listed (a fact worth knowing, nothing broken). */
export type CheckResult = "pass" | "info" | "warn" | "fail" | "skip";

/** One record a finding refers to: a public identifier (slug, code, locale, key), never personal data. */
export type FindingItem = { label: string; href?: string };

export type Check = {
  /** Stable machine code, e.g. "business.duplicate_name". */
  code: string;
  result: CheckResult;
  /** Owner-facing text, concise Kurdish Sorani. */
  message: string;
  /** How many records are affected (when countable). */
  count?: number;
  /** A bounded sample of affected records. */
  items?: FindingItem[];
  /** Owner-facing recommendation (Sorani). The agent never performs it itself. */
  action?: string;
};

export type Finding = Omit<Check, "result"> & { severity: Exclude<CheckResult, "pass"> };

/** What an agent's inspection returns before the engine wraps it into a report. */
export type Inspection = {
  inspected: number;
  checks: Check[];
  /** Where each result comes from: tables read (with their bound), URLs probed, CI workflows, ... */
  evidence: string[];
};

export type CostStatus =
  /** Ran inside the engine's fixed per-run and per-day caps (see OPS_LIMITS). Account-wide usage is not visible here. */
  | "WITHIN_BOUNDED_FREE_CAPS"
  /** Not run: the daily cap or the cool-down was reached. */
  | "QUOTA_PROTECTED";

/** The stored report of one execution (shape requested by the owner; snake_case is deliberate). */
export type OpsReport = {
  agent: AgentId;
  execution_id: string;
  status: RunStatus;
  checked_at: string;
  duration_ms: number;
  trigger: "owner_manual";
  inspected_items: number;
  passed: number;
  warnings: number;
  failed: number;
  findings: Finding[];
  recommended_actions: string[];
  evidence: string[];
  cost_status: CostStatus;
  /** Owner-facing one-line summary, Sorani. */
  summary: string;
};

export type AgentMeta = {
  id: AgentId;
  number: string;
  /** Message key under `ops.agents.*` for the agent's name. */
  nameKey: string;
  /** What runs in the Worker on demand, and what runs elsewhere (existing CI). */
  runtime: "worker" | "worker+ci";
};

export const AGENTS: readonly AgentMeta[] = Object.freeze([
  { id: "business-inspector", number: "01", nameKey: "business", runtime: "worker" },
  { id: "security-inspector", number: "02", nameKey: "security", runtime: "worker+ci" },
  { id: "qa-automation", number: "03", nameKey: "qa", runtime: "worker+ci" },
  { id: "performance-inspector", number: "04", nameKey: "performance", runtime: "worker+ci" },
  { id: "category-inspector", number: "05", nameKey: "category", runtime: "worker" },
  { id: "location-inspector", number: "06", nameKey: "location", runtime: "worker" },
  { id: "translation-inspector", number: "07", nameKey: "translation", runtime: "worker+ci" },
  { id: "content-inspector", number: "08", nameKey: "content", runtime: "worker" },
  { id: "analytics-inspector", number: "09", nameKey: "analytics", runtime: "worker" },
  { id: "ai-discovery-inspector", number: "10", nameKey: "aiDiscovery", runtime: "worker" },
] satisfies AgentMeta[]);
