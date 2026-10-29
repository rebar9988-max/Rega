# Rega24 engineering automation

Scope: `rebar9988-max/Rega`, `www.rega24.com`, Worker `rega24`. No replacement platform, new service, dependency, production data write or AI API. These are persistent GitHub workflows and a supported-session Codex handoff, not permanent chat agents. The existing owner-only `/dr/operations` inspectors remain a separate product feature; they do not execute repository repairs.

## Responsibilities

| Role | Responsibility / evidence |
| --- | --- |
| AGENT01 Orchestrator | Existing CI dependencies; serialized Engineering health; recovery queue issue; one branch per failed run |
| AGENT02 Software | Supported Codex session: reproduce, smallest verified fix, dedicated PR |
| AGENT03 UI/UX | Existing desktop/mobile, accessibility, eleven-locale RTL/LTR Playwright checks; inspect screenshots when relevant |
| AGENT04 QA | Existing unit/integration/D1/dual-provider browser/workerd suites; never weaken assertions |
| AGENT05 Security | Existing npm audit, weekly lockfile audit, owner authorization tests; security review of changes |
| AGENT06 DevOps | workflow_run failure evidence, latest 100 main-run reliability sample, post-deploy D1 health |
| AGENT07 Database | Existing local D1 compatibility/atomicity/data preservation checks; remote migration remains manual and approval gated |
| AGENT08 Performance | Existing browser checks; targeted measurements in Codex session. Field Core Web Vitals are UNKNOWN unless measured |
| AGENT09 Reporting | Sorani Actions summary and stable recovery queue; source run links, explicit blockers |

Only create parallel Codex agents when the supported session has capacity. Give each a separate worktree or disjoint files; one orchestrator commits. Roles do not imply nine paid background AI invocations.

## Triggers

- Existing `CI`: PR, push to main, manual full validation (unit, integration, D1, Python, lint, typecheck, two browser providers, Node/Worker builds and runtime smokes). No duplicate E2E pipeline.
- Existing deploy: exact-main green push CI gate. No new deploy/migration/secret-sync trigger.
- `Engineering health`: Monday 06:43 UTC and manual default-branch dispatch: docs integrity, automation behavioral tests, lockfile security audit, CI reliability sample and branch-protection status. GitHub schedules may be delayed or disabled by inactivity; no continuous availability guarantee.
- `Engineering health`: completion of CI, web deploy, Beta health or production browser: failures/timeouts enter bounded triage; successful main web deploy gets one public read-only D1 readiness request after completion. Preview success is never production proof; this health request does not attest the live version SHA.
- Engineering health failures remain visible as native red Actions runs and weekly main-run reconciliation; GitHub forbids a workflow listening to itself. No self-listener or retry loop is configured.

## Bounded recovery and resume

The trusted default-branch collector reads at most 100 jobs, three failed-job logs (classification examines first 1 MB each), 100 open bot issues and 100 open PRs. API log responses are downloaded by Octokit before truncation; large logs remain bounded by the five-minute job timeout. It never prints/copies raw logs, arbitrary names or instructions from them. Classifications are heuristics, not verified root causes. Missing log access is explicit. There are no workflow reruns, external AI calls, artifact downloads, PR checkout, executable failure content or automatic code writes in this privileged collector.

A serialized, stable bot issue appends incident evidence without replacing unresolved history. At 50,000 characters it fails closed for manual archival. Global concurrency can replace pending runs; weekly reconciliation recovers failures in the latest 100 main runs. Failures outside that bounded window need operator review. Repeated delivery of the same run is a no-op. Existing assignees retain ownership. A full first page may miss an older queue/PR: reported lookup is bounded, not exhaustive. No automatic repair starts without a verified cause.

Supported Codex continuation (the owner authorized safe repairs, not automatic merge):

1. Read repository instructions and central memory, run identity guard and inspect the source run and logs. QUOTA_STOP: stop affected work and report; no paid fallback.
2. Read the recovery issue/assignee and search all open PRs for `automation/recovery-<run-id>`. Resume that branch/PR if it exists; otherwise claim the issue and create the branch from fresh main. Do not compete with an assigned operator.
3. Reproduce with disposable local fixtures. If cause cannot be verified, record BLOCKED; do not patch speculatively. Check auth, owner-only rights, branding, all locales and D1 integrity as relevant.
4. Apply one minimal safe correction. Run relevant tests, then existing required gates. Open/update a dedicated PR with exact evidence and remaining blockers. Never push directly to main or bypass protection.
5. Verify CI on the exact PR SHA; do not infer success from an older commit. At most one correction attempt per incident per session, then report unresolved cause rather than looping. A rerun is permitted only for a verified transient failure and within free quota.
6. Update the queue and project memory. Human review/merge and existing production approvals remain. After authorized deploy, verify actual Cloudflare version/traffic and public health/browser behavior; keep preceding D1-compatible version for rollback. Database rollback requires approved backup/reconciliation, never an old blind import.

No unattended general-purpose code-repair service is enabled: there is no verified free Codex background execution entitlement or configured credential. This is an explicit blocker to fully autonomous arbitrary repair, not a paid fallback. GITHUB_TOKEN-created PRs normally do not trigger PR CI; this collector does not create them or claim they are validated. Supported-session PRs use the existing user connector and normal CI.

## Zero cost and safety

Verified 2026-10-29: repository public; new jobs hardcode standard `ubuntu-24.04`, public-only exact-repository checks, timeouts of five/ten minutes, one concurrency group, zero AI/provider secrets, zero new cache/artifact storage. The public standard runner does not consume private included minutes. No service/plan/billing changes were performed. Existing account-wide billing configuration and Codex remaining entitlement are not exposed by this session; they are UNKNOWN. Do not represent that as an audited invoice. If visibility becomes private, these new jobs skip before runner allocation; do not enable private/larger runners without verified free allowance and a hard zero-spend cap.

Existing workflows and application provider configuration are preserved. No automatic secret rotation, deployment, merge, migration or branch-protection edit. Main was observed unprotected; owner security review is needed to enforce required checks. Existing Python deployment path and health/deploy race are pre-existing risks, not silently rewritten by this task.

Rollback: revert the automation PR through normal review; disable Engineering health in GitHub for an incident. No data restore is needed for these repository-only changes. A workflow-file merge may cause the existing deployment scope to rebuild the unchanged app; this PR is not merged automatically.

## Verification

Run `node --test scripts/automation/*.test.mjs`, `node scripts/validate-system-docs.mjs`, existing `npm test` and `npm run test:d1`. Hosted `CI` remains authoritative for full builds and E2E. Schedule/workflow_run become active only after merge to the default branch; mocked behavior and YAML validation alone do not prove live event delivery. Manual dispatch also requires the workflow on main. Report this activation gate explicitly.
