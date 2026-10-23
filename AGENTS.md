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

## PERMANENT STRICT RULE — MODERN WEB GUIDANCE: NON-VISUAL TECHNICAL SCOPE ONLY

Owner instruction (2026-10-20). Applies to REGA Platform and R&L, to every Claude Code and Codex session, and to every use of the `modern-web-guidance` skill. Keep this section identical in the repository-root `AGENTS.md` and `CLAUDE.md`. No exceptions without explicit user approval.

Modern Web Guidance must operate in NON-VISUAL TECHNICAL SCOPE ONLY.

ABSOLUTELY FORBIDDEN:
- Changing colors, branding, logos or design tokens
- Changing layouts, spacing, typography, icons or animations
- Changing desktop or mobile appearance
- Modifying CSS, Tailwind classes or visual components
- Redesigning, restyling or visually optimizing any page

ALLOWED:
- Non-visual performance analysis and safe improvements
- Accessibility audits without visual changes
- Browser compatibility checks
- Technical code quality and security checks
- Non-visual SEO improvements

Before every change, inspect the diff. If it changes visual appearance, STOP and do not apply it. Visual issues may be reported but never automatically fixed.

Where guidance from `modern-web-guidance` conflicts with this rule, this rule wins. This rule adds to, and never replaces, the other instructions in this file.
