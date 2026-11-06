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
| Zero-cost policy: only owner-approved providers exist; no paid fallback | IMPLEMENTED | `permittedProviderIds` in `src/lib/ai/routing.ts` (section 7) |
| Atomic daily budget per attempt (fallbacks, probes), Workers AI cap, fail-closed | IMPLEMENTED | `src/lib/ai/budget.ts`, gateway `reserve` hook |
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
| PM-01 | €0 AI guarantee (section 7) | P1 (cost) | Fail-closed policy, atomic per-attempt budget and Workers AI cap in code and tested; owner sets approvals and verifies accounts | IMPLEMENTED in branch — merge + owner verification pending |
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

**Request flow (source-traced, after this change).** `POST /api/v1/ai/chat` → flag `public.aiSearch` (code default
`false`) → body ≤ 64 KB, schema → rate limits (12/min per session, 30/min per IP via `AI_LIMITER`) → retrieval →
Workers AI rerank only if `workers-ai` is approved, the payload is within the cap's bounds and an atomic rerank unit is
reserved (otherwise the Postgres order is kept) → **no hits: answered without a model (€0)** → per-instance pre-check
→ gateway with **only permitted providers** → **before every provider call (fallbacks and `/dr/ai` probes too) one
atomic unit of `AI_DAILY_LIMIT` is reserved**; refused or unreadable counter = `budget_exceeded` (HTTP 429), no call.

**Zero-cost policy (owner-controlled Cloudflare variables, ids only, never secrets).**

| Variable | Meaning | Default |
| --- | --- | --- |
| `AI_FREE_TIER_APPROVED` | free-tier providers (`gemini`, `groq`) and `workers-ai` whose account has **no billing enabled** | empty → no model, no rerank |
| `AI_PAID_APPROVED` | paid providers the owner explicitly accepts charges for | empty → every paid provider blocked |
| `AI_RERANK_DAILY_LIMIT` | lowers the Workers AI cap; cannot exceed `RERANK_DAILY_CAP` (250) | 250 |
| `AI_DAILY_LIMIT` | model attempts per UTC day, all providers together | 500 |

A key alone activates nothing. Unknown providers count as paid. A free-tier approval also requires a **verified
free model** (`FREE_TIER_MODELS` in `src/lib/ai/routing.ts`: gemini `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`
per ai.google.dev pricing "Free of charge"; groq `openai/gpt-oss-120b` per console.groq.com free-plan limits; read
2026-11-05). A `GEMINI_MODEL` / `GROQ_MODEL` override to any other model is blocked (`model_not_verified_free`). A paid id in the free list is not approved. Pinning
`AI_PROVIDER` to a blocked provider leaves AI off. Blocked providers are never built, so routing, fallback and probes
cannot reach them; the gateway logs `ai.cost.providers_blocked` (ids and reasons only).

**Providers and billing class** (`PROVIDER_BILLING`; default models in `src/lib/env.ts`):

| Provider | Default model | Billing class |
| --- | --- | --- |
| `gemini` | `gemini-3.5-flash-lite` | free-tier (billed only if billing is on for that Google project) |
| `groq` | `openai/gpt-oss-120b` | free-tier (billed only on a paid Groq plan) |
| `openai` | `gpt-4.1-mini` | paid |
| `grok` | `grok-4.7` | paid |
| `deepseek` | `deepseek-flash` | paid (prepaid balance) |
| `openrouter` | `google/gemini-3.5-flash-lite` | paid (not a `:free` model) |
| `anthropic` | `claude-haiku-4-5-20251001` | paid |
| Workers AI (`rega-ai-python`) | `@cf/baai/bge-reranker-base` | free allocation (below) |

Vendor classes for the six external providers come from their public pricing models and were not re-read in this
session; that is why free-tier providers also require the owner's approval.

**Workers AI cap (verified).** developers.cloudflare.com/workers-ai/platform/pricing/ (updated 2026-10-20, read
2026-11-04): 10,000 Neurons per account per UTC day free; beyond it Workers Free fails, Workers Paid bills $0.011 per
1,000 Neurons; `bge-reranker-base` = 283 Neurons per million input tokens. Worst REGA call: 12 × (4,000 + 1,000) chars
× 2 tokens/char = 120,000 tokens = 34 Neurons; cap = floor(85 % × 10,000 / 34) = **250 calls/day** (≤ 8,500
Neurons). `bge-m3` embeddings are not called by the app.

**Budget accounting.** Reservations are rows of `AiUsageDaily` with `provider = "_budget"` (`model-attempts`,
`workers-ai-rerank`), written by one `INSERT … ON CONFLICT DO UPDATE … RETURNING` statement (Prisma `increment` is a
read-modify-write on D1, `src/lib/d1-transaction.ts`). No schema change. They are excluded from `/dr/ai` and analytics
request totals; agent 10 reports them. Per-provider success statistics are unchanged.

**Agent 10** reports `ai.paid_providers` (PASS none approved · INFO free-tier only · WARN owner-approved paid),
`ai.cost_blocked`, `ai.daily_budget` (WARN when exhausted) and `ai.workers_ai_rerank`. Ops agents never call a model
(test-enforced).

**Evidence.** Live `GET https://www.rega24.com/api/v1/health` at 2026-11-04T17:22:45Z: `ai: true`, `aiProviders: 4`
(count only): at least two keys belong to paid providers. Which ones, `AI_PROVIDER`, the stored flag, the Cloudflare
plan and vendor billing states remain UNKNOWN here (no Cloudflare variable access). Tests: `tests/ai-cost-guard.test.ts`
(paid blocking, no paid fallback, quota exhaustion, concurrency, day reset, outage, probes, Workers AI cap, atomic SQL on
the real D1 table, background agents).

**Production effect after merge + deploy.** With the approval variables unset, the assistant answers only the no-match
case and otherwise returns 503 `ai_not_configured`; `/api/v1/health` keeps `ok: true` (it does not depend on AI) and
reports `ai: false`. This is the intended fail-safe state.

**Remaining limits (owner).** (1) Set `AI_FREE_TIER_APPROVED` only for accounts verified to have billing disabled.
(2) Remove unused paid keys in Cloudflare. (3) The Workers AI allowance is account-wide; other Workers on the same
account are not visible here; on Workers Free overage fails instead of billing, so confirm the plan. (4) Vendor-side
billing state cannot be read by code; €0 rests on (1)–(3).

## 8. Free Cloudflare capabilities in the one control plane (2026-11-05)

One control plane: the existing gateway (`src/lib/ai/gateway.ts`), policy (`routing.ts`), budget (`budget.ts`), Agent 10
and `/dr/ai`. No second gateway, Worker, database or binding: Workers AI runs through the existing `rega-ai-python`
Worker, which already owns the `AI` binding.

| Cloudflare capability | Free terms (verified) | In the control plane | Decision |
| --- | --- | --- | --- |
| Workers AI chat (`workers-ai`, `@cf/google/gemma-4-26b-a4b-it`) | 10,000 Neurons/account/day free; Workers Free fails beyond it, Workers Paid bills; model stays on Workers Free (changelog 2026-07-28); 9,091 / 27,273 Neurons per M input / output tokens | 8th gateway provider; `rega-ai-python` `/v1/generate` (existing binding, token, 128 KB body limit; accepts only verified free models); free fallback after gemini and groq; approval `workers-ai` + verified free model + `AI_SERVICE_URL/TOKEN` required | ADOPTED (off until approved) |
| Workers AI rerank (`rega-ai-python`) | same allocation; 283 Neurons/M tokens | approval `workers-ai`; ≤ 250 calls/day | EXISTED; now also draws from the shared budget |
| One Workers AI Neuron budget | — | `WORKERS_AI_NEURON_BUDGET` = 8,500/day (85 %), atomic, worst case reserved before every call (chat and rerank) | ADOPTED |
| Rate Limiting binding (`AI_LIMITER`) | included | 20 req/60 s per IP before the gateway | EXISTED |
| D1 (`AiUsageDaily`) | included | atomic counters, usage history | EXISTED |
| Workers Observability | included | `ai.*` structured logs | EXISTED |
| AI Gateway (Cloudflare) | core free, log retention limited | would duplicate our gateway, breaker, budget and logs | NOT REQUIRED |
| Vectorize / embeddings (`bge-m3`) | free tier limits apply | no embedding pipeline in the product today | NOT REQUIRED |

**Residual cost risk (owner):** the 10,000 Neurons are per Cloudflare account. Other Workers on the same account are not
visible to Rega24; on Workers Paid their usage plus Rega24's could exceed the free allocation. Approve `workers-ai` only
after confirming the plan (Workers Free: overage fails, never bills) or that no other Worker uses Workers AI.

**Why not an `AI` binding on `rega24`:** with any AI binding, OpenNext's deploy step opens a remote Cloudflare session,
which needs an API token; the credential-free CI check (`cf:dry-run`) would fail. The existing `rega-ai-python` binding
avoids that and any duplicate binding.

**To enable (owner):** `AI_FREE_TIER_APPROVED=gemini,groq,workers-ai` (or a subset); `AI_SERVICE_URL` and
`AI_SERVICE_TOKEN` must be set on `rega24` (the rerank already uses them). Nothing else changes.
