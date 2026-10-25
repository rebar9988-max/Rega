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


## REGA24 system map and failure diagnosis

Read [REGA24_SYSTEM_MAP.md](REGA24_SYSTEM_MAP.md) before architectural changes and consult
[REGA24_TROUBLESHOOTING.md](REGA24_TROUBLESHOOTING.md) when diagnosing failures.
The maintenance requirements are in [CLAUDE.md](CLAUDE.md), section 6 (REGA24 technical documentation).
Update both files after verified infrastructure changes; record dependencies and known issues, reuse completed
investigations, never invent system information, and never store credentials or secret values in documentation.
Before committing run `node scripts/rega24-docs.mjs --check`; after reviewed source changes regenerate with
`node scripts/rega24-docs.mjs --write` (stage new source files first). Keep the existing memory workflow above.

Documentation-only main commits must not replace production Workers (`DOCS_ONLY_SKIP`). Existing commands
`node scripts/generate-system-inventory.mjs` and `node scripts/validate-system-docs.mjs` remain compatible wrappers
around the single canonical generator/checker. CI performs this validation; no separate duplicate docs workflow.
The JSON and Markdown inventories are generated views of the same tracked facts, never separate manual authorities.
