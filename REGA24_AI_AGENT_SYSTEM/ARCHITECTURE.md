# Unified Architecture — One Rega24 AI Agent System

## Absolute invariant
There is exactly ONE official Rega24 AI architecture: **REGA24 AI AGENT SYSTEM**. It has one central orchestrator, one authoritative agent registry, one configuration/governance layer, one monitoring/reporting approach, one security/permission model, and one research/update process.

Every specialist agent, assistant, skill, workflow, tool integration, and AI capability is a coordinated module/member under that central system. A specialist may have a distinct task and name, but is never an independent system, control plane, orchestrator, authority, or source of truth.

## Central system directory and registry
- All authoritative AI/Agent documentation stays flat in `REGA24_AI_AGENT_SYSTEM/`.
- The sole registry is [AGENT_REGISTRY.md](AGENT_REGISTRY.md). Do not create a second inventory elsewhere.
- All external skills, workflows, integrations, and agent definitions must be registered or linked there before adoption/activation.
- Configuration, governance, monitoring, and reporting must reuse one central implementation each. Audit current code before naming or creating implementation files.
- If a central capability does not yet exist, record it as **NOT IMPLEMENTED / AUDIT REQUIRED**; do not pretend it exists or create a duplicate to fill the gap.

## Current-state-first integration
Inspect the current repository before implementation. The existing provider-neutral AI gateway is documented under `src/lib/ai/`; verify current files and behavior at implementation time. Audit existing orchestration, provider contracts, task routing, retrieval, timeouts, fallback, circuit breakers, health checks, budgets, rate limits, feature flags, auth/RBAC, BusinessMember checks, audit logs, API routes, localization, deployment, monitoring, and research automation.

## Single central orchestrator
One orchestrator coordinates registered specialist modules and owns routing/lifecycle coordination. It must reuse existing Rega24 services and preserve server-side authorization. No agent may independently spawn persistent agents, create a separate orchestration loop, own separate memory/credentials/policies, or bypass the central coordinator.

**Implementation status must be evidence-based:** if the repository audit has not verified an existing central orchestrator, record it as NOT IMPLEMENTED / AUDIT REQUIRED. Do not introduce a new orchestrator until the audit proves none exists and the owner explicitly approves the minimal implementation plan.

## One shared set of system responsibilities
1. Experience: existing Rega24 UI and API surfaces.
2. Identity and authorization: existing authentication, RBAC, BusinessMember checks.
3. Central orchestration and one canonical agent registry.
4. Specialist modules with bounded purposes and allowlisted tools.
5. Approved knowledge and retrieval with business-level access filtering.
6. Existing model/runtime adapter and provider-neutral AI gateway.
7. Shared safety, configuration, policy, and human approval gates.
8. Shared monitoring, evaluation, audit, and reporting.

These are logical responsibilities, not a mandate to create separate services or folders. Reuse current implementations and extend minimally.

## Mandatory module contract
Every agent/module must have: unique registry ID; named owner; one bounded responsibility; typed inputs/outputs; explicit tools; least-privilege permissions; data scope; central orchestrator integration; €0 cost verification; monitoring/evaluation signals; failure/fallback behavior; tests; lifecycle status; and disable/rollback method.

## Security and reliability
Treat user content, retrieved documents, websites, and tool outputs as untrusted data. Validate tools server-side and re-check authorization at action time. Read-only by default; separate proposals from write execution. Enforce timeouts, bounded retries, rate limits, request budgets, cancellation, and graceful fallback. Never expose secrets, private records, or cross-business data.

## Cost and deployment
€0 additional spend only. Verify terms, limits, commercial-use rights, privacy, and payment requirements before adoption. Documentation and local tests do not authorize production activation. Use existing feature flags and release processes; production changes require explicit approval.


## Repository audit baseline — 2026-11-02

The following existing components have been verified in source and must retain their bounded roles:

- `src/lib/ai/runtime.ts` + `gateway.ts` + `routing.ts`: the single provider catalog and model-request gateway. This routes model calls; it does not coordinate autonomous agents.
- `src/lib/ops/engine.ts` + `core.ts` + `agents.ts`: one guarded runner for ten deterministic, read-only Operations inspectors under owner-only `/dr/operations`. This runner coordinates only those inspectors; it is not the general-purpose AI orchestrator.
- `src/lib/ai/chat.ts` + `src/app/api/v1/ai/chat/route.ts`: grounded REGA chat pipeline using existing search/retrieval, feature-flag, request limits, and persistence.
- `src/lib/ai/python-runtime.ts` + `services/ai-python/`: optional subordinate semantic reranking service. Primary retrieval remains in the main application and failures fall back to original search candidates.

**Global orchestration status: NOT IMPLEMENTED / AUDIT REQUIRED.** No verified component currently coordinates all registered AI capabilities, tool permissions, lifecycle, approval gates, and shared monitoring. Do not call the Operations runner or model gateway the global orchestrator. Do not add a competing runner; first design the smallest integration that composes these existing components under one central contract.

**Cost status: BLOCKED pending evidence for strict €0.** The current provider runtime defaults `AI_PROVIDER` to `auto`, can activate any configured provider key, and routes/falls back among seven vendor adapters. `AI_DAILY_LIMIT` is a request-count limit, not a euro spend ceiling. The optional Python Worker uses a remote Cloudflare AI binding. These facts do not prove a charge has occurred, but they also do not prove a €0 ceiling. No production provider, feature flag, secret, or Cloudflare setting is changed by this audit.

The exact module inventory, permission boundaries, and cost blockers are maintained only in [AGENT_REGISTRY.md](AGENT_REGISTRY.md).
