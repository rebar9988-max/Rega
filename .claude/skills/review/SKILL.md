---
name: review
description: Review a diff, branch, PR or file for bugs, security, performance, accessibility and rule compliance. Use for "review", "code review", "پێداچوونەوە".
argument-hint: "[file|branch|PR#] (default: current diff vs main)"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(gh pr view:*), Bash(gh pr diff:*)
---
Review `$ARGUMENTS` (default `git diff main...HEAD`).

1. Verify the target belongs to `rebar9988-max/Rega` (CLAUDE.md §0); stop on mismatch.
2. Check only changed lines plus needed context for: correctness, security (auth/RBAC, injection, secrets), performance, accessibility, i18n/RTL, tests, and CLAUDE.md rules (scope, no visual changes, no duplicates).
3. Output in Kurdish Sorani: list of findings `[High|Med|Low|Nit] file:line — issue → fix`, most severe first; then a one-line verdict: ✅ ئامادەیە / ⚠️ گۆڕانکاری پێویستە.
Read-only. Report only real, verifiable issues.
