# REGA Platform — changes report

Branch `fix/audit-2026-10` (13 commits on top of `7a1095d`, ~240 files). Nothing was merged, no pull request was opened,
nothing was deployed. Status legend: ✔ done and verified as stated · ◐ done, one verification step still open · ✖ not done.

## Read this first

| | |
| --- | --- |
| **Deployment** | ✖ **Not performed.** `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are not available to this session (presence checked by name only). Exact commands and smoke tests: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). |
| **E2E for the last three commits** | ◐ `tests/e2e/content.spec.ts` (jobs/events/guides) and `tests/e2e/pwa.spec.ts` are written but **have not been run**: the session was refused access to the local database connection string, so the Playwright server could not be started for them. Run `npm run e2e` against a throw-away Postgres (CI does this on a pull request). The e2e specs of Phases 0–7.1 were run and fixed earlier in this work, but a full run at the final commit has **not** been done. |
| **Legal texts** | A German lawyer must review `src/features/legal/texts/*` before the site relies on them. Only the German version is binding; other languages say so. |
| **Placeholders** | Required legal facts are not in the repository, so the pages show `[[…]]` markers until the variables below are set. Nothing was invented. |

## Checks run at `6b238f3` (the last commit adds only this report)

| Check | Result |
| --- | --- |
| `npm run lint` | 0 errors, 1 warning (`worker.mjs` anonymous default export, pre-existing) |
| `npm run typecheck` | clean |
| `npm test` (unit, 26 files) | 164 tests: 163 pass, 0 fail, 1 skipped (pre-existing) |
| `npm run build:node` | passes |
| `npm run build` (Workers / OpenNext) | passes |
| `npx wrangler deploy --dry-run` | passes (bindings incl. `FORM_LIMITER`; no deploy) |
| `npm run e2e` | **not run at this commit** (see above) |

## Phases

### Phase 0 — scalable foundation ✔
- `src/config/locales.ts` (one locale list incl. fallbacks) and `src/config/sections.ts` (registry) generate header, mobile menu, footer, sitemap, search and assistant; `SECTIONS_ENABLED/DISABLED` switch sections without code. Test adds a dummy section and asserts it appears everywhere.
- Env schema + `.env.example` kept in sync by a test; email, search, AI, storage behind interfaces; feature folders under `src/features`; `/api/health`, error webhook, glossary of fixed terms.
- Additive data model: category tree (any depth, `sectionKey`), geography hierarchy (Country → Region → City), `*Translation` tables, generic `Listing` core, status workflow, `BUSINESS_OWNER` role, audit log.
- Admin: geography, pages (CMS), reports, messages, reviews, import, categories.
- Docs: [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) (Mermaid data model), [`HOW-TO-EXTEND.md`](docs/HOW-TO-EXTEND.md), [ADRs 0001–0008](docs/adr), [`BACKUP-RESTORE.md`](docs/BACKUP-RESTORE.md), [`DEPLOYMENT.md`](docs/DEPLOYMENT.md), README index.

### Phase 1 — legal ✔ (lawyer review pending)
Impressum, Privacy, Terms, Report (DSA notice form) in all 7 locales with a structure-parity test; German is binding; footer legal column; server-side contact form with honeypot and rate limit. Privacy text matches the code (30-day AI retention, no analytics, essential cookies only, reviews and user contributions).

### Phase 2 — business-owner onboarding ✔
Register (user or business), email verification, password reset (hashed single-use tokens), for-business page, owner dashboard scoped to own businesses, submit-for-review and moderation, owner cannot publish or verify.

### Phase 3 — content structure ✔
20 seeded categories and geography seeds (idempotent, never overwrite edits), CSV import (pending listings only, dry-run first, [`docs/import-format.md`](docs/import-format.md)), honest empty states with a "be the first" call to action, filter counts. No fake listings anywhere.

### Phase 4 — AI grounding ✔
Search service with per-section retrievers; assistant answers only from retrieved rows; no match → deterministic answer without a model call; cards with links; 30-day conversation purge.

### Phase 5 — UX consistency & contact ✔
One term per concept (glossary test), contact page showing only configured details, 404 with search and the main sections, consistent buttons/empty states/forms.

### Phase 6 — SEO & technical ✔
Readable URLs (`/businesses/{category}`, `/city/{city}[/{category}]`, `/business/{slug}`) with 301/308 from old URLs, sitemap index with chunk files and `hreflang`, 120–155-character per-page descriptions in every locale, JSON-LD, `X-Robots-Tag` for `/dr`, robots without `/dr`.

### Phase 7 — growth features (in order, no premium/payment features)
| Item | Status |
| --- | --- |
| 7.1 Reviews & ratings (one per user per business, moderated, report link, aggregate) | ✔ |
| 7.2 Jobs | ◐ built, unit-tested, builds; e2e not run |
| 7.3 Events | ◐ same |
| 7.4 Guides | ◐ same |
| 7.5 PWA (manifest with 192/512 icons, `sw.js`, offline page in 7 languages) | ◐ unit-tested; e2e not run |

7.2–7.4 share the `Listing` core: dashboard list/create/edit/moderate (owners submit, moderators publish), public list and detail pages with filters, language fallback with per-fragment `lang/dir`, `JobPosting`/`Event`/`Article` JSON-LD, report link, retrievers for the assistant, sitemap files per section, registry-generated dashboard menu. Jobs show until the end of the chosen day; event times are wall-clock times at the venue.

## Decisions (details in the ADRs)
- Translations are added (`*Translation` tables); legacy `name<Locale>` columns stay authoritative for the 7 launch locales (0002).
- Content sections share one `Listing` core (0003).
- Business page canonical at `/business/{slug}`; true 301 only for `?category=<id>` (middleware), page-level 308 for the old business URL (0004).
- No email provider ⇒ registration marks the address verified and password reset says email is unavailable; with a provider, verification is required before submitting (0005). Reset does not revoke existing JWTs.
- OAuth sign-in not implemented (0006). PWA does not cache pages or data (0007). Platform is free; no pricing, plans or payments exist or will be built (0008).
- `next/image` not adopted (Workers without an Images binding). Lighthouse was run locally only; axe contrast findings stem from the locked palette and were left unchanged.
- The assistant retrieves jobs/events/guides; the site search page tabs still cover businesses, services and locations only (follow-up).

## Placeholders to fill (names only; set as public, non-secret variables)
Required: `LEGAL_OPERATOR_TYPE`, `LEGAL_NAME`, `LEGAL_STREET_ADDRESS`, `LEGAL_POSTAL_CODE_CITY`, `LEGAL_AI_PROVIDER`.
Optional (blank = "does not apply"): `LEGAL_RESPONSIBLE_PERSON`, `LEGAL_VAT_ID`, `LEGAL_TRADE_REGISTER`, `LEGAL_EMAIL_PROVIDER`.
Defaults already set from the brief: country Germany, phone, public email, hosting (Cloudflare), analytics "none".
The founding story on the About page is shown only if a CMS page with slug `about-story` is published.

## New environment variables (names only)
`EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_INBOX`, `SECTIONS_ENABLED`, `SECTIONS_DISABLED`, `ERROR_WEBHOOK_URL`, `AUTH_LOGIN_ATTEMPTS`, `AUTH_GOOGLE_ID/SECRET` (reserved, unused), `LEGAL_*`. New Worker binding: `FORM_LIMITER`.

## Migrations (all additive, applied in order by `prisma migrate deploy`)
`20261002090000_growth_foundation`, `20261002100000_business_languages`, `20261002110000_reviews_one_per_user` (detaches orphan/duplicate reviews before adding constraints, deletes nothing), `20261002120000_content_sections_core`. A database backup before applying is part of [`DEPLOYMENT.md`](docs/DEPLOYMENT.md); none was taken here because no production database was reachable.

## Incomplete / blocked
1. **Deployment** — no Cloudflare credentials (stop condition of the plan). Run the commands in `docs/DEPLOYMENT.md`.
2. **E2E at the final commit** — run `npm run e2e` against a throw-away database; expect to fix selector or copy details in `content.spec.ts` / `pwa.spec.ts` on first run.
3. **Lawyer review** of the legal texts; fill the `LEGAL_*` variables.
4. Configure an email provider before real traffic (otherwise addresses are not verified).
5. Optional follow-ups: content sections in the site search tabs; OAuth; revoke sessions on password reset.

## Safety
No secrets were read into the repository, printed or committed. No production data was touched, reset, dropped or deleted. No fake listings, reviews, people, addresses or brand assets were added.
