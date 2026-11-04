# REGA24 AI Agent System — control plane and product office

Single inventory of the existing REGA24 AI agent system. It describes code that already exists; it does not add a
second system, orchestrator, registry, database or service. Code is the source of truth:
`tests/ai-agent-system-doc.test.ts` fails when an agent, AI provider or AI task in the code is missing here.

Status words: **IMPLEMENTED** (in code, tested) · **PARTIAL** · **PROPOSED** (not built) · **BLOCKED** (needs owner
approval, money or access) · **REJECTED** (no measurable benefit). Audit date: 2026-11-04, `main` at `d6a6a49`.

## 1. Where the system lives

There is no folder named "REGA24 AI AGENT SYSTEM". The system is these existing modules in the `rega24` Worker:

| Part | Code | Owner surface |
| --- | --- | --- |
| Orchestrator + guards | `src/lib/ops/core.ts`, `src/lib/ops/engine.ts` | `/dr/operations` |
| Agent registry | `AGENT_IDS` / `AGENTS` in `src/lib/ops/types.ts` | `/dr/operations` |
| Agent collectors / analyzers | `src/lib/ops/agents.ts`, `src/lib/ops/analyzers/*` | — |
| Execution history + locks | `AuditLog` (`ops.report`), `Setting` (`ops.lock.<agent>`) via `src/lib/ops/store.ts` | `/dr/audit` |
| LLM gateway | `src/lib/ai/gateway.ts`, `src/lib/ai/routing.ts`, `src/lib/ai/runtime.ts` | `/dr/ai` |
| AI usage / FinOps | `AiUsageDaily`, `AiMessage` (tokens, latency) in `src/lib/ai/chat.ts` | `/dr/ai` |
| Python AI engine | `services/ai-python` (Worker `rega-ai-python`, Workers AI rerank/embeddings) | — |
| Governance | `src/lib/rbac.ts` (`operations.manage`, SUPER_ADMIN = owner only) | `/dr` |

## 2. Agent registry (one registry: `src/lib/ops/types.ts`)

All agents are read-only, owner-triggered (`trigger: owner_manual`) and never approve, publish, delete, merge or change configuration.

| # | Agent id | Responsibility (directive §7) | Status |
| --- | --- | --- | --- |
| 01 | `business-inspector` | Business intelligence, duplicate/conflict detection (reports only, never merges) | IMPLEMENTED |
| 02 | `security-inspector` | Security intelligence | IMPLEMENTED |
| 03 | `qa-automation` | Quality assurance | IMPLEMENTED |
| 04 | `performance-inspector` | Performance (Worker-side probes; not Lighthouse/CWV) | IMPLEMENTED |
| 05 | `category-inspector` | Catalogue quality | IMPLEMENTED |
| 06 | `location-inspector` | Location data quality | IMPLEMENTED |
| 07 | `translation-inspector` | Localization (7 locales, RTL) | IMPLEMENTED |
| 08 | `content-inspector` | Content and links | IMPLEMENTED |
| 09 | `analytics-inspector` | Search analytics / product performance signals | IMPLEMENTED |
| 10 | `ai-discovery-inspector` | SEO/GEO and AI-discovery | IMPLEMENTED |

Responsibilities without a dedicated agent: central orchestration (engine, not an agent), research intelligence,
engineering intelligence (CI + Claude Code sessions), customer assistant (`/ai` chat via the gateway) and product
management (section 6, documentation-driven). Adding an agent = one id in `AGENT_IDS`, one collector, one analyzer,
tests, and a row above.

## 3. Control-plane capabilities

| Capability | Status | Evidence |
| --- | --- | --- |
| One orchestrator, sequential "run all", time budget | IMPLEMENTED | `runAll` in `engine.ts` (no parallel runs, 45 s budget) |
| Idempotency / duplicate prevention | IMPLEMENTED | execution id reuse returns stored report (`runGuarded`) |
| Per-agent lock, cool-down, daily cap, throttling | IMPLEMENTED | `OPS_LIMITS` (100/day, throttle from 80, 2 min lock TTL) |
| Timeout + bounded retry, failure isolation | IMPLEMENTED | 25 s timeout, 2 attempts, no retry after timeout |
| Execution record (id, status, duration, actor, evidence, cost status) | IMPLEMENTED | `OpsReport` stored as `AuditLog` row |
| Permission enforcement | IMPLEMENTED | `operations.manage` held only by SUPER_ADMIN |
| Model inventory, routing, fallback, circuit breaker | IMPLEMENTED | `providerCatalog`, `DEFAULT_ROUTING`, `createGateway` |
| Model request accounting (requests, tokens, latency per day/provider/model) | IMPLEMENTED | `AiUsageDaily`, `AiMessage` |
| Shared daily request budget, fail-closed when accounting is down | IMPLEMENTED | `budgetAllows` in `chat.ts`, `AI_DAILY_LIMIT` |
| Secrets never logged | IMPLEMENTED | `scrub` in `src/lib/ai/errors.ts`; names-only config warnings |
| Conditional/parallel multi-step workflows between agents | NOT REQUIRED | agents are independent read-only inspectors; no task needs chaining |
| Financial cost in currency | BLOCKED | account billing is not readable from the Worker or repository |
| Scheduled / background runs, weekly automated report | BLOCKED | owner rule: scheduled ops execution stays OFF; needs owner approval |
| OpenTelemetry traces | PROPOSED | Workers Observability/structured `log.*` exists; no OTel exporter (would need a sink) |

AI tasks routed by the gateway: `chat`, `summarize`, `translate`, `classify`.

AI providers in the catalog (used only when the matching key is set; order per task in `src/lib/ai/routing.ts`):
`gemini`, `openai`, `grok`, `groq`, `deepseek`, `openrouter`, `anthropic`.

## 4. Reference comparison (read 2026-11-04)

**CONET AI Control Plane** (conet.de, consulting offer): LLM gateway + model routing, AI observability, AI FinOps,
governance. → Gateway/routing: ALREADY EXISTS. Observability: PARTIAL (logs + usage tables, no traces). FinOps:
PARTIAL (requests/tokens counted; currency cost BLOCKED). Governance: ALREADY EXISTS (RBAC, audit log, read-only
agents). Adopt the architecture only; the commercial service: REJECTED (€0 rule).

**Dash0 Agent0** (dash0.com): autonomous production agent that scans telemetry, traces issues to commits and opens
fix pull requests; chat + background automations; task-based paid credits. → On-demand inspection with evidence:
ALREADY EXISTS (ops agents). Automated fix PRs and background automations: REJECTED for production (owner-approval
rule, paid credits). Fixes stay with Claude Code/Codex sessions under human review.

**Frameworks** (LangGraph, Mastra, CrewAI, Pydantic AI, Cloudflare Agents SDK): MONITOR. No current task needs a
graph/multi-agent runtime; adding one would duplicate the engine. Versions, licences and advisories were not
re-verified in this session.

## 5. Governance and approvals

| Work | Who may do it |
| --- | --- |
| Read-only research, analysis, tests, documentation, safe reversible code on a branch | Claude Code / Codex autonomously |
| Running ops agents | Owner (`/dr/operations`) |
| Merge to `main`, production deploy, migrations, secrets, infrastructure | Owner approval; guard `scripts/project-identity-guard.mjs` first |
| Auth/RBAC/owner permissions, publishing/merging business records, data deletion | Owner approval |
| Enabling AI provider keys that bill, monetization, scheduled runs, external communication | Owner approval (€0 rule) |

## 6. Product management office

One roadmap and one backlog, both in this section. GitHub issues/PRs are the execution tracker; nothing else.
Items come only from verified repository evidence (`REGA24_SYSTEM_MAP.md` "Known technical risks", this audit).
Priority order: user benefit, security, business impact, urgency, feasibility, complexity, maintenance, cost.

### Strategy (current)

Rega24 is a free, multilingual (7 locales, Sorani first, RTL) business directory on Cloudflare (Worker `rega24`, D1,
R2). Product priorities: reliable listings and search, data quality, localization quality, owner control via `/dr`,
€0 additional cost.

### Backlog

| ID | Item | Priority | Acceptance criteria | Status |
| --- | --- | --- | --- | --- |
| PM-01 | €0 AI audit (section 7) | P1 (cost) | Code audit + `ai.paid_providers` check done; owner runs agent 10 and sets `AI_PROVIDER` / removes paid keys | PARTIAL — owner action required |
| PM-02 | Weekly improvement report | P2 | Owner approves a schedule; report reuses ops agents, no new workflow if an existing one fits | BLOCKED (owner approval) |
| PM-03 | README drift (Next.js version, `src/lib/ai.ts`) | P3 | README matches `package.json` and `src/lib/ai/` | PROPOSED |
| PM-04 | Secret sync gaps (model overrides, Python AI URL, flags) | P2 | `worker-secrets-sync.yml` list reviewed with owner | BLOCKED (secrets change) |
| PM-05 | Field performance data (CWV) for product KPIs | P3 | Free source chosen (e.g. existing Cloudflare analytics); no invented metrics | PROPOSED |
| PM-06 | Jobs and events sections | P3 | Owner decides; enabled via `SECTIONS_ENABLED` only | BLOCKED (owner decision) |

### Product KPIs (only measured sources)

Search success and zero-result queries (`SearchQueryDaily`, analytics-inspector), AI requests/tokens/latency
(`AiUsageDaily`), ops findings over time (`AuditLog ops.report`), CI and production-browser workflow results.
No user analytics are claimed beyond these.

## 7. PM-01 — €0 AI audit (2026-11-04)

**Request flow (source-traced).** `POST /api/v1/ai/chat` → flag `public.aiSearch` (code default `false`; stored value
in D1 unknown here) → body ≤ 64 KB, schema → rate limits (12/min per session in-isolate, 30/min per IP shared via
`AI_LIMITER` 20/60 s) → retrieval (`searchService`) → optional Workers AI rerank (`rega-ai-python`, only when
`AI_SERVICE_URL` + `AI_SERVICE_TOKEN` are set; failure returns the original order) → **no hits: answered without a
model (€0)** → `budgetAllows` (`AI_DAILY_LIMIT`, default 5,000 requests/day; fail-closed when accounting is down) →
gateway: providers selected by `AI_PROVIDER` (`activeProviderIds`, default `auto` = every provider with a key),
ordered by `DEFAULT_ROUTING`, 20 s per call, 40 s total, breaker after 3 failures → `AiMessage` + `AiUsageDaily`.

**Providers and billing class** (`PROVIDER_BILLING` in `src/lib/ai/routing.ts`; default models in `src/lib/env.ts`):

| Provider | Default model | Billing class |
| --- | --- | --- |
| `gemini` | `gemini-3.5-flash-lite` | free-tier (billed only if billing is on for that Google project) |
| `groq` | `openai/gpt-oss-120b` | free-tier (billed only on a paid Groq plan) |
| `openai` | `gpt-4.1-mini` | paid |
| `grok` | `grok-4.7` | paid |
| `deepseek` | `deepseek-flash` | paid (prepaid balance) |
| `openrouter` | `google/gemini-3.5-flash-lite` | paid (not a `:free` model) |
| `anthropic` | `claude-haiku-4-5-20251001` | paid |
| Workers AI (`rega-ai-python`) | `@cf/baai/bge-reranker-base`, `@cf/baai/bge-m3` | daily free allocation; overage billed only on Workers Paid |

**Evidence.** Live `GET https://www.rega24.com/api/v1/health` at 2026-11-04T17:22:45Z: `ai: true`, `aiProviders: 4`
(count only). Four keys among seven providers, of which only two are free-tier, means **at least two configured keys
belong to paid providers**. Which four, the `AI_PROVIDER` value, the stored flag, the Cloudflare plan and each vendor
account's billing state are UNKNOWN from this session (no Cloudflare variable access; `worker-secrets-sync.yml` has
never run, so keys were set directly in Cloudflare).

**Findings.**
1. €0 is **not technically enforced**; it currently depends on the flag being off. With `AI_PROVIDER=auto`, fallback
   reaches every keyed provider, paid ones included, whenever the free ones fail or rate-limit.
2. The budget counts requests, not money or tokens. Only successful answers are counted; failed fallback attempts,
   `/dr/ai` probes and Workers AI rerank calls are not. Check-then-increment allows a small overshoot under concurrency.
3. No currency cost tracking (vendor billing is not readable from the Worker).
4. Governance is sound: keys are server-only, logs are scrubbed, only the owner can switch the flag or probe.

**Implemented (report-only, no runtime change).** Agent 10 (`ai-discovery-inspector`) now reports
`ai.paid_providers` from the providers the gateway would really use: FAIL if a paid provider is active and the
assistant is on, WARN if active and off, INFO if only free-tier providers are active, PASS if none. It also reports
`ai.daily_budget` and `ai.workers_ai_rerank`. The gateway and the agent share `activeProviderIds`.

**Owner actions (BLOCKED here).** (a) Run agent 10 in `/dr/operations` to see which providers are active. (b) For a
guaranteed €0, set `AI_PROVIDER=disabled`, or `AI_PROVIDER=gemini`/`groq` with a key from an account without billing,
and delete the paid keys in Cloudflare. (c) Confirm the Cloudflare plan (Workers AI overage). PROPOSED, needs approval:
count every provider attempt against the budget and add a code-level opt-in before paid providers can be used.
