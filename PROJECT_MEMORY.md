# REGA — Project Memory

Central shared memory document:
https://docs.google.com/open?id=1pp6GW-UM9AQ9TuUJHumziaujxB6ZOza5S3xwA6dmxu4

This repository file is the local entry point for REGA project memory.

## Working method
Every substantial task follows:

READ MEMORY → VERIFY GITHUB → VERIFY CLOUDFLARE → IDENTIFY ROOT CAUSE → FIX ONLY RESPONSIBLE LAYER → TEST → VERIFY LIVE → UPDATE MEMORY

## Source-of-truth priority
1. GitHub — code, branches, PRs, workflows, commits and repository configuration.
2. Cloudflare — live Worker, routes, runtime configuration, builds and deployments.
3. Google Drive / Docs — durable decisions, runbooks, blockers, incident notes and continuation context.

If memory conflicts with verified live state, live state wins and memory must be corrected.

## Project identity
- Project: REGA
- Repository: `rebar9988-max/Rega`
- Production: `https://www.regaplatform.com`
- Cloudflare Worker: `rega-platform`
- Production branch: `main`

## Verified checkpoint — 2026-10-15
- Cloudflare Worker `rega-platform` exists.
- Routes observed: `www.regaplatform.com/*` and `regaplatform.com/*`.
- Active deployment observed serving 100% traffic.
- Active version observed: `bba819a0-901a-424f-9bcf-38d19799cb9d`.
- Deployment source observed: Wrangler.
- Establishing this memory system made no production runtime change.

## Verified GitHub state and open risk — 2026-10-15 (later)
- `main` has no branch protection or required checks (GitHub API `protected: false`). Hosted GitHub Actions run normally.
- Every push to `main` deploys production twice, independently: the `Deploy to Cloudflare Workers` workflow
  (`npx wrangler deploy`, not gated on CI) and Cloudflare Workers Builds (`Workers Builds: rega-platform`). The deploy
  workflow finishes before the `CI` workflow's E2E tests, so a commit can reach production before CI has verified it.
  Example: docs commit `93888c9` — deploy success, Workers Builds version `2baa6e60`, CI still running at that moment.
  Not changed: choosing a single, CI-gated deploy path changes production infrastructure and needs an owner decision.
- The active version above (`bba819a0`) was observed before those two deploys and is probably stale. No Cloudflare
  connector was available in this session to confirm the current active version; the public site loaded normally.
- Agent entry points: `AGENTS.md` (Codex) points to `CLAUDE.md` §6, which now includes the troubleshooting rules.

## Next safe continuation point
Follow `CLAUDE.md` §6 for every task. Re-check the active Cloudflare version before any production work. Open PR:
#10 (read-only Workers Builds log diagnostics). Owner decision pending: one CI-gated production deploy path.

## Safety
- Never store secrets or secret values here.
- Never reset or delete production data.
- Never deploy unverified changes.
- Preserve REGA architecture, routes, branding, i18n and RTL/LTR behavior unless explicitly authorized.

## Update format
After material work append:
- date
- task/problem
- root cause
- change made
- files/systems affected
- tests run
- PR/commit
- Cloudflare verification
- production impact
- blockers
- next safe continuation point


## Deploy-path repair — 2026-10-15
Owner approved removing the duplicate/ungated production deployment risk.

Target architecture:
- CI remains the quality gate on `main`.
- `.github/workflows/deploy.yml` deploys only after a successful `CI` `workflow_run`, and checks out that exact verified SHA.
- `workflow_dispatch` remains a manual fallback.
- Cloudflare Workers Builds production deploy is changed to dry-run only, so it cannot publish a second version.
- Result: one production deployment path, after CI success.

Branch: `chatgpt/ci-gated-single-deploy-20261015`.
No application code, routes, database schema, secrets, or branding are changed by this repair.
