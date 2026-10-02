# ADR 0007 — PWA: installable with an offline page, no offline data

Status: accepted · 2026-10-02

## Decision
The manifest makes the site installable (192 and 512 icons). `public/sw.js` does two things only: it shows
`/offline.html` (seven languages, REGA tokens, no external resources) when a page cannot be loaded, and it caches the
content-hashed `/_next/static` assets. Navigations are network-only; pages, API responses and the dashboard are never
stored, so no personal data or stale listing is ever served from a cache. No push notifications, no background sync.

## Consequences
Offline browsing of listings is not offered. Bump `VERSION` in `sw.js` to drop old caches.
