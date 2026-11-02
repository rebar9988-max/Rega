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
