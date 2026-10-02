# ADR 0004 — Readable URLs, redirects instead of breakage

Status: accepted · 2026-10-02

## Decision
Category and city pages have slug URLs; the business page is canonical at `/business/{slug}`. Old URLs keep working:
`/businesses/{slug}` answers 308 (page-level `permanentRedirect`) and `?category=<id>` answers a true 301 from the
middleware (it looks the id up through `/api/v1/categories`; the page repeats the redirect if that lookup is unavailable).
The sitemap is an index with chunk files (≤ 2,000 records × 7 locales) so the protocol limit is never reached. `/dr` is
kept out of the index with `X-Robots-Tag` rather than listed in `robots.txt`.

## Consequences
Two status codes (301 and 308) for moved business pages; both are permanent for search engines.
