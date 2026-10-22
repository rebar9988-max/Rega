# REGA — agent instructions

All REGA project rules live in [CLAUDE.md](CLAUDE.md) and apply to every agent (Codex, Claude Code and others),
including section 6: the permanent shared project-memory and troubleshooting workflow.

**P0 — REGA ≠ R&L (CLAUDE.md section 0):** this repository is REGA Platform (`rebar9988-max/Rega`, https://www.regaplatform.com).
R&L (`rebar9988-max/rega-cargo`, https://www.rlgo.net) is a different project. Verify repository, remote, branch and
domain before any edit, migration, commit, merge or deployment (`node scripts/project-identity-guard.mjs --project REGA`),
and STOP on any mismatch. Never mix, never silently switch.

Before any substantial task read, in order:
1. [CLAUDE.md](CLAUDE.md)
2. [PROJECT_MEMORY.md](PROJECT_MEMORY.md)
3. The central Google Doc "REGA — Project Memory & Documentation Hub"
   (https://docs.google.com/open?id=1pp6GW-UM9AQ9TuUJHumziaujxB6ZOza5S3xwA6dmxu4)

Then verify current GitHub and Cloudflare state before acting. Do not duplicate rules here; change them in CLAUDE.md.
