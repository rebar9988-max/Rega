# ADR 0001 — Locales and sections are configuration

Status: accepted · 2026-10-02

## Context
Navigation, footer, sitemap, search tabs and the assistant each listed routes by hand, so adding a section meant touching
five places and forgetting one. Locales were spread over routing, SEO and column names.

## Decision
`src/config/locales.ts` is the one list of locales (direction, numbering, fonts, `hreflang`, fallbacks) and
`src/config/sections.ts` the one list of sections with per-surface flags (`header`, `mobile`, `footer`, `sitemap`,
`search`, `assistant`, `content`). Surfaces are generated from them; `SECTIONS_ENABLED` / `SECTIONS_DISABLED` switch a
section without a code change. Tests add a dummy section and assert that it appears everywhere.

## Consequences
A section is one registry entry plus its route and strings. A disabled section is invisible and answers 404, but its code
stays. The registry is a pure module (safe in client and server components).
