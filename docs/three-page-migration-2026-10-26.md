# Rega24 three-page migration — current release checkpoint

**2026-10-27: implemented; production activation blocked by existing Neon quota exhaustion. No 100/100 claim.**

The canonical production Worker remains on the independently published main commit `c8f0cf2ac859414f48fd8dd080484f587b661679`. PR74 is not merged and the new page designs are not live. The entries below retain earlier investigation history; this current-status section supersedes their historical blocker and deployment snapshots.

## Current release evidence

- Application candidate: `c6feeddca51c39e017ec3675b9e0427168ba0247`, [PR74](https://github.com/rebar9988-max/Rega/pull/74). It includes all current main changes without altering About, homepage, Python service/workflow, auth/providers, deployment forwarding, dependency fixes or production schema/data.
- Latest full candidate [CI40465523259](https://github.com/rebar9988-max/Rega/actions/runs/40465523259): still running at this checkpoint; all gates through ordinary Node build passed. Browser installation/E2E and final workerd gates remain pending. Both Cloudflare candidate check runs have succeeded.
- Prior candidate `e6f3318` [full CI40342014013](https://github.com/rebar9988-max/Rega/actions/runs/40342014013) passed ordinary Node/Worker builds, full browser E2E and workerd codec/route smokes. This is prior-head evidence, not a substitute for current-head checks.
- Current local clean install, Prisma client generation, TypeScript, ESLint,24 focused release/identity/i18n tests and documentation validation pass. `npm audit --omit=optional`: zero vulnerabilities.
- Latest published WebsitePublisher source versions were rechecked2026-10-27 and remain v3/hash1650477e (registration),67308bfe (AI),3215436a (cities).
- Current existing production deployment: `11e9b60c-b4b1-48a8-a700-d9eed3e38fc8`; version `9e96a7f3-ece0-4c6b-8a87-5f2b9463c450`,100% allocation, SHA tag `c8f0cf2ac859414f48fd8dd080484f587b661679`. This is **not** a three-page migration deployment.
- Read-only Cloudflare verification: both official domains remain on existing `rega24` production;28 binding names/types retained. No secret values retrieved, no deployment/DNS/database/credential/provider change in this continuation.
- Browser baseline: original logo present; the existing three English URLs return cached HTTP200 with no new premium markers. Health returns503/databaseerror; existing hosted Beta health40456968000 independently reports data-route500 failures.
- Read-only Neon `SELECT 1` against existing production project/branch/database returns HTTP402: account or project exceeded quota. No paid upgrade, new database, resource/data deletion or quota bypass was attempted.

## Remaining release gate

The existing owner account must restore Neon quota before activating this release. A new Worker version changes version-specific cache keys and can expose database failures currently hidden by cached public pages. Preserve the current Worker version. After quota restoration: verify public health200/ok/database/migrations/content readiness; reconcile any newer main changes; require exact-head CI; use the existing main CI-gated production pipeline; then run the added read-only three-page live workflow and inspect its screenshots,21locale/page×4width checks and12Lighthouse reports. No live registration/admin approval or paid AI inference has been submitted.

Actual Lighthouse scores for the migrated **production** pages are unavailable because rollout is blocked. Historical local measurements below are not production certification and did not meet every target. There is no migration deployment ID or live regression certification yet. Unrelated main source is preserved; exhaustive live regression proof awaits database recovery and release.

## Current changed paths versus main

- `.github/workflows/three-page-live.yml`
- `PROJECT_MEMORY.md`
- `REGA24_SYSTEM_MAP.md`
- `REGA24_TROUBLESHOOTING.md`
- `docs/generated/system-inventory.json`
- `docs/three-page-migration-2026-10-26.md`
- `docs/verification/three-page-lighthouse-2026-10-26.json`
- `scripts/health/three-page-live.mjs`
- `src/app/[locale]/ai/page.tsx`
- `src/app/[locale]/for-business/page.tsx`
- `src/app/[locale]/locations/page.tsx`
- `src/components/ai/AiChat.tsx`
- `src/components/migration/Premium.tsx`
- `src/components/migration/premium.module.css`
- `src/messages/ar.json`
- `src/messages/ckb.json`
- `src/messages/de.json`
- `src/messages/en.json`
- `src/messages/fa.json`
- `src/messages/kmr.json`
- `src/messages/tr.json`
- `tests/e2e/onboarding.spec.ts`
- `tests/e2e/premium-pages.spec.ts`
- `wrangler.jsonc`

## Historical evidence (2026-10-26 onward)

# Rega24 three-page migration checkpoint — 2026-10-26

Status: implementation on an isolated branch; **not deployed, not production-complete**.

## Approved sources

Retrieved latest HTML/CSS through the authorized WebsitePublisher connection (project 31227), and opened all three published pages in a cloud browser. Version 3 of each source:

- `https://project31227.websitepublisher.ai/index.html`, hash `1650477e`, updated 02:37:00Z.
- `https://project31227.websitepublisher.ai/rega-ai.html`, hash `67308bfe`, updated 02:37:07Z.
- `https://project31227.websitepublisher.ai/cities.html`, hash `3215436a`, updated 02:37:10Z.

Approved direction: 1200px container, red accent bar, two-column hero (1.12/.88), 75px gap, 66px desktop heading, rounded bordered art/cards, pink radial backgrounds, dark registration intro panel, native FAQ details, 850/760/480px responsive breaks and reduced motion. Ported into page-scoped CSS, retaining existing fonts, shell, original repository logo and dark theme. Preview-only claims, invented AI replies and demo forms are excluded. No source/preview page was modified.

## Existing routes and integration

| Feature | Production URL (Sorani) | Integration |
| --- | --- | --- |
| Business registration | https://www.rega24.com/ckb/for-business | Existing BusinessForm and saveBusinessAction for authenticated business writers without publishing rights; existing registration/login/dashboard routes for other visitors. Existing email verification, permission checks, advisory-lock duplicate protection, drafts, review and approval remain authoritative. |
| REGA AI introduction | https://www.rega24.com/ckb/ai | Introduction and example questions above the existing AiChat; same API/providers/rate limits. Initial page load no longer scrolls immediately to the chat footer; conversation scrolling respects reduced motion. |
| City services | https://www.rega24.com/ckb/locations | Existing city records koeln/bonn/duesseldorf; existing CityBrowser, listLocations, public approval predicate and map route. Category filter added to the existing GET form and pagination. |

Each route also exists under kmr/de/en/ar/tr/fa. No new database, tables, migrations, Worker, provider, secret, domain or dependency. No homepage/shared header/footer redesign. Only actual active taxonomy/city records render; results come from the existing approved-only queries. All categories remain available in the filter; the presentation section shows the first six real root categories.

## Verification

- Identity guard: PASS; remote/main verified at `7011eb5482e518aa1b0e2f3974d516cbb8c3f6d2`.
- Clean dependency install and Prisma generation: PASS. Initial preinstalled Next 15 did not match the lockfile; npm ci restored Next 16.4.2 without changing dependency manifests.
- TypeScript and ESLint: PASS.
- Unit/integration: **336 passed, zero failed/skipped**, using an isolated local PostgreSQL 16 container; no production database writes.
- Initial selected browser suite: 81 pass, 3 fail, 3 not run. AI disclaimer contrast fixed by placing the existing chat on its own surface. Local test environment inherited disabled geocoding; a test-only geocoding override resolved onboarding without changing application configuration. The selected SEO test expects a published guide that the selected suite did not create; sitemap intentionally omits empty sections. This unrelated fixture prerequisite is being checked separately.
- Subsequent onboarding + new-page checks: **10/10 passed** (before final dark-theme refinements). Includes real registration/review/admin approval, draft deduplication, owner isolation; 21 page/locale combinations × 320/375/768/1440px, metadata/official-logo checks, functional city/category URLs, light-theme axe and reduced motion.
- Final inline public-page registration, expanded SEO and dark-theme checks: see final checkpoint appended below.
- Ordinary Node and Workers production builds: **BLOCKED** by executor policy denying the existing Google Fonts download. This is an existing layout dependency, not a source compile error. No network controls bypassed.
- Test-only Node build with Next's font-response fixture (local Vazirmatn file): PASS. This artifact is not deployable production evidence. The fixture is in /tmp, not source or CI.
- Production build and live Lighthouse targets are not certified. Local mobile Lighthouse scores/timings and measurement limitations are in [the measurement artifact](verification/three-page-lighthouse-2026-10-26.json). Performance 91/72/72, accessibility 100/100/100, best practices 100/100/100, SEO 92/92/92; localhost canonical mismatch explains the SEO deduction. LCP ~3.33/2.33/3.33s, CLS ~0.00293/0/0. Concurrent testing and test font fixture limit comparability.

## Production observations and deployment blocker

Read-only Cloudflare API verified the official domains point to existing service **rega24**, production environment. Latest observed deployment `cf37b341-5e5c-4703-915b-731aeefa6bfd`, version `f7a118cd-6f64-4206-a19e-ec5b434a5bc9`, 100%, created 01:55:28Z. The source configuration/pipeline still names **rega-platform**; its deployments endpoint returns 404 (Worker does not exist).

The central memory already records concurrent PR71/73 source/live cutover reconciliation and security/release blockers. This feature branch does not import their unrelated work or guess the provenance of the active application. Merging current source would invoke a pipeline targeting a retired Worker, potentially recreating it. No merge or deploy was attempted; no deployment, secret, binding, DNS or account setting was changed.

At 06:41Z a connected cloud-browser fetch verified all three existing English production routes and `/api/v1/health` return HTTPS 200. Health reported database/migrations/content/auth/storage/AI/email healthy, no missing env, four AI providers. **The new migration was absent**, as expected. Existing service health is not verification of this implementation. No live registration/customer writes or AI inference were performed.

Resume: reconcile canonical production source/pipeline with the already-running release work, complete ordinary hosted build and full CI, then use the existing authorized pipeline for the exact verified commit. Never recreate the retired Worker. Verify the three deployed routes, all seven locales, workflow/security, browser layout, and production Lighthouse before declaring completion. Native production data, authentication, providers and unrelated production features were not modified by this task; exhaustive regression certification awaits full CI/live release.

## Additional verification checkpoint

- Inline public registration flow: PASS, including the real shared action, required email verification, moderation and public visibility after approval. Expanded run: 55 pass; selected-suite sitemap test lacked a published-guide fixture, as confirmed by the existing `listSectionHasContent` rule. A local-only published-guide fixture was prepared; production was not accessed.
- Dark-theme axe uncovered low-contrast badge/secondary text and the existing filter submit button against its inherited dark theme. Scoped CSS now uses ink for these badges and a deeper red for submit buttons on these three pages only. Final compiled checks pending below.
- Cloudflare/OpenNext build with the explicit test-only font fixture: PASS. This proves bundling of the application, not an ordinary production build or deploy. Dry-run results pending below. Ordinary network build remains blocked.
- Test-fixture Workers dry-run: PASS (`--dry-run: exiting now`), no upload. Final test-fixture Node build: PASS. No ordinary build pass claimed.

## Changed application files

- `src/app/[locale]/for-business/page.tsx`
- `src/app/[locale]/ai/page.tsx`
- `src/app/[locale]/locations/page.tsx`
- `src/components/migration/Premium.tsx`
- `src/components/migration/premium.module.css`
- `src/components/ai/AiChat.tsx` (initial scroll/reduced-motion only)
- `src/messages/{ckb,kmr,de,en,ar,tr,fa}.json` (premiumPages namespace)
- `tests/e2e/onboarding.spec.ts` (new heading and existing end-to-end flow enters the public inline form)
- `tests/e2e/premium-pages.spec.ts`
- This checkpoint, measurement JSON, and `PROJECT_MEMORY.md`.

The temporary font response and system-Chromium test configuration are local test aids only and are excluded from commits. No tests/gates were weakened. Local documentation inventory validation is sensitive to ignored runtime files in the worktree (already documented in shared memory); its generated transient diff was discarded, not committed.

## Final local result

- Final compiled light + dark accessibility/reduced-motion test across all three English pages: PASS, no axe violations.
- Existing sitemap test with its required local published-guide fixture: PASS. No sitemap/application logic changed.
- Final focused run: **2 passed**, 21.4s. Prior expanded run: **55 passed**, including inline public registration end-to-end; the one fixture-dependent sitemap failure is resolved above. Earlier AI/catalog/security selection: all tests in those files passed. These combined selections are not a full-suite or WebKit certification.
- Final TypeScript/ESLint/diff checks: PASS. Both test-fixture builds and dry-run: PASS. Normal production build, hosted full CI and deployed new-page verification remain incomplete.
- Latest Cloudflare active version re-read and unchanged; no production release performed.

## Source-content fidelity follow-up

Restored the approved AI introduction questions themselves in seven languages: Köln services/barbers in the hero; Bonn services/restaurants/browsing Rega24 in the example cards. The existing live chat's own suggestions and API behavior remain unchanged. Repeated the test-fixture Workers build, dry-run and Node build successfully for this final copy change. Final browser results recorded below.

PR #74: https://github.com/rebar9988-max/Rega/pull/74. Initial implementation commit `a17abcbeb801dcbd22ca712b66bd253db9fd9c21`. Hosted CI run `40282626146` verified ordinary (non-fixture) Node build, unit tests, lint/typecheck, Python tests and documentation validation; at last inspection it was still installing browsers. This is not a full hosted CI pass. The separate existing Neon preview workflow `40282625904` failed creating its branch with HTTP422; its log does not state the detailed provider reason. No quota changes/deletion/retry were performed.

A separate local audit checked 46 navigation links/anchors across the three pages: zero broken. A repeated local business-page Lighthouse run scored82/100/100/92, LCP3.24s, CLS0; variation reinforces that the initial72–91 performance measurements are not production certification.
- Final source-aligned head: all3 new browser tests PASS (50.1s), covering21page-locales×4widths,metadata/logo,city/categoryfilter,and light+darkaxe/reducedmotion. TypeScript/ESLint PASS. FixtureWorkers/Nodebuilds+dryrun PASS. Hosted fullCI andproductionrelease remain pending/blocked as above.

## Deployment continuation

Full hosted CI40284031390 on7bc6d53 completed SUCCESS, including Node/Workers builds, full E2E/WebKit and workerd smokes. Reused separately verified focused PR75 canonical-target repair and preserved latest main5a9a95c. No unrelated PR71 schema/PR73 admin application included. The combined head is submitted to fresh CI before main release. Existing query-string redaction is explicitly retained in Wrangler, preserving the live privacy setting.

Source investigation ties manual main deploy40229901441 to7011eb5 and version1a2c3a34; currentf7a118cd is the recorded privacy/settings follow-up. Runtime Next async-storage/tracing identifies16.4.2; a separate16.5.0 package string must not be mistaken for the Next runtime. Existing provider-revocation proof remains unverified; no credentials are rotated, synchronized or exposed by this feature release. Previous versionf7a118cd is the rollback target, with no schema migration needed.

## Current checkpoint — 2026-10-27

PR74 e6f3318 passed full hosted CI40342014013: all build, browser and workerd runtime gates succeeded. Official main subsequently advanced to c8f0cf2 through independently authorized cleanup, About and navigation releases. This continuation merges that history and preserves every unrelated source change; the migration diff against current main remains the three pages, their presentation/locales/tests and read-only release evidence. Python workflow/source, deployment forwarding, audit gate, preview isolation, About content/tests and canonical category navigation are unchanged against main. The old Neon automatic provisioning and missing-preview failures above are historical; current main has fixed them.

Verified current production rollback checkpoint: deployment11e9b60c-b4b1-48a8-a700-d9eed3e38fc8/version9e96a7f3-ece0-4c6b-8a87-5f2b9463c450,100%. Twenty-eight binding names/types preserved, no secret values read. No schema/data/DNS/AI provider or Python deployment change. Source retains query redaction previously approved in this branch, which current production has disabled. Localized the free badge and country label through existing catalog keys. Fresh combined CI and actual deployed measurements remain required; the historical pending/blocked statements above describe their timestamp, not current certification.

## Verified external release blocker — 2026-10-27

Before any PR74 production release, public health returned HTTP503 with database=error, migrations=false and contentColumns=false; required environment names were present. Existing hosted Beta health40456968000 independently failed health and database-backed routes. Authoritative read-only Neon SELECT 1 against existing project lucky-glitter-73195208, production branch br-floral-hall-b22rpgrw/neondb returned HTTP402: account or project exceeded quota; upgrade plan to increase limits. Existing endpoint ep-autumn-glitter-b2jxzis9 is idle and has been suspended since00:16Z. No secret retrieval, database/schema/data change, resource deletion, replacement database, paid activation or quota bypass was performed.

Production release activation is blocked until the existing database quota is restored. A new Worker version invalidates the old version's edge cache, which could expose additional uncached database failures; do not merge-trigger or manually deploy into this known outage. Keep current production version9e96a7f3-ece0-4c6b-8a87-5f2b9463c450. Continue full candidate CI and preserve its exact verified source. Actual migrated live workflows and Lighthouse scores cannot be certified before rollout. When quota is restored, recheck health/database/migrations/content readiness, refresh official main without losing independent work, require exact-head CI, then use the existing main production pipeline and read-only three-page evidence workflow. Never weaken these gates or mark the external failure passed.

## CI runner recovery — 2026-10-27

CI40465523259 passed all gates through Node build, but browser installation stayed in progress for over20minutes; the prior successful identical command took34seconds. No E2E or final workerd result is claimed for this attempt. Running-job logs returned404 until completion, so the exact download/runner cause is not assumed. Publishing the already prepared quota-blocker documentation checkpoint to PR74 triggers its ordinary fresh full CI and automatically supersedes the stalled run. Application source remains byte-identical to c6feedd; no test, timeout, required gate or deployment safeguard changed. Inspect cancelled-run logs, require fresh exact-head checks and retain the quota release hold.
