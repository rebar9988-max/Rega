---
name: explain
description: Explain code, a file, a concept or an error clearly. Use when asked "what does this do", "explain", "ڕوونی بکەرەوە".
argument-hint: "[file|symbol|concept] [--lang en]"
allowed-tools: Read, Grep, Glob
---
Explain `$ARGUMENTS`.

1. Read only the smallest relevant code (Grep first, then targeted Read).
2. Output, in Kurdish Sorani unless `--lang` is given:
   - **کورتە** — one sentence: what it is and why it exists.
   - **چۆن کار دەکات** — 3–6 bullets, in execution order, with `file:line` refs.
   - **خاڵی گرنگ** — pitfalls, side effects, security notes (only if real).
3. Keep code identifiers in English. No code echoing beyond short snippets. Read-only: change nothing.
