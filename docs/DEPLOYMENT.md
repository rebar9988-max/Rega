# Deployment (Cloudflare Workers)

Production is the Worker `rega24` (`wrangler.jsonc`), built with OpenNext, with D1 for application data and R2 for files/images. The [permanent Cloudflare mandate](../CLAUDE.md#09-permanent-cloudflare-platform-mandate-owner-instruction-2026-10-28) also covers deployment, DNS and security. Secrets and variables live in the
Cloudflare dashboard (Workers & Pages → rega24 → Settings → Variables and Secrets) and in GitHub repository secrets;
**none are ever committed or printed**. The variable names are in `.env.example`.

## 1. Pre-deploy checks (all must pass)

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run test:d1
npm run build:node            # Node build used by the E2E suite
npm run e2e                   # needs a throw-away Postgres: DATABASE_URL (E2E refuses production-looking databases)
npm run build                 # Workers build (OpenNext)
npx wrangler deploy --dry-run # validates the bundle, deploys nothing
```

`.github/workflows/ci.yml` runs exactly this on every pull request and on `main`.

## 2. Database

1. Take and restore-verify a private D1 backup; retain a separate R2 backup ([`BACKUP-RESTORE.md`](BACKUP-RESTORE.md)).
2. Review and rehearse committed `prisma/d1/migrations/*.sql` against a disposable database. Apply reviewed pending migrations to the existing target with `npm run db:d1:migrate` from verified `main`; verify the exact account/database and read back migration history/FK integrity. Do not reset or seed production.
3. Release compatible code through exact-main CI below. [D1 migration and recovery](D1-MIGRATION.md) documents the active provider and operational checks. `db-migrate.yml` is the retained **Legacy PostgreSQL migrate (rollback only)** workflow; it does not migrate active D1 and is not the normal production path.

## 3. Deploy

Production uses a **single CI-gated deploy path**:

1. `.github/workflows/ci.yml` runs on `main`.
2. Only when that CI workflow completes successfully, `.github/workflows/deploy.yml` runs through `workflow_run`.
3. The deploy workflow checks out the exact CI-verified commit SHA, builds it, and runs `npx wrangler deploy`.
4. Cloudflare Workers Builds may still build `main` for visibility, but its production deploy command is configured as a dry-run so it cannot publish a second production version.

Manual fallback remains available through `workflow_dispatch` on the deploy workflow.

For a local bundle check:

```bash
npm run build && npm run cf:dry-run
```

Actual releases use the CI-gated workflow with verified account/Worker/domain ownership and exact release tagging. Recover with a verified D1-compatible release. Returning to a PostgreSQL-only release requires explicit owner direction, a fresh freeze/backup and reconciliation of subsequent D1 writes; do not blindly roll back to the pre-D1 application.

New runtime variables of this release (names only; all optional unless noted): `EMAIL_PROVIDER`, `RESEND_API_KEY`,
`EMAIL_FROM`, `CONTACT_INBOX`, `SECTIONS_ENABLED`, `SECTIONS_DISABLED`, `ERROR_WEBHOOK_URL`, `AUTH_LOGIN_ATTEMPTS`,
`LEGAL_*` (owner details for Impressum/privacy/terms: fill them, see `CHANGES_REPORT.md`). New Worker binding:
`FORM_LIMITER` (rate limiter, declared in `wrangler.jsonc`).

## 4. Post-deploy smoke tests

| Check | Expect |
| --- | --- |
| `GET /api/v1/health` | 200, `ok=true`, `databaseProvider=d1`, migrations/content ready, no missing required variables |
| `GET /` | redirect to `/ckb` (or the visitor's language) |
| `GET https://rega24.com/` | 301 to `https://www.rega24.com/` |
| `/de/impressum`, `/de/privacy`, `/de/terms`, `/de/report`, `/de/contact` | 200; no `[[PLACEHOLDER]]` once `LEGAL_*` is filled |
| `/de/businesses`, `/de/jobs`, `/de/events`, `/de/guides` | 200 (empty state or cards) |
| `/sitemap.xml` and one `/sitemaps/*.xml` | valid XML with `hreflang` alternates |
| `/robots.txt` | lists the sitemap, no `/dr` |
| `/manifest.webmanifest`, `/sw.js`, `/offline.html` | 200 |
| Register → (verify email if a provider is set) → sign in → `/dr` | owner dashboard opens |
| Submit a listing as an owner, publish as a moderator | appears publicly, listed in the sitemap |
| Assistant: a question with no match | deterministic "nothing found" answer, no model call |

Then check Cloudflare Web Analytics / logs for errors and watch `production-health.yml`.

Documentation-only automatic releases are skipped using the merge's first-parent diff (`git diff --name-only HEAD^ HEAD`). This handles ordinary commits and PR merge commits with the depth-2 checkout; plain `git diff-tree` without merge handling is insufficient. Root/empty commits still follow the conservative deploy path. Manual workflow dispatch remains explicit and CI/ownership-gated. See [regression evidence](evidence/deployment-scope-regression-2026-10-28.json).

## PR71 social-field release gate

The candidate adds four nullable TEXT Business account fields through
`prisma/d1/migrations/0004_business_social_links.sql`. Export and restore-verify the current active D1 before
applying it. Rehearse against a disposable database,retain applied0001–0003 unchanged,and verify the actual ledger,
column definitions,existing records and FK integrity. Release application code only after migration readiness.
The similarly named PostgreSQL migration is for isolated rollback-provider tests,not active production.
PR71 remains held for fresh recovery/security evidence and exact-head checks;see PROJECT_MEMORY.md.
