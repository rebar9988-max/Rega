# Official Rega24 Agent Registry

**This is the ONE authoritative registry for every AI/Agent module in Rega24.** Do not create another registry, inventory, or competing catalog.

## Registry governance
- Every agent, assistant, skill-backed agent, workflow agent, and tool-using AI capability must be recorded here before activation.
- All entries are subordinate to the single **REGA24 AI AGENT SYSTEM** and coordinated by its one central orchestrator.
- A specialist module is not an independent system and may not own a separate orchestrator, policy layer, credentials, monitoring, or lifecycle.
- Reuse existing implementations. Do not infer implementation from documentation.
- If the audit has not verified a capability, mark it **AUDIT REQUIRED**.
- €0 additional cost is mandatory. If not guaranteed, status is **BLOCKED**.
- Changes to permissions, production, or consequential actions require the existing owner approval and authorization controls.

## Central capability inventory

| Capability | Required cardinality | Current verified status |
|---|---:|---|
| Official AI architecture | Exactly 1 | Defined by this directory |
| Central AI Agent system | Exactly 1 | Defined by this directory |
| Central orchestrator | Exactly 1 | AUDIT REQUIRED — runtime implementation not yet verified |
| Official agent registry | Exactly 1 | This file |
| Central configuration/governance | Exactly 1 | Governance documented; runtime implementation AUDIT REQUIRED |
| Central monitoring/reporting | Exactly 1 | AUDIT REQUIRED |
| Central security/permission model | Exactly 1 | Existing Rega24 auth/RBAC is authoritative; AI-specific integration AUDIT REQUIRED |
| Central research/update process | Exactly 1 | Process documented; automation AUDIT REQUIRED |

## Agent/module records

No specialist agent is asserted to be implemented until the repository audit identifies its code, owner, tools, and tests. Add one row per verified module:

| Registry ID | Name | Owner | Bounded responsibility | Tools / data scope | Permission boundary | Orchestrator integration | Cost | Status | Evidence |
|---|---|---|---|---|---|---|---:|---|---|
| — | No agents registered yet; repository audit pending | — | — | — | — | — | €0 required | AUDIT REQUIRED | Pending repository inventory |

## Required record fields
For each future entry include: unique ID; name; owner; purpose; repository path/integration; typed inputs/outputs; allowed tools; data scope; permission boundary; orchestrator registration; cost verification; monitoring/evaluation; failure/fallback; tests; lifecycle status; disable/rollback plan; evidence links.

## Status vocabulary
- **EXISTING / VERIFIED** — confirmed in code and tests.
- **PARTIAL** — some responsibilities exist; gaps documented.
- **AUDIT REQUIRED** — not yet verified; no implementation claim.
- **PROPOSED** — design only, not active.
- **BLOCKED** — cannot proceed safely or at €0.
- **DISABLED** — implemented but not active.
- **ACTIVE** — reviewed, approved, and verified in its authorized environment.
- **RETIRED** — formally decommissioned with owner approval and migration/rollback evidence.
