# Architecture and Integration Boundaries

## Current-state-first rule

Before designing any agent, inspect the current repository and document what already exists. The README identifies the current AI gateway at `src/lib/ai/`. Verify actual files and behavior at implementation time; documentation may become stale.

Existing concepts to audit include:

- Provider-neutral AI gateway and provider contract
- Task routing and runtime configuration
- Retrieval and Rega24-owned data sources
- Timeouts, fallback, circuit breaker, and health checks
- Request budgets, rate limiting, and feature flags
- Existing authentication, RBAC, business membership, and audit logging
- Existing API routes, localization, and deployment model

## Logical layers

These are conceptual responsibilities, not a mandate to create one service or folder per layer.

1. **Experience layer:** existing Rega24 UI, API, and user-facing assistant surfaces.
2. **Identity and authorization:** existing Auth.js, RBAC, and BusinessMember checks remain authoritative.
3. **Orchestration:** bounded task selection and workflow coordination; reuse existing services where possible.
4. **Agent/tool boundary:** explicitly allowlisted tools with typed input/output validation.
5. **Knowledge and retrieval:** approved Rega24 content and data, with business-level access filtering.
6. **Model/runtime adapter:** existing provider-neutral gateway; no vendor SDK or model calls from the client.
7. **Safety and policy:** permission checks, input validation, output handling, rate limits, and human approval gates.
8. **Observability and evaluation:** safe logs, metrics, tests, audit records, and documented outcomes.

Do not introduce a new orchestration framework or agent runtime unless an evidence-based audit proves it is necessary, free, maintainable, and compatible.

## Agent design rules

- Prefer deterministic application code for predictable tasks; use an LLM only where language understanding or generation adds measurable value.
- Each agent must have one bounded purpose, a defined owner, explicit inputs/outputs, and a narrow allowlist of tools.
- Treat user content, retrieved documents, websites, and tool outputs as untrusted data—not instructions that can override system policy.
- Validate tool arguments server-side and re-check authorization at the point of action.
- Use read-only tools by default. Separate proposal from execution for write operations.
- Enforce timeouts, bounded retries, rate limits, request budgets, and graceful fallback.
- Never expose provider secrets, internal prompts, private records, or cross-business data.
- Support cancellation and safe failure. An unavailable model must not break core directory functionality.
- Store only necessary data and follow existing retention and privacy rules.

## Cost model

€0 means no new spend and no dependency on a paid or metered API. Before adopting any model or service, verify its current terms, limits, commercial-use rights, privacy terms, and whether payment details are required. If any uncertainty could lead to charges, do not enable it.

## Deployment boundary

Documentation and local tests do not authorize production activation. New capabilities must use existing configuration and feature-flag conventions where appropriate, remain disabled until reviewed, and follow normal PR, CI, migration, and deployment safeguards. No production database migration is part of this foundation.
