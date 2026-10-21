# REGA — working rules for Claude Code

These rules come from the project owner and apply to every task in this repository.

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
   results; a public fetch of `https://www.regaplatform.com` shows the site is served. Neither proves which version
   is active at 100%; do not claim that without Cloudflare access.
4. `main` is the only production branch unless the owner explicitly changes this rule. Never bypass GitHub protection,
   required checks or production safeguards; never merge or deploy unverified changes; no speculative fixes.
5. Proceed autonomously with safe read, diagnosis, documentation and verified repair work. Ask the owner only for an
   unavoidable billing, permission, authentication, destructive or security approval.


## Autonomous work and recovery protocol — owner instruction 2026-10-21
This section implements the owner's permanent protocol. It supersedes earlier permission for discretionary layout/composition changes and the earlier prohibition on additional checkpoint files; all unrelated instructions remain intact.

- Operate autonomously within the current assigned scope through investigation, implementation, debugging, relevant regression tests, validation, commit/push, existing PR/CI gates, authorized deployment and live verification. Avoid routine confirmation requests. RESUME, NEVER RESTART completed work.
- Scope is an absolute maximum: no unrequested features, unrelated refactors/modules/tables, rebuilds, business-policy changes, other repositories, unnecessary architecture changes or paid services. Document out-of-scope findings without changing them.
- STRICT DESIGN FREEZE: no changes to colors/tokens, logos/assets, fonts, layout/spacing, header/footer/navigation appearance, backgrounds/gradients/animations, components, responsive behavior or design system unless the current task explicitly authorizes those particular properties. Technical improvements are not design permission. Preserve desktop/mobile identity.
- Read AGENTS.md, CLAUDE.md, PROJECT_MEMORY.md, WORK_PROGRESS.md and the latest valid TASK_CHECKPOINT.json at session start. Read the central memory as already required. Inspect Git status, remote branches, open PRs and current production state; reconcile other sessions before selecting the first unfinished action. Never infer current state from stale memory.
- AGENTS.md holds operational entry rules; CLAUDE.md retains project instructions; PROJECT_MEMORY.md records verified context; WORK_PROGRESS.md records human-readable execution state; TASK_CHECKPOINT.json records machine-readable recovery state. Preserve unrelated content. Update after each meaningful milestone and before anticipated handoff.
- Checkpoints must contain repository/branch, assigned task/authorized scope, completed/remaining work, execution stage, last successful command, failed commands and root causes, changed files, verified commit SHA, PR status, tests/build, deployment, live verification, blockers and the exact next executable action. Distinguish verified facts from historical reports and unknowns. Write JSON through a temporary file and atomic rename where possible. Never store credentials, tokens, secrets or sensitive personal data.
- Execution loop: load rules/checkpoint -> verify state -> select unfinished action -> implement within scope -> validate/test -> fix recoverable failures -> checkpoint -> commit/push -> verify CI -> authorized production deployment -> verify actual live site -> final checkpoint. Use bounded retries/backoff, never infinite retries. Reconcile remote outcomes after interruption before repeating a command.
- Follow existing architecture and free infrastructure; prefer minimal maintainable secure changes and existing dependencies. Preserve functionality/backward compatibility; validate necessary migrations; add appropriate regression coverage and relevant accessibility/performance checks.
- Inspect branches/PRs before editing. Run relevant tests, lint, typecheck and production build for code changes. Follow existing checks/protection; merge only with authorization and satisfied policy. Never force-push, bypass checks/security/access restrictions, or destructively modify production data without specific authorization.
- Live verification must establish production domain, expected revision, relevant routes/APIs/core behavior, database compatibility, affected authentication, mobile/desktop regressions and absence of unauthorized visual changes. A build is not deployment evidence. Never fabricate success.
- If blocked by missing authorization, credentials, mandatory approval or inaccessible services, stop only affected operations, finish other safe scoped work, record BLOCKED plus exact recovery action. Do not ask the owner to repeat known context or perform routine engineering tasks.
- Before context/session handoff save verified progress and unfinished operations, preserve branch, commit safe work when appropriate and record exact next command. A stopped runtime requires an available external runner/scheduler to restart it; checkpoint files do not run an inactive agent. Never claim an unconfigured runner exists.
- COMPLETE requires all assigned requirements, relevant tests/build/CI, committed changes, authorized deployment and successful live verification with updated memory and no in-scope blockers. Otherwise report actual stage or BLOCKED, never false completion.
