# Central Architecture Decision Records

This is the only decision index for Rega24 AI & Agent architecture. Keep all system documents flat in `REGA24_AI_AGENT_SYSTEM/`; do not create nested decision folders or competing records.

## Accepted permanent decision: ONE CENTRAL SYSTEM
- Status: ACCEPTED — owner-directed architectural invariant.
- Decision: Rega24 has one official AI architecture, one central AI Agent system, one central orchestrator, one agent registry, one configuration/governance layer, one monitoring/reporting approach, one security/permission model, and one research/update process.
- System identity and source of truth: **REGA24 AI AGENT SYSTEM**.
- All specialist agents, skills, workflows, and integrations are subordinate modules coordinated within this system.
- Prohibit competing architectures, orchestrators, control centers, registries, monitoring/update engines, and AI directories.
- Reuse existing infrastructure; audit before adding. Missing capabilities must be marked NOT IMPLEMENTED / AUDIT REQUIRED, not silently duplicated.
- Security boundary: existing Rega24 authentication, RBAC, BusinessMember isolation, and owner permissions remain authoritative.
- Cost: €0 additional spend.
- Scope of this documentation change: records the permanent rule; it does not claim runtime central orchestration or agent registry implementation has already been verified.
- Approval: explicitly directed by the project owner in the conversation on 2026-11-02.

## Future decision record format
- Status: proposed / accepted / rejected / superseded
- Context and repository evidence
- Decision and alternatives
- Relationship to the one central system
- Owner, responsibility, and permission boundary
- €0 cost verification
- Security, privacy, and operational implications
- Tests, consequences, and rollback/exit strategy
- Related PR/commit
