---
name: debug
description: Find the root cause of a bug, error or failing test/CI and apply the smallest safe fix. Use for "debug", "fix this error", "why does it fail", "هەڵە چارەسەر بکە".
argument-hint: "<error|test|symptom> [--no-fix]"
allowed-tools: Read, Grep, Glob, Edit, Bash(npm test:*), Bash(npm run:*), Bash(npx tsc:*), Bash(git diff:*), Bash(git log:*), Bash(node scripts/*:*)
---
Debug `$ARGUMENTS`.

1. Check `REGA24_TROUBLESHOOTING.md` and `PROJECT_MEMORY.md` for a known cause first; do not repeat recorded investigations.
2. Reproduce (failing test/command) → locate with Grep → confirm the root cause with evidence.
3. Unless `--no-fix`: apply the smallest fix in the responsible layer only. No refactors, no visual/CSS changes, no schema/migration changes, no production actions.
4. Re-run the relevant check (`npm test`, `npx tsc --noEmit`, `npm run lint`) and show real results.
5. Report in Kurdish Sorani: **هۆکاری ڕاستەقینە**, **چارەسەر** (files), **پشکنین** (results), using CLAUDE.md §7.5 STATUS format.
