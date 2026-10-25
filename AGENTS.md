# REGA — agent instructions

All REGA project rules live in [CLAUDE.md](CLAUDE.md) and apply to every agent (Codex, Claude Code and others),
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

Then verify current GitHub and Cloudflare state before acting. Do not duplicate rules here; change them in CLAUDE.md.

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
