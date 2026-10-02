# Deployment (Cloudflare Workers)

Production is the Worker `rega-platform` (`wrangler.jsonc`), built with OpenNext. Secrets and variables live in the
Cloudflare dashboard (Workers & Pages → rega-platform → Settings → Variables and Secrets) and in GitHub repository secrets;
**none are ever committed or printed**. The variable names are in `.env.example`.

## 1. Pre-deploy checks (all must pass)

```bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm test
npm run build:node            # Node build used by the E2E suite
npm run e2e                   # needs a throw-away Postgres: DATABASE_URL (E2E refuses production-looking databases)
npm run build                 # Workers build (OpenNext)
npx wrangler deploy --dry-run # validates the bundle, deploys nothing
```

`.github/workflows/ci.yml` runs exactly this on every pull request and on `main`.

## 2. Database

1. Take a backup ([`BACKUP-RESTORE.md`](BACKUP-RESTORE.md)).
2. Run the manual workflow **Database migrate (production)** (`db-migrate.yml`, inputs `migrate` and `backup-verified`, from `main`; the second input is your confirmation that step 1 produced a restorable backup or snapshot). It applies the
   committed migrations with `prisma migrate deploy` (additive only; it never resets, drops or truncates) and the idempotent
   seed (base categories, geography, first admin when `SEED_ADMIN_*` secrets exist; no demo data in production).
3. Merge/deploy the code **after** the migration: new code may read new columns, old code ignores them.

Migrations of this release, all additive: `growth_foundation`, `business_languages`, `reviews_one_per_user` (detaches
orphans/duplicates before adding constraints; deletes nothing), `content_sections_core`.

## 3. Deploy

```bash
npm run build && npx wrangler deploy
```

Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment. Rollback: `npx wrangler rollback` (or redeploy the
previous commit); migrations stay applied because the old code ignores additive columns.

New runtime variables of this release (names only; all optional unless noted): `EMAIL_PROVIDER`, `RESEND_API_KEY`,
`EMAIL_FROM`, `CONTACT_INBOX`, `SECTIONS_ENABLED`, `SECTIONS_DISABLED`, `ERROR_WEBHOOK_URL`, `AUTH_LOGIN_ATTEMPTS`,
`LEGAL_*` (owner details for Impressum/privacy/terms: fill them, see `CHANGES_REPORT.md`). New Worker binding:
`FORM_LIMITER` (rate limiter, declared in `wrangler.jsonc`).

## 4. Post-deploy smoke tests

| Check | Expect |
| --- | --- |
| `GET /api/v1/health` | 200, no missing required variables |
| `GET /` | redirect to `/ckb` (or the visitor's language) |
| `GET https://regaplatform.com/` | 301 to `https://www.regaplatform.com/` |
| `/de/impressum`, `/de/privacy`, `/de/terms`, `/de/report`, `/de/contact` | 200; no `[[PLACEHOLDER]]` once `LEGAL_*` is filled |
| `/de/businesses`, `/de/jobs`, `/de/events`, `/de/guides` | 200 (empty state or cards) |
| `/sitemap.xml` and one `/sitemaps/*.xml` | valid XML with `hreflang` alternates |
| `/robots.txt` | lists the sitemap, no `/dr` |
| `/manifest.webmanifest`, `/sw.js`, `/offline.html` | 200 |
| Register → (verify email if a provider is set) → sign in → `/dr` | owner dashboard opens |
| Submit a listing as an owner, publish as a moderator | appears publicly, listed in the sitemap |
| Assistant: a question with no match | deterministic "nothing found" answer, no model call |

Then check Cloudflare Web Analytics / logs for errors and watch `production-health.yml`.
