# REGA24 — Codex agent instructions

Shared REGA project rules live in [CLAUDE.md](CLAUDE.md) and apply to every agent (Codex, Claude Code and others),
including section 6: the permanent shared project-memory and troubleshooting workflow.

**P0 — REGA ≠ R&L (CLAUDE.md section 0):** this repository is REGA Platform (`rebar9988-max/Rega`, https://www.rega24.com).
R&L (`rebar9988-max/rega-cargo`, https://www.rlgo.net) is a different project. Verify repository, remote, branch and
domain before any edit, migration, commit, merge or deployment (`node scripts/project-identity-guard.mjs --project REGA`),
and STOP on any mismatch. Never mix, never silently switch.

Before any substantial task read, in order:
1. [CLAUDE.md](CLAUDE.md)
2. [PROJECT_MEMORY.md](PROJECT_MEMORY.md)
3. The central Google Doc "REGA — Project Memory & Documentation Hub"
   (https://docs.google.com/open?id=1pp6GW-UM9AQ9TuUJHumziaujxB6ZOza5S3xwA6dmxu4)

Then verify current GitHub and Cloudflare state before acting. Keep shared rules in CLAUDE.md;
the owner’s Codex execution directive below supplements them without duplicating them.

## Infrastructure map (required)

[REGA24_SYSTEM_MAP.md](REGA24_SYSTEM_MAP.md) is the infrastructure index.
[REGA24_TROUBLESHOOTING.md](REGA24_TROUBLESHOOTING.md) is the runbook.
They do not replace CLAUDE.md, PROJECT_MEMORY.md, or the Google Doc.

Every coding agent must:

- Read [REGA24_SYSTEM_MAP.md](REGA24_SYSTEM_MAP.md) before architectural changes.
- Consult [REGA24_TROUBLESHOOTING.md](REGA24_TROUBLESHOOTING.md) when diagnosing failures.
- Update both files after verified infrastructure changes.
- Record new dependencies and known issues.
- Avoid repeating completed investigations. Check PROJECT_MEMORY.md and the Google Doc first.
- Never invent system information. Label anything not re-checked as REPORTED or UNKNOWN.
- Never store credentials, tokens, passwords, or connection strings in documentation.

Refresh the generated inventory with `node scripts/generate-system-inventory.mjs` and check links with
`node scripts/validate-system-docs.mjs`. CI runs the checker. A documentation-only commit on `main` must not
replace the production Worker (`DOCS_ONLY_SKIP` in `.github/workflows/deploy.yml`).

## Codex master engineering & autonomous execution directive — 2026-11-05

This root AGENTS.md is the persistent Codex entry point for `rebar9988-max/Rega`
(https://www.rega24.com). Preserve CLAUDE.md and its useful shared instructions.
The owner's current task instructions govern where they explicitly update older
owner preferences; higher-priority security rules, repository permissions, required
reviews and branch protections always apply.

### Preservation and cost

Apply CLAUDE.md sections 0–3 and 7–8: never rebuild or replace the architecture,
create duplicate systems, or mix projects. Preserve existing data, D1 schemas,
APIs, routes, authentication, RBAC, services, localization, RTL/LTR, production
behavior, and official Rega24 name, logo and design foundation. No destructive
database operations, unauthorized infrastructure changes, or secret exposure.
Existing repository and verified production configuration are the source of truth.

Additional budget is €0. Use existing infrastructure; verify free-tier limits
before enabling integrations and leave them disabled if zero additional cost
cannot be established. No paid resources, upgrades, billable AI, unexpected costs,
or uncontrolled background workloads. Payments, billing, advertising and
monetization remain disabled without explicit owner authorization.

### Autonomous delivery

The owner authorizes routine, safe work within the requested scope and existing
permissions: inspect, diagnose, implement the smallest compatible fix, verify,
review the diff, commit, push an isolated branch, open/update its PR, monitor CI,
and resolve genuine failures. Merge only after all required checks pass and
repository protections and required reviews permit it. Deploy only through an
already authorized, established workflow; verify production when accessible.
This is standing authorization for those routine actions, including established
deployment workflows, under CLAUDE.md section 8.5; it grants no infrastructure,
security, data destruction or financial exception. Documentation-only delivery
must retain the existing DOCS_ONLY_SKIP behavior.

Do not stop at analysis when safe implementation is possible, or ask repeatedly
for routine decisions already authorized. Continue other safe work if one action
is blocked. Request intervention only for missing permissions, an unresolved
instruction conflict, an explicitly required human approval, additional cost,
or destructive, irreversible or security-sensitive actions outside authorization.
Never bypass CI, security checks, branch protections or required reviews.

### Focused execution and evidence

Follow CLAUDE.md sections 4, 6 and 7 for audit, memory, implementation and checks.
Search exact paths/symbols first; read the smallest relevant sections, reuse
verified findings, and avoid full scans, repeated reads/calls, unnecessary
dependencies and unrelated refactors. Keep planning and progress reports concise.
Use available skills or independent parallel work only when they provide measurable
value; avoid overlapping edits, duplicate agents and unnecessary orchestration.

Use existing tooling for the smallest sufficient local verification: relevant
TypeScript, lint, unit/integration/E2E, build, security, accessibility and RTL/LTR
checks as applicable; complete required repository CI. Never weaken checks or
rerun successful checks without a technical reason. On failure inspect the actual
error, fix its root cause safely, and rerun affected verification; do not repeat
an unchanged failing command or fabricate a workaround. Review the final diff
and remove accidental changes before delivery. Do not declare completion while
required delivery remains unfinished; report the exact blocker instead.

Target production-grade correctness, security, reliability, maintainability,
performance, accessibility, localization, compatibility, testability, operational
safety and cost efficiency. 100/100 is an objective, never an unverified claim.
Never mark unexecuted checks as passed or invent CI, merge or deployment evidence.

### Final response

Use only this concise, evidence-based format (the owner's current Codex format
supersedes older final-report length preferences):

```text
STATUS: PASS / FAIL / BLOCKED

IMPLEMENTED:
- Actual completed changes.

VERIFICATION:
- Checks actually executed; CI, merge and deployment results where applicable.

REMAINING:
- Only unresolved issues, or NONE.
```
