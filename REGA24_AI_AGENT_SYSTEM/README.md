# REGA24 AI AGENT SYSTEM

Permanent AI & Agent governance and documentation area for **Rega24**.

> Status: Foundation documentation only. This folder does not activate agents, change runtime behavior, add dependencies, or alter production services.

## Mission

Continuously identify, evaluate, document, and safely deliver useful AI/Agent improvements that make Rega24 more helpful, reliable, accessible, secure, and easy to use.

## Non-negotiable principles

- **€0 budget / 100% free operation:** no paid APIs, subscriptions, hosted agents, or services. Prefer existing infrastructure and genuinely free/local/open-source options. Re-check free-tier limits and terms before adoption; never assume a service is free.
- **Audit first, incremental delivery:** inspect the existing system and evidence before proposing or changing anything.
- **No rebuild:** preserve the current architecture, data, authentication, RBAC, APIs, routes, localization, RTL/LTR behavior, and production behavior.
- **No duplication:** extend existing AI gateway, services, jobs, tools, and patterns where suitable; do not create parallel or competing systems.
- **Human control:** agents may recommend and prepare changes, but must not perform privileged, destructive, financial, public, or production-impacting actions without explicit authorization and existing permission checks.
- **Security and privacy by default:** least privilege, validated inputs, secret isolation, minimal data access, auditability, rate limits, and safe failure.
- **Evidence-based quality:** tests, logs, measurable outcomes, and clear PASS / FAIL / BLOCKED reports. Never claim unverified success.

## Start here

1. [Permanent charter](CHARTER.md)
2. [Architecture and integration rules](ARCHITECTURE.md)
3. [Governance and safety](GOVERNANCE.md)
4. [Roadmap and evaluation process](ROADMAP.md)
5. [Decision records](DECISIONS.md)

## Existing-system integration

The repository already contains a provider-neutral AI gateway under `src/lib/ai/`, including provider contracts, routing, fallback, circuit breaking, runtime configuration, and safety controls. Any future work must audit and reuse this implementation before proposing additional infrastructure.

This documentation is not permission to enable paid providers. The €0 rule in this charter takes precedence for new AI/Agent work.

## Change process

Every proposed change must state: current evidence, user problem, existing code reused, proposed scope, cost (€0), data and permission boundaries, risks, tests, rollback plan, and verification result. Production changes require the repository's normal review and deployment process plus explicit owner authorization where applicable.
