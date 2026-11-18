---
name: optimize
description: Improve performance, bundle size, queries or token/resource usage with measured, non-visual changes. Use for "optimize", "speed up", "make faster", "باشتر بکە".
argument-hint: "<file|route|query|area> [--measure-only]"
allowed-tools: Read, Grep, Glob, Edit, Bash(npm test:*), Bash(npm run:*), Bash(npx tsc:*)
---
Optimize `$ARGUMENTS`.

1. Measure or cite evidence first (build output, query shape, hot path). No speculative optimization.
2. Non-visual scope only: no colors, layout, typography, animations, CSS/Tailwind or component visuals. Visual issues are reported, not fixed.
3. Prefer: caching, fewer round-trips, D1 query/index hints (no migrations without owner approval), lazy loading, removing dead work. No new paid services or dependencies.
4. Unless `--measure-only`: apply the smallest change, verify with `npx tsc --noEmit` and relevant tests, measure again.
5. Report in Kurdish Sorani: **پێش → دوای** (metric), files changed, verification.
