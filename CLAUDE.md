# REGA — working rules for Claude Code

These rules come from the project owner and apply to every task in this repository.

## 0. PERMANENT P0 RULE — STRICT REGA / R&L PROJECT ISOLATION

**Priority: CRITICAL — NON-NEGOTIABLE.** Owner instruction (2026-10-22). Applies to every Claude Code and Codex session and every coding workflow that loads these instructions. It adds to, and never replaces, the other rules in this file.

**REGA ≠ R&L. Never mix. Never silently switch. Always verify. Stop automatically on mismatch.**

### 0.1 Two completely independent projects
| | PROJECT A — REGA Platform | PROJECT B — R&L |
|---|---|---|
| Repository | `rebar9988-max/Rega` | `rebar9988-max/rega-cargo` |
| Production | https://www.rega24.com | https://www.rlgo.net |
| Identity | REGA Platform | R&L Marketplace & Delivery |
| Cloudflare Worker | `rega-platform` (+ `rega-ai-python`) | `rega-cargo` (+ `rega-cargo-staging`) |

**This repository is PROJECT A — REGA Platform.** The two are separate projects; never treat them as one system. Shared technologies do not imply shared project ownership.

### 0.2 Automatic project identity guard
Before any coding, editing, testing, migration, commit, PR, merge or deployment:
1. Identify the requested project.
2. Verify the Git repository owner and name.
3. Verify the Git remote URL.
4. Verify the working directory and current branch.
5. Verify the production domain and deployment configuration.
6. Confirm that every referenced PR, commit, CI run and Cloudflare resource belongs to the selected repository.
7. Read the selected project's own `CLAUDE.md`, `AGENTS.md` and `PROJECT_MEMORY.md`, where available.

Never identify a project by a PR number or CI run ID alone.

### 0.3 Automatic stop on mismatch — fail closed
If an operation intended for REGA points to R&L, or an operation intended for R&L points to REGA: **STOP IMMEDIATELY.** Do not edit files, run migrations, commit or push, merge PRs, trigger deployments, modify secrets or infrastructure, or automatically switch repositories. Display this error in Kurdish Sorani:

> هەڵەی گرنگ: پڕۆژەکان تێکەڵ بوون! REGA و R&L دوو پڕۆژەی جیاوازن. کارەکە بە خۆکار وەستێنرا بۆ پاراستنی کۆد و داتابەیس و Production. تکایە پڕۆژەی دروست دیاری بکە.

Then report the expected project, the detected project, the conflicting identifiers and any operations already performed. Resume only after explicit owner confirmation.

### 0.4 Strict isolation
Never mix or reuse between the two projects: source code and project folders; database connections and migrations; Cloudflare Workers and bindings; deployment environments; environment variables and secrets; GitHub branches, commits and PRs; CI/CD workflows and run IDs; authentication configurations; domain and routing configurations; project memory and checkpoints; design, branding and assets.

### 0.5 Enforcement in this repository
- `scripts/project-identity-guard.mjs` is a read-only, dependency-free, fail-closed check: `node scripts/project-identity-guard.mjs --project REGA [--domain …] [--worker …]`. It reads `GITHUB_REPOSITORY`, every `git remote` URL and the local `wrangler.jsonc`, exits 1 with the Sorani error above on a project mismatch, mixed repository/domain/worker identifiers, an unknown identifier, or no repository evidence, and never changes anything.
- It runs before the first production-changing step of `deploy.yml`, `db-migrate.yml`, `worker-secrets-sync.yml` and `ai-python-deploy.yml`. Run it by hand before any manual deploy, migration, secret change or merge done outside those workflows.
- `tests/project-identity-guard.test.ts` (part of `npm test`) proves the six cases in 0.7 and that each workflow runs the guard before its production step. Never weaken, skip or remove the guard, its test or these workflow steps to make another task pass.
- The same guard file lives in the R&L repository; the two copies differ only in the `LOCAL_PROJECT` line. Change the identity table only on explicit owner instruction, in both repositories.
- Not covered (environment limit): Cloudflare Workers Builds has no Actions/git context, so verify its repository connection and target Worker in Cloudflare instead.

### 0.6 Session and context safety
At the start of every new session recover the project identity from this repository and its instructions. Never assume that an earlier conversation, copied prompt, checkpoint or CI identifier belongs to this project. If a prompt contains conflicting project identifiers, stop and ask. Never silently correct a conflict by switching projects.

### 0.7 Verification matrix
REGA task in the REGA repository — ALLOW. R&L task in the R&L repository — ALLOW. REGA task in the R&L repository — BLOCK. R&L task in the REGA repository — BLOCK. Mixed repository/domain identifiers — BLOCK. Unknown or ambiguous project identity — BLOCK. A blocked run makes no production or database change: the guard runs first and edits nothing.

### 0.8 Owner-only SUPER_ADMIN and /dr sign-in (owner instructions, 2026-10-22)
- Only `rebar9988@gmail.com` may hold SUPER_ADMIN power (`SUPER_ADMIN_EMAILS` in `src/lib/rbac.ts`). `effectiveRole` turns a
  stored SUPER_ADMIN on any other address into USER at sign-in, session revalidation, every session read and in
  `currentAccount` (all privileged guards); SUPER_ADMIN cannot be given to another address in user administration.
- www.rega24.com/dr signs the owner in with a six-digit e-mail code; codes go to that address only. Widening the list
  needs a new explicit owner instruction. Details and verification evidence: `PROJECT_MEMORY.md`.

### 0.9 Permanent Cloudflare platform mandate (owner instruction, 2026-10-28)

Applies only to Rega24: `rebar9988-max/Rega`, `https://www.rega24.com`. Manage all Rega24 application infrastructure and future technical work on Cloudflare:

| Responsibility | Required platform |
| --- | --- |
| Production database | Cloudflare D1 |
| Backend and API | Cloudflare Workers |
| Files and images | Cloudflare R2 |
| Hosting and deployment | Cloudflare |
| DNS and security | Cloudflare |

Use the existing canonical Worker `rega24`, D1 database and R2 storage. GitHub remains the source-control, review and CI repository; successful checks gate deployment to Cloudflare. Do not introduce a replacement application hosting/database/storage platform or return production to Neon without a new explicit owner instruction. Retained Neon snapshots and private backups are recovery assets; this mandate does not authorize their deletion. Preserve existing functionality, project isolation and production safeguards. Treat “100/100” as a quality objective: report actual verified results and unresolved work accurately.

## 1. Foundation rule (REGA is a finished house)
- The foundation is fixed. Architecture and structure are not changed without a real reason.
- Routing and navigation are not disturbed by small requests.
- A design change must not change the system's foundation.
- Adding a feature = adding only that feature. Moving a section must not move other parts of REGA.
- Never re-design the architecture from scratch. Existing functionality must be preserved.
- Only if a fundamental change is truly necessary: first assess its impact on the foundation.

## 2. Strict task scope
- Do only what the task explicitly asks. Nothing outside its scope.
- No unrequested: refactors, database migrations or schema changes, routing/architecture changes, header/footer/
  navigation changes, design-system/typography/colour changes, new features, or clean-ups for taste.
- If another change is truly required for the task: understand why, make only that change, keep it directly tied
  to the task.
- Within the task there is professional freedom for layout, placement, spacing, alignment, sizing, responsive
  behaviour, accessibility, UX and performance, as long as REGA's visual identity, architecture and existing
  functionality are preserved.
- Flow: AUDIT -> UNDERSTAND -> CHANGE ONLY THE REQUESTED SCOPE -> TEST -> VERIFY. Report only task-related changes.

## 3. Design preservation
- REGA's visual identity is locked: colour palette, the REGA red, backgrounds, typography, Kurdish font, borders,
  radius, cards, icons, header/footer identity, buttons, navigation, spacing, light/dark mode, RTL behaviour.
- No new colours, gradients, glassmorphism, neon, generic templates or a new visual language.
- Layout/composition may be improved; identity may not.

## 4. Sequential task execution
- Several tasks in one prompt are executed in order: Task 1 -> verify -> Task 2 -> verify -> ... -> final verification.
- For each task: inspect the relevant code, implement, run the needed test/typecheck/build, verify it works, then
  continue. Do not wait for a new prompt between tasks unless explicitly told to stop.
- A directly related problem found during a task is fixed, then work continues.
- A task is never "done" before it is verified. If it truly cannot be completed, diagnose first, then report the
  task and the reason.
- Final report: completed tasks, changed files, test/build/typecheck results, incomplete tasks and why.

## 5. Safety (always)
- Never expose, print, commit or ask for secrets. Never reset, drop, truncate or delete production data.
- No fake data, fake links, invented handles, fake brand assets or placeholder icons in production.

## 6. Permanent shared project-memory workflow
Central memory document:
- **REGA — Project Memory & Documentation Hub**
- https://docs.google.com/open?id=1pp6GW-UM9AQ9TuUJHumziaujxB6ZOza5S3xwA6dmxu4

Use the connected Google Drive / Docs, GitHub, and Cloudflare together for every substantial REGA task.

Source-of-truth priority:
1. GitHub = code, branches, PRs, workflows, commits, repository configuration.
2. Cloudflare = live Worker state, routes, runtime configuration, builds and deployments.
3. Google Drive / Docs = durable decisions, architecture rules, runbooks, incident notes, blockers and continuation memory.

Mandatory flow:
READ MEMORY -> VERIFY GITHUB -> VERIFY CLOUDFLARE -> IDENTIFY ROOT CAUSE -> FIX ONLY THE RESPONSIBLE LAYER -> TEST -> VERIFY LIVE -> UPDATE MEMORY.

Rules:
- Read `PROJECT_MEMORY.md` and the central Google Doc before substantial work.
- Do not ask the owner to repeat information that already exists in Docs, GitHub or Cloudflare.
- If memory conflicts with verified GitHub or Cloudflare state, verified live state wins and memory must be corrected.
- Never store API keys, passwords, tokens, database credentials, connection strings or secret values in memory.
- Never claim a deployment, test, fix or production state that was not actually verified.
- Never change unrelated architecture, routes, domains, secrets, database configuration or production behavior.
- After every material change, update project memory with date, task, root cause, changes, tests, PR/commit, Cloudflare verification, production impact, blockers and next safe continuation point.

### Troubleshooting & continuation (owner instruction, 2026-10-15)
Applies to every Claude Code and Codex session (`AGENTS.md` points here). The central Doc above (Drive file ID
`1pp6GW-UM9AQ9TuUJHumziaujxB6ZOza5S3xwA6dmxu4`) and `PROJECT_MEMORY.md` together are the single documentation layer:
the Doc keeps the cross-tool summary and change log, the repository keeps detail. Do not create another memory system.

1. Start of each task: read this file, `PROJECT_MEMORY.md`, the relevant `docs/` files (`docs/DEPLOYMENT.md` when
   deployment is involved) and the central Doc; then inspect current GitHub and Cloudflare state before acting.
2. For any problem: check earlier notes/fixes in the Doc and repository memory -> inspect repository, PR and CI state
   in GitHub -> inspect build, deployment and runtime state in Cloudflare -> reproduce where possible -> find the real
   root cause -> fix only that layer -> run the appropriate tests -> verify the real result -> record it in the Doc
   and `PROJECT_MEMORY.md`.
3. If a source cannot be reached from the current session (no Cloudflare connector, no network access), say so and
   record it as an environment limitation, never as a code failure. Read-only fallbacks: the `Workers Builds:
   rega-platform` check run and the `Deploy to Cloudflare Workers` workflow run on a GitHub commit show build/deploy
   results; a public fetch of `https://www.rega24.com` shows the site is served. Neither proves which version
   is active at 100%; do not claim that without Cloudflare access.
4. `main` is the only production branch unless the owner explicitly changes this rule. Never bypass GitHub protection,
   required checks or production safeguards; never merge or deploy unverified changes; no speculative fixes.
5. Proceed autonomously with safe read, diagnosis, documentation and verified repair work. Ask the owner only for an
   unavoidable billing, permission, authentication, destructive or security approval.

### Infrastructure index (owner instruction, 2026-10-25)

`REGA24_SYSTEM_MAP.md` and `REGA24_TROUBLESHOOTING.md` are the infrastructure index and the failure runbook. They do
not replace this file, `PROJECT_MEMORY.md`, or the central Google Doc, and they are not a second narrative memory.
`docs/generated/system-inventory.json` is regenerated from the repository (`node scripts/generate-system-inventory.mjs`).
`node scripts/validate-system-docs.mjs` checks headings, relative links, inventory freshness, and accidental secrets.

Before architectural changes, read the system map. When diagnosing a failure, use the troubleshooting runbook and do
not repeat an investigation already recorded in PROJECT_MEMORY.md or the Google Doc. After a verified infrastructure
change, update the map and the runbook, record new dependencies and known issues, and label unverified statements as
REPORTED or UNKNOWN. Never invent system information. Never store credentials or secret values in any of these files.


### Canonical target and isolated previews — 2026-10-26

The verified existing Rega24 web Worker is `rega24` (stable tag `7b845cda2ee749c89c4f9b83490609b4`), not retired `rega-platform`. This supersedes older REGA Worker labels above; R&L identifiers are unchanged. Candidate release configuration reconciles the guard, deployment, diagnostics and runtime secret targets and adds the read-only `scripts/production-target.mjs` gate. Web releases tag their exact GitHub SHA. Branch previews are deliberately non-ready and block all application/provider/data handlers; `/__preview-health` proves isolation only. Real application/database/browser validation stays in CI with disposable PostgreSQL. Never mistake a green preview upload for a production-ready app. No automatic Neon resource creation/deletion is needed for these PR tests.

## 7. Master Engineering & Token Efficiency Directive (owner instruction, 2026-11-04)

Applies to every Claude Code (and Codex) session working in this repository. Adds to, and never replaces, sections 0–6 above; where it repeats an existing rule, the existing rule still governs.

### 7.1 Non-negotiable rules
1. Never rebuild Rega24 from scratch. Never replace the existing architecture or create a duplicate system.
2. Preserve existing code, database, authentication, RBAC, APIs, routes, services, localization, and RTL/LTR support, and existing production behavior.
3. Audit first. Read only files directly relevant to the requested task. Never scan or reread the entire repository without a proven technical necessity.
4. Use targeted searches, existing documentation, verified findings, and the smallest relevant code sections.
5. Minimize token consumption: avoid unnecessary explanations, repeated context, duplicate tool calls, lengthy reports, and irrelevant reasoning output.
6. Work incrementally. Make the smallest safe change that completely solves the requested problem.
7. Stay strictly within the requested scope. No unrelated refactoring, redesign, feature expansion, or speculative implementation.
8. Reuse existing components, utilities, APIs, services, infrastructure, agents, skills, and configurations. Do not create duplicates.
9. Never invent project status, test results, file contents, deployment results, or technical evidence.
10. Never perform destructive migrations, delete data, expose secrets, alter production infrastructure, or make risky production changes without explicit authorization.
11. Maintain Rega24's €0 additional-cost policy. Prefer existing infrastructure and free services. No paid APIs, subscriptions, or services without explicit approval. (Consistent with the owner's standing zero-additional-cost rule.)
12. Keep all live payment, billing, advertising, and monetization functionality disabled unless explicitly authorized by the project owner.
13. Preserve the official Rega24 identity, existing design system, localization, and user experience (see section 3, Design preservation).
14. Do not stop at analysis when implementation is clearly requested and safely possible. Implement, verify, and report.
15. If a critical blocker, missing permission, or safety risk prevents progress, stop only the affected action and report the exact blocker. Never fabricate a workaround.

### 7.2 Execution protocol
**Phase 1 — Targeted audit:** identify the exact requested outcome; inspect the minimum relevant files and existing implementation; determine the root cause using evidence; identify the smallest safe implementation; do not produce a lengthy audit report.

**Phase 2 — Implementation:** modify only necessary files; reuse existing patterns and architecture; avoid duplicate logic, unnecessary dependencies, and speculative code; preserve backward compatibility and existing behavior; do not make unrelated changes.

**Phase 3 — Verification:** run the most relevant available tests and checks using existing test infrastructure; verify the actual changed behavior; check for regressions within the affected scope; do not claim success without evidence; do not rerun successful checks without a technical reason.

**Phase 4 — Completion:** review the final diff; remove accidental or unrelated changes; confirm the requested outcome is achieved; report only verified results.

### 7.3 Token optimization
Minimum necessary context, minimum relevant file reads, minimum safe code changes, minimum tool calls, maximum reuse of verified information, maximum relevant test coverage, no unnecessary long-form output — without sacrificing correctness, security, reliability, or verification.

### 7.4 Quality standard
Target production-grade quality across: correctness, security, reliability, maintainability, performance, accessibility, localization, compatibility, testability, zero unnecessary complexity. "100/100" is a quality target, not permission to claim perfection without evidence (consistent with section 0.9's reporting standard).

### 7.5 Final response format
For tasks run under this directive, close with:
```
STATUS: PASS / FAIL / BLOCKED
IMPLEMENTED:
- Briefly state what changed.
VERIFICATION:
- List actual tests and results.
REMAINING:
- List only unresolved issues or blockers. Write NONE when no known issues remain.
```
Keep this concise — no lengthy explanations unless explicitly requested.

### 7.6 Final authority
The existing Rega24 system is the source of truth. Preserve it, understand it, improve it incrementally. Never rebuild it from scratch, never invent facts, never expand scope without authorization, never waste tokens on unnecessary work.

## 8. CI-gated merge & deploy autonomy (owner instruction, 2026-11-05)

Applies only to this repository. Adds to sections 0–7 above; any conflict with them is resolved in their favor.

1. May create and merge its own PRs, and deploy via the existing Cloudflare pipeline (0.9), without stopping for routine approval, once every required CI check (including the 0.5 identity guard) is green. Never bypass branch protection or a required check to force this.
2. Verify deployment and production health with real evidence after any deploy; never claim success without it.
3. Does not loosen section 3 (Design preservation) — REGA's locked visual identity still needs explicit owner approval for any change. This autonomy covers section 2's existing freedom for layout, spacing, responsiveness, accessibility, UX and performance, not colour, branding or typography.
4. Section 5 and 7.1.10–7.1.12 (destructive operations, secrets, zero-cost policy, billing/payments) still require explicit owner approval and still stop automatic merge/deploy.
5. The 0.3 fail-closed identity-mismatch stop still applies and overrides this section.
