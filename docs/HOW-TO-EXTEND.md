# How to extend REGA

Every recipe adds one thing and touches nothing else. Run `npm run lint && npm run typecheck && npm test` after each,
and `npm run e2e` before merging.

## Add a content section (like jobs, events, guides)

1. **Details table** (only when the section needs fields of its own): add a model with a 1:1 `listingId` to
   `prisma/schema.prisma`, then `npx prisma migrate dev --name <section>_details`. Migrations are additive.
2. **Config:** add the key to `CONTENT_SECTIONS` and an entry to `CONTENT` in `src/features/content/config.ts`
   (write/publish permissions, whether a business is required, the schema.org type).
3. **Validation and save:** add a zod schema to `SCHEMAS` in `features/content/pure.ts` and the details upsert branch to
   `saveEntryAction` in `features/content/actions.ts`; add the fields to `components/dr/ContentForm.tsx`.
4. **Registry:** add one entry to `SECTIONS` in `src/config/sections.ts` with `content: true` (and `header`, `footer`,
   `sitemap`, `assistant` as wanted). Nav, footer, sitemap and the dashboard menu follow.
5. **Routes:** copy `src/app/[locale]/jobs/page.tsx` and `[slug]/page.tsx` (each is ~15 lines) and change the key.
6. **Search:** add `contentRetriever("<key>")` to `RETRIEVERS` in `src/lib/search/postgres.ts` and the key to
   `src/lib/search/retriever-keys.ts` (a test fails until you do).
7. **Strings:** `nav.<key>`, `pageMeta.<key>` and any new `content.*` keys in **all seven** `src/messages/*.json`.
8. Tests: `tests/content.test.ts` patterns, plus an e2e spec.

Switch a section off without code: `SECTIONS_DISABLED=events` (it vanishes from nav, footer, sitemap and returns 404).

## Add a static section or page

* **CMS page (no code):** dashboard → *Pages* → new page (slug, title and text per language). It is served at `/{locale}/p/{slug}`
  and listed in the sitemap once published.
* **Code page:** add the route under `src/app/[locale]/<name>/`, one entry in `SECTIONS`, and the `nav.<key>` and
  `pageMeta.<key>` strings in all locales.

## Add a category

Dashboard → *Categories* → new (any depth; choose a parent, and a *section* to file it under jobs/events/guides). Names in
every language are stored on the row. The base 20 business categories are seeded from `prisma/seed-data/categories.ts`
(idempotent: re-running the seed fills empty fields and never overwrites edits).

## Add a country, region or city

Dashboard → *Geography*. Cities get a readable slug (`/city/<slug>`) and appear in filters and the sitemap once active.
Initial data lives in `prisma/seed-data/geography.ts`; a CSV import never creates cities (unknown cities are reported).

## Add a language

1. `src/config/locales.ts`: add the code to `LOCALES` and an entry to `LOCALE_META` (native name, `htmlLang`, direction,
   numbering system, font script, `fallbacks`). Routing, `hreflang`, sitemap and the switcher follow.
2. `src/messages/<code>.json`: translate every key (the i18n test fails on a missing or extra key and checks the script).
3. `src/features/legal/texts/<code>.ts`: the legal texts (same block structure as German; a test enforces it).
4. Data: listings fall back along `fallbacks` until translated. For stored texts use the `*Translation` tables; the legacy
   `name<Locale>` columns exist only for the seven launch locales (ADR 0002).
5. `public/offline.html`: add the language to its table.

## Add a field to a business

Add the column (additive migration), the zod schema in `src/lib/business-admin.ts`, the form field in
`components/dr/BusinessForm.tsx`, and show it on the detail page. Include searchable text in `search-index.ts` if needed.

## Add a notification or external service

Put it behind a small interface in `src/lib` (see `email/`), choose the implementation from `src/lib/env.ts`, document the
variable in `.env.example` (a test fails if it is missing) and degrade gracefully when it is not configured.
