# REGA24 AI AGENT SYSTEM

**The one and only official AI architecture, central agent system, and single source of truth for Rega24.**

> Foundation and governance documentation. Runtime orchestration and registry implementation status must be verified by repository audit; this documentation alone does not activate agents or change production behavior.

## Absolute rule
ONE PROJECT. ONE ARCHITECTURE. ONE CENTRAL AI SYSTEM. ONE ORCHESTRATOR. ONE REGISTRY. ONE SOURCE OF TRUTH. ZERO DUPLICATION. €0 ADDITIONAL COST.

Every specialist agent, skill, workflow, tool integration, and AI capability is a coordinated module under this central system—not an independent system.

## Start here
1. [Permanent charter](CHARTER.md)
2. [Unified architecture](ARCHITECTURE.md)
3. [Governance, security, and reporting](GOVERNANCE.md)
4. [Central agent registry](AGENT_REGISTRY.md)
5. [Roadmap](ROADMAP.md)
6. [Central architecture decisions](DECISIONS.md)

## Existing infrastructure
The current repository documents a provider-neutral AI gateway under `src/lib/ai/`. Audit actual files and behavior before changing or extending it. Reuse existing auth/RBAC, business isolation, routes, tools, retrieval, configuration, monitoring, and deployment patterns. Do not create parallel infrastructure.

## Operating rules
Every capability must be registered before activation and identify its owner, bounded responsibility, inputs/outputs, tools, permission boundary, data scope, central orchestrator integration, €0 verification, monitoring/evaluation, fallback, tests, and rollback/disable method.

No paid APIs/services, no rebuild, no destructive changes, no privilege escalation, and no production action without required authorization. Report only evidence-backed PASS / FAIL / BLOCKED / NOT IMPLEMENTED / NOT RUN.
