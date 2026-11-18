---
name: simplify
description: Simplify code or text — remove duplication and unnecessary complexity without changing behavior. Use for "simplify", "make simpler", "ساکاری بکە".
argument-hint: "<file|function|text> [--dry-run]"
allowed-tools: Read, Grep, Glob, Edit, Bash(npm test:*), Bash(npx tsc:*), Bash(npm run lint:*)
---
Simplify `$ARGUMENTS`.

1. Behavior must stay identical: same inputs/outputs, APIs, routes, side effects, i18n keys.
2. Allowed: remove dead/duplicate code, flatten nesting, reuse existing helpers, clearer names (local only). Forbidden: visual/CSS/Tailwind/layout changes, new dependencies, cross-module refactors.
3. `--dry-run`: show the proposed diff only. Otherwise edit, then run `npx tsc --noEmit` and the relevant `npm test`.
4. Report in Kurdish Sorani: what was simplified (files), lines before → after, verification results.
