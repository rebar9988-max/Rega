# Read-only live observations

Review date: 2026-10-26 (Europe/Berlin). Source snapshot: `8edc1ed873ed9c382400a935d77f44966ee64992`.

## Cloudflare

Authenticated GET requests were scoped to the Rega24 Worker/account. No application/provider call, configuration mutation or deployment was performed.

| Read | Observed result | Scope of proof |
|---|---|---|
| `/accounts/{account}/workers/scripts/rega24/deployments` | HTTP 200; newest deployment `e3747e03-56b6-40eb-87c0-d7edb7483763`, created `2026-10-26T19:34:32.437942Z`; version `df20f6a1-ad1d-4967-ab52-1df65c46196c` at 100% | Worker allocation at inspection time; not deployed source identity |
| `/accounts/{account}/workers/domains?service=rega24` | HTTP 200; enabled production custom domains: `rega24.com`, `www.rega24.com`, `regaplatform.com`, `www.regaplatform.com`; previews disabled for all four | Domain attachment; not DNS resolution, TLS behavior or redirect response verification |
| `/accounts/{account}/builds/workers/7b845cda2ee749c89c4f9b83490609b4/triggers` | HTTP 200; repository `rebar9988-max/Rega`, build `npm run build`, deploy `npx wrangler deploy --dry-run`, branch includes `main`, path includes `*` | This Worker's existing trigger cannot publish the documentation branch |

An initial discovery GET to `/accounts/{account}/builds/triggers` returned 404. The OpenAPI spec then identified the Worker-scoped GET above, which succeeded. This was a read-only endpoint discovery issue, not a Worker outage. No token values, environment values, personal account details or database records were collected into these files.

## GitHub and release safety

Repository metadata and the complete Git tree were read through the connected GitHub tool. The repository was cloned and the checked-out commit matches the inspected API tree SHA. The identity guard passed. The working tree was initially clean; no existing `docs/architecture/` files or nested AGENTS.md instructions were present.

All 10 current workflow files were inspected:

| Workflow | Trigger relevant to this task | Production mutation |
|---|---|---|
| `ci.yml` | pull_request; push main; manual | PR uses disposable PostgreSQL, dummy secrets and fake AI; builds and Wrangler dry-run |
| `deploy.yml` | successful CI workflow_run on main; manual | Real web publish exists, but is not triggered by this documentation branch/PR; docs-only skip also declared |
| `ai-python-deploy.yml` | selected code/config paths pushed to main; manual | Separate Python publish; docs path excluded |
| `db-migrate.yml` | manual, confirmation and main guard | Migration; never dispatched here |
| `worker-secrets-sync.yml` | manual, confirmation and main guard | Secret upload; never dispatched here |
| `neon-branch.yml` | manual | Informational policy; no automatic Neon creation/deletion |
| `database-preflight.yml` | manual, main guard | Read-only schema inspection |
| `cloudflare-diagnostics.yml` | manual | Read-only metadata diagnostics |
| `production-health.yml` | successful main CI, schedule, manual | Existing live health probes; not triggered here |
| `production-browser.yml` | successful main health workflow, manual | Existing live browser probes; not triggered here |

The CI shell and called scripts were checked for real deploy commands and external-service configuration. No workflow or build setting was edited. A draft PR may run the normal CI suite; this task does not authorize running production workflows. This is a point-in-time review, not a guarantee against simultaneous configuration changes by others.
