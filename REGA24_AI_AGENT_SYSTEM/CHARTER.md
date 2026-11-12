# Permanent Charter — REGA24 AI AGENT SYSTEM

## Official identity and single source of truth
- Project: **Rega24**
- Repository: `rebar9988-max/Rega`
- Production identity: `https://www.rega24.com`
- Official central system: **REGA24 AI AGENT SYSTEM**
- Authoritative documentation directory: `REGA24_AI_AGENT_SYSTEM/`

## ABSOLUTE ARCHITECTURE RULE — ONE CENTRAL SYSTEM
Rega24 must have exactly ONE official AI architecture, ONE central AI Agent system, ONE central orchestrator, and ONE authoritative system directory. **REGA24 AI AGENT SYSTEM** is the single source of truth for all AI and Agent operations.

### Mandatory invariants
1. One central architecture only.
2. One central orchestrator only.
3. One official agent registry only: [AGENT_REGISTRY.md](AGENT_REGISTRY.md).
4. One central configuration and governance layer.
5. One centralized monitoring and reporting system.
6. One centralized AI security and permission model.
7. One centralized research and update process.
8. All specialist agents operate as coordinated modules under the central orchestrator.
9. All AI documentation, skills, workflows, and integrations must be registered in or linked from this central system.
10. Reuse existing infrastructure and implementations before adding anything.

### Prohibited duplication
Never create a second AI architecture, orchestrator, control center, independent agent system, duplicate registry, monitoring system, update engine, or competing AI directory. Before introducing an agent, framework, service, skill, or workflow, verify whether its responsibility already exists. Improve existing components inside the central architecture.

Every component must have a named owner, bounded responsibility, explicit permission boundary, and documented integration with the central system. Specialist modules are not independent systems and cannot own separate authority, governance, credentials, or control planes.

If centralization creates a technical limitation, document and evaluate it before changing the architecture. Never silently create another system. Any proposal violating this rule is REJECTED by default; if a genuine unavoidable limitation exists, mark BLOCKED and obtain explicit owner approval before any architecture change.

The central orchestrator coordinates agents but must never bypass existing Rega24 authentication, RBAC, BusinessMember isolation, or owner permissions.

## Mission
Deliver useful, reliable, accessible AI capabilities that help people find services quickly, understand information, communicate across supported languages, and trust directory information.

## Absolute operating constraints
- **€0 additional cost:** no paid APIs, paid model endpoints, subscriptions, metered services, or services requiring a credit card. Verify current terms and limits; if zero cost cannot be guaranteed, mark BLOCKED.
- Preserve existing application architecture, data, authentication/RBAC, APIs, routes, localization, RTL/LTR, and production behavior.
- No rebuild, parallel architecture, destructive database operation, breaking change, or production-impacting action without explicit approval.
- Reuse the existing AI gateway, tools, retrieval, jobs, monitoring, configuration, and shared utilities.
- Never commit secrets or private user data.
- Agents cannot elevate privileges, bypass authorization, or act as SUPER_ADMIN.
- Consequential writes, publishing, messaging, payments, account changes, and deployments require explicit authorization and existing safeguards.
- Preserve accessibility, performance, privacy, and graceful fallback.
- Report truthfully using PASS / FAIL / BLOCKED / NOT RUN with evidence.

## Required workflow
`DISCOVER → AUDIT → REGISTER → DESIGN → RISK REVIEW → IMPLEMENT (approved scope only) → TEST → REVIEW → DEPLOY (authorized only) → VERIFY → DOCUMENT`

## Required proposal record
Problem and user benefit; evidence; existing component inspected/reused; registry entry; system integration; owner; responsibility; tools and permissions; verified €0 cost; security/privacy risks; tests and acceptance criteria; rollback/disable plan; status.

## Quality rule
Aim for production-grade quality. Never claim 100/100 without acceptance evidence, relevant tests, preserved behavior, and verification in the environment where the claim is made.
