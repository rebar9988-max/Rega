---
name: plan
description: Produce a minimal, ordered implementation plan for a feature or change before coding. Use for "plan", "how should we implement", "پلان".
argument-hint: "<feature or change>"
allowed-tools: Read, Grep, Glob
---
Plan `$ARGUMENTS`.

1. Targeted audit: find existing components/APIs/services to reuse (CLAUDE.md §7.1.8); read `REGA24_SYSTEM_MAP.md` if architecture is touched.
2. Output in Kurdish Sorani:
   - **ئامانج** — one line.
   - **هەنگاوەکان** — numbered, each: file(s) to change, what, how to verify.
   - **دووبارە بەکارهێنان** — existing code reused.
   - **مەترسی و ڕێگری** — risks, needed owner approvals (production, migrations, RBAC, billing).
   - **پشکنین** — tests/typecheck/build to run.
3. Smallest safe scope. No code changes. No visual changes unless explicitly requested.
