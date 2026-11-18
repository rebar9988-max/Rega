---
name: compare
description: Compare two or more options, files, libraries, approaches or versions and recommend one. Use for "compare", "A vs B", "which is better", "بەراورد".
argument-hint: "<A> <B> [...] [--criteria cost,perf,security]"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), WebSearch, WebFetch
---
Compare `$ARGUMENTS`.

1. Use repository evidence first; use the web only for external facts and cite sources.
2. Default criteria: fit with existing Rega24 architecture, cost (€0 rule), security, performance, maintenance effort, migration risk.
3. Output in Kurdish Sorani: a comparison table (criteria × options), then **پێشنیار** — one recommended option with 1–2 reasons and its main trade-off.
Read-only. No invented benchmarks or prices.
