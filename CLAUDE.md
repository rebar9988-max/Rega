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

### PR71 D1 continuation — 2026-10-29

PR71 now prepares its existing social feature against current Cloudflare D1 main. Use0004_business_social_links.sql
for activeD1;the PostgreSQL migration is rollback-provider coverage only. Preserve applied0001–0003 and current
D1 transaction/release/identity guards. Native D1 and both-provider browser checks must certify the new head.
Synthetic37table migration/restore rehearsal passed;fresh private PRODUCTION D1 backup+isolated restore and old
provider-key revocation remain unverified. No production migration/merge/deploy is authorized before those gates.
Detailed evidence and continuation are in PROJECT_MEMORY.md;no100/100 claim.

PR71 source5f686373 has ordinaryCloudflare webbuild53d52ae8 PASS and correctednativePythonPreviewbuildc72a23d1 PASS. Its existingPythonPreviewsettings were repaired withoutproductionchanges. FullGitHubActions remainsunstarted/networkblocked;scoped18filelint/syntax and syntheticSQLitechecks do not replaceCI. FreshactiveD1backup+isolatedrestore andproviderrevocation remainrequired before0004/merge/deploy. SeePROJECT_MEMORY.md.


### PR71 verified checkpoint — 2026-10-29
Exact c459 CI40845649200 passed 396 unit/integration +11 native D1 +8 Python +415 D1/415 PG browser tests and44 axe analyses with0 violations/incomplete. Main b3ac504 brand changes must remain intact; the reconciled source and invalid-form axe assertion need fresh CI. Release remains BLOCKED: fresh D1 export download is denied by managed network policy, isolated restore is not verified, and historical provider-key revocation is not verified. No PR71 production migration/main merge/deployment has occurred. Preserve canonical rega24, active D1 binding, domains and corrected isolated Python Preview settings. Never treat historical Neon copies as a fresh active-D1 backup.


### PR71 continuation gates — 2026-10-29 15:05 UTC (supersedes earlier pending notes)
Exact6830 CI40874885167 passed396 unit/integration +11 nativeD1 +8 Python +423 D1/423 PG browser cases;46 axe analyses0 violations/incomplete; lint, TypeScript, audit0 and standard Node/Worker/workerd checks PASS. Preserve approved main ec162ff and ops translations while reconciling only scoped social keys; new-head CI remains mandatory.
Owner confirmed both old provider keys revoked/replaced (OWNER-ATTESTED, no independent provider audit). Fresh private same-account D1 logical backup and separate restore at13:10:32UTC verified41 tables/2513rows/259 schemaobjects, exacttypedhashes/schema/indexes/triggers/sequences,FK0,quick_checkOK. Full integrity_check is unsupported in D1; not claimed. Retain copies0a0dd3d4-899f-427e-9b79-8d1157b29ce0 and63f99c1e-b559-47b1-b813-b8a401f09acc; no app bindings.
Readback found social0004 already applied at12:58:35 and unrelated0005 at13:02:46 by another operation. Do not replay migrations. Our backup is POST-migration; pre-migration backup/restore provenance remains NOT VERIFIED and release stays on hold pending that evidence. PR71 is not merged/deployed; current production tag ec162ff is unrelated main release. See recovery evidence and PROJECT_MEMORY; do not report100/100 or live feature verification.

Concurrent-migration provenance follow-up: PR100 explicitly records owner-authorized production0004 at12:58UTC and the same four columns/byte-identical legacyPG migration. Its description and branch memory do NOT provide a verified pre-migration backup/restore certificate. Treat this as identified reported provenance, not backup proof. PR100 also overlaps the same existing BusinessForm/social pipeline; do not import its unmerged redesign or introduce duplicate validators/sections in PR71. Preserve its work and require one shared contract when that separate PR is integrated.


PR71 P0 security follow-up2026-10-29: read-only audit found existing PR82's pytest temporary-directory vulnerability fix and strict Python audit still absent from main. Reuse its exact minimal fix (pytest>=9.0.3,<10 and uv pip-audit --strict after Python tests), preserving every other CI gate. Historical npm audit0 did not cover Python; the new head must pass the actual strict Python audit, all8 Python tests and the full application gates. This is a test/development dependency fix, not a provider/runtime/database or paid-service change. Do not claim Python security PASS before the new hosted result. PR82's historical patch/report is reused; its old main/workflow is not imported.


PR71 ownership P0 remediation (2026-10-29): independent QA found the existing omitted-id create dedup path selected a recent creator draft without active-membership authorization; its post-save membership upsert could reactivate a revoked creator. Reuse the existing transaction-aware assertBusinessAccess after target resolution/locking for BOTH explicit and deduplicated ids. Create first ownership membership inside the same transaction as a NEW business, and remove the action's post-commit membership regrant. Preserve existing global staff policy. Add real nativeD1 concurrent-create/denied-save/no-regrant/staff regressions and dual-provider browser server-action denial/positive dedup checks. Existing publish/rollback tests declare their intended MANAGER actor. No production data changed. Current13c CI already passed Python/npm audits, unit/nativeD1, lint/typecheck and Node build, but this new authorization change requires a complete fresh run; no final PASS claimed yet.

PR71 CI40902035428 correctly failed nativeD1 imports: the new ownership guard imported HttpError via the session helper, which brought Next navigation/React client context into standalone react-server tests. Move the exact existing HttpError class to a pure module and re-export it from auth-helpers, preserving class identity, status/code and every existing caller. Business access and the native test use that pure import. No assertion, condition, runtime auth rule or CI gate is removed; rerun the complete checks.
