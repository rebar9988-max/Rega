# Permanent Charter — REGA24 AI AGENT SYSTEM

## Identity

- Project: **Rega24**
- Repository: `rebar9988-max/Rega`
- Production identity: `https://www.rega24.com`
- This folder is the permanent home for AI & Agent principles, architecture notes, evaluations, decisions, and progress records.

## Mission

Make Rega24 progressively more useful through safe, practical AI and agent capabilities. Prioritize improvements that help people find services quickly, understand information, communicate across supported languages, and trust the accuracy of directory information.

## Absolute constraints

1. **Zero budget:** target and maintain €0 additional spend. Do not introduce paid APIs, paid model endpoints, subscriptions, metered services, or services that require a credit card. If a free tier has quotas, expiry, or changing terms, document them and design graceful degradation. If €0 cannot be guaranteed, mark the proposal BLOCKED and ask the owner.
2. **Preserve the existing platform:** no rewrite, rebuild, framework replacement, broad refactor, or parallel architecture.
3. **Preserve data and behavior:** no destructive database operations, data loss, breaking API changes, route changes, auth/RBAC weakening, or production behavior changes without explicit approval.
4. **Reuse before adding:** inspect existing AI gateway, retrieval, providers, rate limits, audit logs, feature flags, scheduled jobs, and shared utilities before creating anything.
5. **No secrets in source:** never commit API keys, tokens, credentials, private user data, or production environment values.
6. **No autonomous privilege escalation:** agents cannot grant roles, bypass authorization, access another business's private data, or act as SUPER_ADMIN.
7. **No unapproved external actions:** no publishing, messaging, payments, account changes, destructive operations, or production deployment without explicit authorization and existing safeguards.
8. **Localization is mandatory:** preserve all existing locales, translation workflows, script handling, and RTL/LTR behavior. Do not hardcode user-facing language.
9. **Accessibility and performance:** maintain keyboard access, semantic UI, responsive behavior, low latency, and graceful behavior when AI is unavailable.
10. **Truthful reporting:** distinguish implemented, tested, deployed, and production-verified states. Use PASS / FAIL / BLOCKED with evidence.

## Operating sequence

`DISCOVER → AUDIT → DEFINE → DESIGN → RISK REVIEW → IMPLEMENT (approved scope only) → TEST → REVIEW → DEPLOY (authorized only) → VERIFY → DOCUMENT`

## Required proposal template

- Problem and user benefit
- Evidence and current behavior
- Existing modules inspected and reused
- Proposed minimal change
- Why an agent is needed (or why deterministic code is better)
- Estimated cost: must be €0
- Data accessed and permission boundary
- Security, privacy, abuse, and failure analysis
- Tests and measurable acceptance criteria
- Rollback / disable strategy
- Status: PASS / FAIL / BLOCKED

## Quality target

Aim for production-grade quality, not a numerical promise. A feature is not 100/100 merely because code was written. It must meet documented acceptance criteria, pass relevant tests, preserve existing behavior, and be verified in the environment where it is claimed to work.
