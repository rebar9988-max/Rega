---
name: summarize
description: Summarize a file, diff, PR, log, document or text into the key points. Use for "summarize", "TL;DR", "کورتی بکەرەوە".
argument-hint: "[file|diff|text] [--short|--lang en]"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*)
---
Summarize `$ARGUMENTS` (default: `git diff` of the current branch).

Output in Kurdish Sorani unless `--lang` is given:
- **کورتە** — 1–2 sentences.
- **خاڵە سەرەکییەکان** — max 5 bullets, facts only, with refs (`file:line`, commit).
- **کار/مەترسی** — open actions or risks, only if present.

`--short`: the one-sentence summary only. Never invent content not in the source. Read-only.
