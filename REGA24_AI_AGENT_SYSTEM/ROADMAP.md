# Roadmap — One Central AI Agent System

This roadmap evolves one system only. It does not authorize a parallel platform or production activation.

## Phase 0 — Audit the existing single system
- Map existing AI gateway, orchestration, agents, tools, registry/inventory, configuration, governance, monitoring, research/update jobs, routes, providers, retrieval, feature flags, tests, secrets, and costs.
- Identify every agent-like capability already in the repository and integrations.
- Map data sensitivity, permissions, and BusinessMember boundaries.
- Mark each central responsibility EXISTING / PARTIAL / NOT IMPLEMENTED / BLOCKED with file paths and evidence.
- Do not create missing components until the audit and minimal design are reviewed.

## Phase 1 — Establish the one source of truth
- Maintain only `REGA24_AI_AGENT_SYSTEM/AGENT_REGISTRY.md` as the official agent registry.
- Register existing agents and specialist modules; unknown/unverified items remain explicitly marked pending audit.
- Link all skills, workflows, integrations, documentation, and ownership records from this central directory.
- Keep documentation flat; no nested competing AI directories.

## Phase 2 — Integrate and improve, never duplicate
- Improve existing orchestration, gateway, policy, configuration, monitoring, and reporting in place.
- Every new specialist capability must be a module registered in the central registry and coordinated by the one orchestrator.
- Prefer deterministic application logic when it is more reliable.
- Keep experiments disabled and isolated from production.

## Phase 3 — Verify
- Unit/integration/E2E tests; permission and cross-business isolation tests; prompt-injection/tool-abuse tests; performance, accessibility, localization, privacy, licensing, and €0 cost checks.
- Verify that no duplicate orchestrator, registry, configuration, monitoring, security, or update process was introduced.
- Owner review and approval for consequential changes.

## Phase 4 — Controlled release
- Use existing feature flags and deployment process.
- Deploy only after explicit authorization.
- Monitor centrally and maintain a tested disable/rollback path.

## Central weekly research and update report
One process, one report, one source of truth. Record date, verified developments relevant to Rega24, current-system evidence, ranked user-benefit opportunities, €0 feasibility, security/privacy risks, recommended next step, and PASS / FAIL / BLOCKED / NOT RUN. Do not add a separate update engine or duplicate reporting destination.


## Verified audit findings — 2026-11-02

The repository already contains ten deterministic read-only Operations inspectors under `src/lib/ops/`, one AI model gateway under `src/lib/ai/`, a grounded REGA chat pipeline, and an optional Python semantic reranking Worker. These have been reconciled into the sole [AGENT_REGISTRY.md](AGENT_REGISTRY.md).

The following are **not** interchangeable and must not be counted as the global orchestrator:
- `src/lib/ops/engine.ts`: coordinates only the ten owner-run Operations inspectors.
- `src/lib/ai/gateway.ts`: routes model requests to configured providers.
- `src/lib/ai/python-runtime.ts`: optional reranking client; it does not own retrieval or agent lifecycle.

### Next controlled work (no production activation)

1. Design one minimal central orchestration contract that composes the existing bounded modules without duplicating their engines, routes, storage, or permission checks.
2. Resolve the €0 cost mismatch before enabling any new model call: current `AI_PROVIDER=auto` can use configured third-party providers; `AI_DAILY_LIMIT` is a request cap, not a euro cap; the optional Python Worker uses a remote Cloudflare AI binding. Verify actual provider entitlements and Cloudflare account billing, or obtain owner approval for an explicit provider policy. Do not alter production settings in this audit.
3. Define a single module invocation interface, typed input/output schemas, tool allowlists, server-side authorization re-check, cancellation, timeout, idempotency, budget, audit record, and deterministic fallback.
4. Add registry-to-code parity tests so every existing Operations agent and AI runtime integration is represented exactly once, and no unregistered agent can be activated.
5. Unify observability by reusing the existing logger, AI usage accounting, and Operations AuditLog records; do not create a second dashboard or telemetry store.
6. Keep weekly research manual until one existing scheduler is audited and a free, privacy-safe schedule is proven. No new cron or paid service by default.
7. Verify with unit/integration/E2E tests, cross-business authorization tests, prompt-injection/tool-abuse tests, deterministic fallback tests, and clean CI. Deploy only after explicit owner authorization.
