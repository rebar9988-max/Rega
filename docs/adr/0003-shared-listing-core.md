# ADR 0003 — Content sections share one `Listing` core

Status: accepted · 2026-10-02

## Context
Jobs, events and guides need the same things: status workflow, per-language texts, optional business, city and category,
slug, search text, moderation, sitemap, structured data.

## Decision
One `Listing` table (`sectionKey`, `slug`, `status`, `businessId`, `cityId`, `categoryId`, `searchText`, `expiresAt`, …),
`ListingTranslation` for title/summary/body, and typed 1:1 detail tables (`JobDetails`, `EventDetails`, `GuideDetails`).
Behaviour that differs per section lives in `src/features/content/config.ts`. Business, service and review stay as they
are (they predate it and have their own rules).

## Consequences
A new content section is a details table plus configuration (see `docs/HOW-TO-EXTEND.md`). Event times are stored as the
wall-clock time at the venue (typed in the form, kept as UTC, shown with `timeZone: "UTC"`, emitted in JSON-LD without an
offset), so a visitor in another time zone sees the time of the event, not a shifted one.
