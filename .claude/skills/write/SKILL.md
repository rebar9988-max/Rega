---
name: write
description: Write new content — docs, README sections, commit/PR text, UI copy, translations or emails. Use for "write", "draft", "بنووسە".
argument-hint: "<what to write> [--lang ckb|en|ar|sv] [--file path]"
allowed-tools: Read, Grep, Glob, Write, Edit
---
Write `$ARGUMENTS`.

1. Default language Kurdish Sorani (RTL-safe), unless `--lang` or the target file's locale says otherwise.
2. Match existing style: read one nearby example (sibling doc, existing locale strings) before writing.
3. Facts only — no invented features, links, handles, prices or status. No secrets.
4. UI copy goes into `src/messages/<locale>.json` with existing key conventions; keep JSON valid.
5. With `--file`: write/edit that file only. Otherwise return the text. Then one line on where it fits.
