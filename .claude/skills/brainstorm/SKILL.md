---
name: brainstorm
description: Generate and rank practical ideas or options for a goal. Use for "brainstorm", "ideas", "options", "بیرۆکە".
argument-hint: "<goal or problem> [--count N]"
allowed-tools: Read, Grep, Glob
---
Brainstorm for `$ARGUMENTS` (default 8 ideas).

1. Ground ideas in the existing Rega24 stack (Next.js, Cloudflare Workers/D1/R2) and the €0-cost rule; no ideas needing paid services unless flagged.
2. Output in Kurdish Sorani:
   - Table: # | بیرۆکە | سوود | ئەرک (S/M/L) | مەترسی.
   - **باشترین ٣** — top 3 with one-line reasons.
3. No implementation. Respect locked visual identity (CLAUDE.md §3): visual ideas are proposals only.
