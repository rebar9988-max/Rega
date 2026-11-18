---
name: challenge
description: Critically challenge a plan, decision, claim or design — find weak points, risks and counter-arguments. Use for "challenge", "devil's advocate", "what could go wrong", "ڕەخنە بگرە".
argument-hint: "<plan|decision|claim|file>"
allowed-tools: Read, Grep, Glob, WebSearch
---
Challenge `$ARGUMENTS`.

1. Be honest and specific; no flattery. Check claims against the codebase and docs.
2. Output in Kurdish Sorani:
   - **گریمانە لاوازەکان** — assumptions that may be false, with evidence.
   - **مەترسییەکان** — security, cost (€0 rule), production, data, scope, project-isolation risks.
   - **ڕێگای جێگرەوە** — 1–3 simpler or safer alternatives.
   - **بڕیار** — keep / change / drop, with one reason.
Read-only.
