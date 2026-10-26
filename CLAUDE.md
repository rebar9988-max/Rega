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
| Cloudflare Worker | `rega24` (+ `rega-ai-python`) | `rega-cargo` (+ `rega-cargo-staging`) |

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
- The guard also exists in the separate R&L repository. This REGA copy now recognizes the verified `rega24` production name under the owner’s consolidation instruction; the R&L repository and its resources must not be edited. Preserve the R&L identity entries and all isolation cases.
- Not covered (environment limit): Cloudflare Workers Builds has no Actions/git context, so verify its repository connection and target Worker in Cloudflare instead.

### 0.6 Session and context safety
At the start of every new session recover the project identity from this repository and its instructions. Never assume that an earlier conversation, copied prompt, checkpoint or CI identifier belongs to this project. If a prompt contains conflicting project identifiers, stop and ask. Never silently correct a conflict by switching projects.

### 0.7 Verification matrix
REGA task in the REGA repository — ALLOW. R&L task in the R&L repository — ALLOW. REGA task in the R&L repository — BLOCK. R&L task in the REGA repository — BLOCK. Mixed repository/domain identifiers — BLOCK. Unknown or ambiguous project identity — BLOCK. A blocked run makes no production or database change: the guard runs first and edits nothing.

### 0.8 Owner-only SUPER_ADMIN and /admin sign-in (owner instructions, 2026-10-22)
- Only `rebar9988@gmail.com` may hold SUPER_ADMIN power (`SUPER_ADMIN_EMAILS` in `src/lib/rbac.ts`). `effectiveRole` turns a
  stored SUPER_ADMIN on any other address into USER at sign-in, session revalidation, every session read and in
  `currentAccount` (all privileged guards); SUPER_ADMIN cannot be given to another address in user administration.
- www.rega24.com/admin signs the owner in with a six-digit e-mail code; codes go to that address only. Widening the list
  needs a new explicit owner instruction. Details and verification evidence: `PROJECT_MEMORY.md`.

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


### REGA24 technical documentation (2026-10-25)

The repository technical reference is [REGA24_SYSTEM_MAP.md](REGA24_SYSTEM_MAP.md); the operational runbook is
[REGA24_TROUBLESHOOTING.md](REGA24_TROUBLESHOOTING.md). They extend the existing documentation layer in section 6;
they do not replace the central memory hub or past decisions.

- Every coding agent reads the system map before architectural changes and consults the runbook for failures.
- After verified infrastructure changes, update BOTH documents with dated evidence, new dependencies, affected
  source/config locations and known issues. Keep VERIFIED repository, VERIFIED live, REPORTED and UNKNOWN distinct.
- Reuse prior completed investigations; repeat only when new evidence or changed assumptions require it.
- Never invent system information or claim external verification without actual access. Never store credentials,
  secret values, connection strings, cookies, signed URLs or OTPs in documentation or generated inventories.
- The generated [inventory](docs/REGA24_INVENTORY.md) is derived from tracked source/configuration; review changes,
  stage new source files, regenerate with `node scripts/rega24-docs.mjs --write`, then run
  `node scripts/rega24-docs.mjs --check`. This checks source drift, local links/anchors and required structure offline;
  external links/live freshness need separate evidence. PR validation has no secrets, deployment or new services.
- A documentation commit does not justify production deployment. Main CI can trigger deployment even for docs;
  use a documentation branch and do not push/merge main merely to publish the technical reference.


### Rega24 unified office continuation (2026-10-25)

Official product identity is Rega24; the package remains rega-platform. Live web Worker is rega24 (verified 2026-10-26); the old rega-platform endpoint is absent. Its stable resource tag is declared in the manifest.
Canonical office is `/admin`, with one implementation in `src/app/admin`; `/dr` is legacy redirect only. Preserve
owner-only SUPER_ADMIN and existing role/membership restrictions. Non-secret production identity/ownership comes
from `src/config/project.json`; secrets remain protected provider configuration. Both release paths must verify
successful main CI for their exact SHA, including manual fallback. Never publish test-only mocked-font artifacts.
Read [consolidation acceptance](docs/REGA24_CONSOLIDATION.md) and latest central-memory release holds before release.

The main-branch infrastructure-index instructions from 7011eb5 are preserved: docs are an index/runbook, not a
second narrative memory; generated JSON at `docs/generated/system-inventory.json` and Markdown are views produced
by the same canonical generator. Legacy generate/validate commands remain wrappers; CI checks links, structure,
freshness and common accidental-secret patterns. Documentation-only commits skip Worker deployment.

Before any release or runtime secret sync, `scripts/production-target.mjs` must read back the existing Worker tag and both official custom domains. Missing resources, permission failures or ownership drift block all mutations; never recreate a retired Worker. Neon previews require the `neon-preview` PR label and verified Free quota; ordinary CI uses disposable Postgres.
