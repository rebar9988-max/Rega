---
name: research
description: Research a technical or product question using the codebase and current web sources, with citations. Use for "research", "find out", "what is the best way", "لێکۆڵینەوە".
argument-hint: "<question> [--repo-only|--web-only]"
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
---
Research `$ARGUMENTS`.

1. Check repository docs first (`PROJECT_MEMORY.md`, `REGA24_SYSTEM_MAP.md`, `docs/`) to avoid repeating known answers.
2. Web: 2–5 focused searches; prefer official docs (Cloudflare, Next.js, MDN, OWASP). Note dates; prefer current sources.
3. Output in Kurdish Sorani:
   - **وەڵام** — direct answer (2–4 sentences).
   - **بەڵگە** — bullets with source links or `file:line`.
   - **بۆ Rega24** — how it applies here, cost impact.
Mark uncertainty explicitly. Never invent sources.
