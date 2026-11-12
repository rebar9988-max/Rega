# Official Rega24 Agent Registry

**The single authoritative registry for every AI, agent-like module, skill, workflow integration, and AI runtime in Rega24.** No second registry or competing catalog is permitted.

## Registry governance

- Every AI capability and agent-like module must be recorded here before activation.
- All entries belong to the one **REGA24 AI AGENT SYSTEM** and must follow its charter.
- Reuse existing implementations; do not infer implementation from documentation.
- Distinguish model-based AI, deterministic inspection agents, provider gateways, and infrastructure services. They are not interchangeable.
- The Operations Center runner is a bounded coordinator for its ten read-only inspectors; it is **not** the general-purpose central AI orchestrator.
- The AI Gateway routes model requests to providers; it is **not** an agent orchestrator.
- The general-purpose central AI orchestrator remains **NOT IMPLEMENTED / AUDIT REQUIRED** until a single implementation is explicitly identified, reviewed, and tested. Do not create a second runner or silently relabel an existing component.
- €0 additional cost is mandatory. Any provider or service whose current no-cost entitlement, quotas, and billing behavior are not verified is **COST BLOCKED** for new activation.
- Existing production settings are not changed by this registry. Owner approval is required for provider changes, public AI flags, secrets, permissions, production configuration, or deployments.

## Central capability inventory

| Capability | Required cardinality | Repository evidence | Status |
|---|---:|---|---|
| Official AI architecture | 1 | This directory | EXISTING / VERIFIED |
| Central AI Agent system and source of truth | 1 | This directory and charter | EXISTING / VERIFIED |
| General-purpose central agent orchestrator | 1 | No verified implementation found in audited paths | NOT IMPLEMENTED / AUDIT REQUIRED |
| Authoritative registry | 1 | This file | EXISTING / VERIFIED |
| Model/provider gateway | 1 | `src/lib/ai/runtime.ts`, `gateway.ts`, `routing.ts` | EXISTING / VERIFIED; gateway only, not agent orchestration |
| Operations inspection runner | 1 bounded runner | `src/lib/ops/engine.ts`, `core.ts`, `agents.ts` | EXISTING / VERIFIED; coordinates only the ten read-only Operations inspectors |
| Shared AI configuration | 1 | `src/lib/env.ts`, `src/lib/ai/runtime.ts`, `src/lib/flags.ts` | PARTIAL; shared settings exist, €0 enforcement and unified policy need audit |
| Shared security and permission model | 1 | Existing Auth/RBAC; `/dr/operations` checks `operations.manage` | EXISTING / VERIFIED for current routes; central tool policy across all future agents not implemented |
| Monitoring and reporting | 1 | `src/lib/logger.ts`, `AiUsageDaily`, Operations `AuditLog` reports | PARTIAL; existing channels are not yet a unified AI-agent observability contract |
| Research/update process | 1 | Manual weekly process documented in `ROADMAP.md`; no verified scheduled research job | DOCUMENTED / MANUAL; automation NOT IMPLEMENTED |
| Python semantic service | 1 optional subordinate service | `services/ai-python/`, `src/lib/ai/python-runtime.ts`, `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` | EXISTING / OPTIONAL; activation and current billing entitlement require verification |

## Verified existing modules

### A. Ten deterministic Operations inspection agents

All ten are implemented as read-only deterministic inspectors. They share the existing `rega24` Worker, D1/Prisma access, search code, probe budget, report storage, and the single Operations engine. They do not independently call a model, create their own infrastructure, or mutate business records.

| Registry ID | Module | Source / implementation | Responsibility | Runtime / permissions | Status |
|---|---|---|---|---|---|
| `business-inspector` | Business Inspector | `src/lib/ops/agents.ts`, `analyzers/business.ts` | Checks business completeness, stale records, duplicates, categories, locations, and links | Existing Worker; owner-only `operations.manage`; read-only | EXISTING / VERIFIED |
| `security-inspector` | Security Inspector | `agents.ts`, `analyzers/security.ts` | Checks owner/admin invariants, authentication failure aggregates, security headers, and public/private route separation | Existing Worker + repository CI secret scan; owner-only; read-only | EXISTING / VERIFIED |
| `qa-automation` | QA Automation Inspector | `agents.ts`, `analyzers/web.ts` | Bounded live-route, locale, direction, hreflang, and slug checks | Existing Worker + existing CI tests; owner-only; read-only | EXISTING / VERIFIED |
| `performance-inspector` | Performance Inspector | `agents.ts`, `analyzers/web.ts` | Measures bounded Worker-side probes, TTFB, HTML size, and scripts; does not claim Lighthouse or field CWV | Existing Worker + CI; owner-only; read-only | EXISTING / VERIFIED |
| `category-inspector` | Category Inspector | `agents.ts`, `analyzers/category.ts` | Checks category hierarchy, active state, translations, and public business counts | Existing Worker; owner-only; read-only | EXISTING / VERIFIED |
| `location-inspector` | Location Inspector | `agents.ts`, `analyzers/location.ts` | Checks country/region/city completeness, coordinates, and business locations | Existing Worker; owner-only; read-only | EXISTING / VERIFIED |
| `translation-inspector` | Translation Inspector | `agents.ts`, `analyzers/translation.ts` | Checks parity and missing translations across all registered locales | Existing Worker + existing CI catalogue checks; owner-only; read-only | EXISTING / VERIFIED |
| `content-inspector` | Content Inspector | `agents.ts`, `analyzers/content.ts` | Checks content quality and external links | Existing Worker; owner-only; read-only | EXISTING / VERIFIED |
| `analytics-inspector` | Privacy-safe Analytics Inspector | `agents.ts`, `analyzers/content.ts` | Reads aggregate search analytics only; no user/session/IP/device tracking added | Existing Worker; owner-only; read-only | EXISTING / VERIFIED |
| `ai-discovery-inspector` | AI Discovery Inspector | `agents.ts`, `analyzers/ai.ts` | Checks AI flag/default, configured-provider presence (booleans only), public-only retrieval boundaries, stored answer links, and deterministic no-model behavior | Existing Worker; owner-only; read-only; never calls an LLM | EXISTING / VERIFIED |

**Operations runner and safeguards:** `src/lib/ops/engine.ts` uses `runGuarded` from `core.ts` and `INSPECTORS` from `agents.ts`. It enforces owner permission at the server actions/page, execution-id idempotency, per-agent lock, bounded daily quota/cool-down, timeout, bounded retry, row/probe limits, and stores reports in the existing `AuditLog` (`ops.report`). Scheduled execution is OFF. No agent can approve, reject, publish, delete, merge, change flags, or modify configuration.

### B. Existing AI runtime modules

| Registry ID | Component | Source | Responsibility | Status |
|---|---|---|---|---|
| `rega-ai-chat` | Grounded REGA AI chat pipeline | `src/lib/ai/chat.ts`, `src/app/api/v1/ai/chat/route.ts` | Uses existing REGA search results, public business context, localized prompts, persistence, and response cards | EXISTING / VERIFIED; production enablement is owner-controlled by `public.aiSearch` |
| `rega-ai-gateway` | Single provider-neutral model gateway | `src/lib/ai/runtime.ts`, `gateway.ts`, `routing.ts` | Builds configured providers, routes tasks, enforces timeouts/fallback/circuit breakers, logs provider IDs, and applies request budgets | EXISTING / VERIFIED; not an agent orchestrator |
| `rega-ai-python-rerank` | Optional semantic reranking client | `src/lib/ai/python-runtime.ts`, `python-client.ts` | Sends bounded candidate text to the optional Python service; returns original search order on service failure | EXISTING / OPTIONAL; no primary retrieval authority |
| `rega-ai-python-worker` | Optional Cloudflare Python AI service | `services/ai-python/src/app.py`, `wrangler.jsonc`, deployment workflow | Internal-token-protected embedding/rerank/text-processing endpoints using the Cloudflare AI binding | EXISTING / OPTIONAL; deployment and account cost status require verification |

### C. Provider integrations — cost and activation are not assumed

The central catalog in `src/lib/ai/runtime.ts` currently defines seven provider adapters. The routing defaults in `src/lib/ai/routing.ts` include these providers as fallbacks. A configured key is not proof of free usage.

| Provider ID | Provider | Adapter | Cost status under Rega24 €0 rule |
|---|---|---|---|
| `gemini` | Google Gemini | `src/lib/ai/providers/gemini.ts` | COST BLOCKED until current free quota, billing requirements, and hard no-charge behavior are verified |
| `grok` | xAI Grok | `src/lib/ai/providers/openai-compatible.ts` | COST BLOCKED pending verified no-cost entitlement |
| `openai` | OpenAI | `openai-compatible.ts` | COST BLOCKED pending verified no-cost entitlement |
| `groq` | Groq | `openai-compatible.ts` | COST BLOCKED pending verified no-cost entitlement |
| `deepseek` | DeepSeek | `openai-compatible.ts` | COST BLOCKED pending verified no-cost entitlement |
| `openrouter` | OpenRouter | `openai-compatible.ts` | COST BLOCKED pending verified no-cost entitlement |
| `anthropic` | Anthropic Claude | `src/lib/ai/providers/anthropic.ts` | COST BLOCKED pending verified no-cost entitlement |

**Important cost mismatch requiring owner review:** `AI_PROVIDER` defaults to `auto`; when provider keys are present, `runtime.ts` can activate all configured providers and route/fallback between them. `AI_DAILY_LIMIT` defaults to 5,000 and is a request cap, not a euro-denominated spend cap. The in-memory counter resets on isolate restart; the database aggregate is the shared request check. Neither mechanism proves a €0 maximum bill. The Operations AI inspector reports configured provider names only and does not call a model. Do not change production provider settings or the public AI feature flag without owner approval.

## Integration boundaries and known gaps

1. **No general-purpose central AI orchestrator verified.** The Operations runner coordinates ten deterministic inspectors only. The AI gateway routes model calls only. Neither may be falsely documented as the global agent orchestrator.
2. **Operations agents are now registered.** They were already implemented in `src/lib/ops/`; leaving the registry at “no agents registered” was inaccurate and is corrected by this inventory.
3. **Provider cost enforcement is not €0-safe by evidence yet.** Default `AI_PROVIDER=auto`, provider fallbacks, and request-count budgets can still invoke metered services if configured. Current provider billing/free-tier status and production secret presence are not visible from source code. New activation remains blocked pending owner-approved cost verification.
4. **Python service is optional, not a second orchestrator.** It performs bounded embedding/reranking/text processing behind a server-to-server token. The main application retains primary retrieval and falls back to original candidates. Its Cloudflare AI binding is remote; account usage/billing must be verified before claiming €0.
5. **One security boundary is verified for Operations.** `operations.manage` is owner-only and actions are server-side guarded. Any future tool-using agent needs the same server-side permission re-check and business-scope enforcement; prompt text is never authorization.
6. **Monitoring is only partially unified.** Reuse `logger`, existing AI usage accounting, and Operations `AuditLog` reports. Do not add a separate agent dashboard, log store, or telemetry vendor.
7. **Research automation is not implemented.** Keep the weekly review manual until a single existing scheduler is audited and a €0, privacy-safe design is approved.

## Required contract for every future module

Every record must include: unique registry ID; owner; bounded responsibility; exact source path; typed inputs/outputs; allowlisted tools; data scope; permission boundary; integration point; verified €0 cost; monitoring/evaluation; timeout/retry/fallback; tests; lifecycle status; disable/rollback; and evidence.

## Status vocabulary

- **EXISTING / VERIFIED** — confirmed in source and tests.
- **PARTIAL** — some responsibilities exist; gaps are explicit.
- **AUDIT REQUIRED** — not verified; no implementation claim.
- **PROPOSED** — design only; not active.
- **COST BLOCKED** — €0 cannot currently be guaranteed.
- **BLOCKED** — unsafe or missing approval/dependency.
- **DISABLED** — implemented but not active.
- **ACTIVE** — reviewed, approved, and verified in its authorized environment.
- **RETIRED** — formally decommissioned with owner approval and rollback evidence.

Never claim a capability is deployed or production-verified from documentation or local tests alone.
