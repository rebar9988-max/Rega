---
name: rewrite
description: Rewrite text or copy for clarity, tone or audience while keeping meaning. Use for "rewrite", "rephrase", "polish", "دووبارە بینووسەوە".
argument-hint: "<text|file> [--tone formal|friendly|short] [--lang ckb|en|ar|sv]"
allowed-tools: Read, Edit
---
Rewrite `$ARGUMENTS`.

1. Keep the original meaning, facts, names, links and placeholders (`{var}`, ICU syntax) exactly.
2. Apply the requested tone/length; default: clear, concise, same language as the source.
3. For files under `src/messages/*.json`: change values only, never keys; keep JSON valid; keep the matching locale.
4. Output: the rewritten text, then at most 3 bullets in Kurdish Sorani on what changed. Edit a file only if a file path was given and editing was requested.
