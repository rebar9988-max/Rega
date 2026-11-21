---
name: analyze
description: Analyze code, data, logs or a system area and report evidence-based findings. Use for "analyze", "audit", "investigate", "شیکاری بکە".
argument-hint: "<target> [--focus security|performance|a11y|architecture]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(node scripts/*:*)
---
Analyze `$ARGUMENTS`.

1. Targeted audit only (CLAUDE.md §7): Grep/Glob first, read the minimum relevant code; check `REGA24_SYSTEM_MAP.md` for architecture questions.
2. Every finding needs evidence (`file:line`, command output). Label unverified items UNKNOWN.
3. Output in Kurdish Sorani:
   - **ئەنجام** — one-line verdict.
   - **دۆزینەوەکان** — table: severity (High/Med/Low) | finding | evidence | fix.
   - **هەنگاوی داهاتوو** — smallest safe next step.
Read-only. No fixes unless separately requested.
