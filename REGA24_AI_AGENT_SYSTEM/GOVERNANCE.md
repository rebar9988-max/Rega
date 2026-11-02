# Central Governance, Security, and Reporting

## Single governance authority
All AI and Agent components are governed exclusively by **REGA24 AI AGENT SYSTEM**. One central configuration/governance layer and one security/permission model apply to every specialist module. No agent may define independent policies, credentials, permissions, monitoring, memory governance, or approval paths.

## Centralized controls
- One authoritative registry: [AGENT_REGISTRY.md](AGENT_REGISTRY.md).
- One central orchestrator coordinates registered agents.
- One shared configuration and policy authority.
- One shared authentication/RBAC and business-isolation model.
- One shared monitoring, evaluation, audit, and reporting approach.
- One shared research and update process.
- Reuse existing Rega24 implementations; if any central control is missing, record NOT IMPLEMENTED / AUDIT REQUIRED rather than silently creating a competing service.

## Permission model
- Existing authentication and RBAC remain authoritative.
- Every tool call enforces authorization server-side for the current user and relevant business.
- Business data access respects existing BusinessMember relationships and business scope.
- No agent receives SUPER_ADMIN privileges or inherits permissions from a prompt.
- The central orchestrator coordinates only; it cannot grant privileges or bypass owner permissions.
- Re-check authorization immediately before every sensitive operation.

## Approval gates
Explicit owner/authorized-user approval is required for production deployment/configuration changes; migrations, destructive writes, bulk edits, deletion; public publishing/outbound messages; account/role/permission/security changes; financial, billing, advertising, subscription, or payment operations; and adding dependencies/services with cost, licensing, privacy, or operational implications.

## Security controls
Treat retrieved/tool content as untrusted. Use strict schemas, allowlists, output validation, least privilege, rate limits, request budgets, timeouts, bounded retries, secret redaction, and deterministic fallback. Require human confirmation for consequential actions. Test prompt injection, data exfiltration, cross-business access, tool misuse, denial of service, and supply-chain risks.

## Monitoring and reporting
All modules report through the central monitoring/reporting approach. Do not create per-agent competing dashboards, logs, alerting systems, or update pipelines. Reuse existing telemetry and audit logs; verify what exists before implementation. Logs must minimize personal data and redact secrets.

## Research and updates
One centrally coordinated process evaluates AI/Agent developments for Rega24. It must prioritize verified user value, compatibility, €0 cost, privacy, and security—not generic news or hype. Findings and decisions are recorded in this directory and registry.

## Incident response
On suspected data exposure, unauthorized action, cost risk, or unsafe behavior, use existing safe controls to disable the affected module, preserve non-sensitive evidence, notify the owner, assess impact, and do not silently resume. No destructive remediation without approval.

## Status vocabulary
- PASS: criteria met with evidence.
- FAIL: required criterion failed.
- BLOCKED: missing approval, evidence, or dependency prevents safe progress.
- NOT IMPLEMENTED / AUDIT REQUIRED: capability is not yet verified as existing.
- NOT RUN: check was not executed.

Never claim a capability is deployed or production-verified based only on documentation, local tests, or a merged PR.


## Verified implementation boundary — 2026-11-02

- The existing `operations.manage` permission and server-side checks protect the ten deterministic, read-only inspectors under `src/lib/ops/`. Their reports reuse the existing `AuditLog`; scheduled runs remain off.
- The Operations runner (`src/lib/ops/engine.ts`) is scoped to those inspectors only. The AI model gateway (`src/lib/ai/gateway.ts`) only routes provider calls. Neither is the general-purpose central AI orchestrator.
- A global agent orchestrator and one cross-module tool authorization contract are **NOT IMPLEMENTED / AUDIT REQUIRED**. Future integration must reuse the existing auth/RBAC and business isolation; it must not introduce another permission authority.
- The seven model provider adapters can be selected automatically when keys exist because `AI_PROVIDER` defaults to `auto`. The request-count budget does not enforce a euro spend ceiling. Do not claim strict €0 or activate new model routes until provider entitlements, billing behavior, and Cloudflare AI usage are verified.
- The optional Python Worker is a subordinate semantic service protected by a server-to-server token; it is not an independent agent system or orchestrator. Its Cloudflare AI binding cost must be verified before claiming €0.
- These are source-level findings only. Production secrets, live provider balances, account-wide Cloudflare usage, and current billing settings are not visible from the repository. No production configuration has been changed.
