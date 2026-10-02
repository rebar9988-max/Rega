# REGA Platform

Production web application for **https://www.regaplatform.com**.
Canonical host: `www.regaplatform.com`. Apex (`regaplatform.com`) 301-redirects to it.

## Stack

| Layer | Choice |
| --- | --- |
| Web + API | Next.js 15 (App Router, TypeScript, React 19), Tailwind 4 |
| Hosting | Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`, Worker `rega-platform`) |
| Database | PostgreSQL via Prisma |
| Auth | Auth.js v5, credentials + bcrypt, JWT sessions |
| Storage | any S3-compatible bucket (Cloudflare R2, AWS S3, MinIO) |
| AI | server-side gateway (Gemini, OpenAI, xAI Grok, Groq, DeepSeek, OpenRouter, Anthropic Claude with fallback), keys never in the client |
| i18n | next-intl — ckb (Sorani, default, RTL), kmr (Kurmanji, Latin script, LTR), de, en, ar (RTL), fa (RTL), tr |

## Layout

```
prisma/schema.prisma          database model (all entities)
src/lib/rbac.ts               permission matrix (5 roles, 28 permissions)
src/lib/api.ts                response envelope, pagination, sorting helpers
src/lib/validation.ts         Zod schemas shared by API + forms
src/lib/ai.ts                 REGA AI: retrieval + provider call
src/lib/storage.ts            pre-signed S3 uploads
src/app/api/v1/*              REST API (web, iOS, Android share this)
src/app/dr/*                  management dashboard: businesses, services, categories, staff, AI, audit log
src/lib/search-index.ts       search index (searchText) of businesses, services and locations
src/lib/text.ts               normalization incl. Kurdish/Arabic/Persian letter folding (ك→ک, ي→ی, ه→ە …)
src/lib/business-access.ts    per-business access (BusinessMember) for EMPLOYEE accounts
src/lib/opening-hours.ts      opening-hours format, validation and display rows
src/messages/*.json           UI translations for the seven locales
src/i18n/locales.ts           locale metadata: direction, digits, dates, fonts
```

## Local setup

```bash
cp .env.example .env.local     # then fill in DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate dev --name init
npm run db:seed                # creates the first SUPER_ADMIN
npm run dev
npm test                       # i18n, URL-safety and rate-limit unit tests
npm run lint
```

### RTL / LTR model

Direction is derived from each locale's writing system (`script` in `src/i18n/locales.ts`), and a test verifies
every message catalogue really is in that script. User-generated text is rendered through `src/lib/content.ts`
(`localize`) + `<Text>` / `<Ltr>` (`src/components/ui/Bidi.tsx`), which set `lang`/`dir` per fragment so a Kurdish
name on a German page (or a Latin address on a Kurdish page) always displays correctly.
To add Arabic-script Badini later, add a locale with `script: "arab"`.

Generate a secret with `openssl rand -base64 32`.

## Deploy (Cloudflare Workers)

Production runs as the Cloudflare Worker `rega-platform` (see `wrangler.jsonc`), built with OpenNext:

1. Changes land on `main` through a pull request; CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests,
   E2E on a throw-away Postgres, and a Workers build with `wrangler deploy --dry-run`.
2. The Worker is built from `main` with `npm run build` and deployed with `npx wrangler deploy`.
3. Database changes are additive migrations in `prisma/migrations`. Apply them with the manual workflow
   **Database migrate (production)** (`db-migrate.yml`, input `migrate`), which runs `prisma migrate deploy` and the
   idempotent seed (base categories, first admin, search-index refresh). A migration is merged and applied before the
   code that reads its new columns.

## Production runtime configuration (Cloudflare Worker)

The running Worker `rega-platform` needs these **runtime** secrets (Workers & Pages → rega-platform → Settings →
Variables and Secrets; *not* the Build section, which is invisible to the running Worker):

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection (or a `HYPERDRIVE` binding in `wrangler.jsonc`) |
| `AUTH_SECRET` | yes | Auth.js session signing (≥ 16 chars) |
| `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `AI_PROVIDER=auto` | optional | AI assistant; only configured providers are used |

`GET /api/v1/health` lists the **names** of missing required variables (never values). Optional GitHub Actions helpers
(manual `workflow_dispatch`, values stay in GitHub Secrets and are masked):
`worker-secrets-sync.yml` uploads DATABASE_URL / AUTH_SECRET / AI keys to the Worker (needs `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`), `db-migrate.yml` runs `prisma migrate deploy` (additive; needs `DIRECT_DATABASE_URL`).

## DNS records

The domain is served by Cloudflare: `www.regaplatform.com` is routed to the Worker, and the apex redirects to `www`
(also enforced in `next.config.ts`). Leave MX, TXT and unrelated records untouched. HTTPS is issued by Cloudflare.

## Backups

```bash
DATABASE_URL=<prod> MEDIA_BUCKET=rega-media bash scripts/backup.sh
```

Dumps the database to `backups/` and syncs the media bucket with `rclone`.
All data is standard Postgres + plain object storage, so the platform can be
moved to another provider without code changes.


## REGA AI Gateway

`src/lib/ai/` is a provider-neutral gateway. The chat pipeline (`chat.ts`) retrieves REGA data, builds a prompt and
calls `gateway.generate({ task, ... })`; it never talks to a vendor directly.

| Piece | File |
| --- | --- |
| Provider contract, task types | `types.ts` |
| Gemini, xAI Grok, OpenAI, Groq, DeepSeek, OpenRouter (shared OpenAI-compatible base), Anthropic Claude (Messages API) | `providers/` |
| Timeout, fallback, circuit breaker, health probe | `gateway.ts` |
| Task → provider order (env-overridable) | `routing.ts` |
| Env wiring + daily budget | `runtime.ts` (the only file that reads secrets) |

**Configure** (host environment / secret manager only, never git): `AI_PROVIDER=auto`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`,
`DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, optionally `GEMINI_MODEL`, `GROK_MODEL`, `OPENAI_MODEL`, `GROQ_MODEL`,
`DEEPSEEK_MODEL`, `OPENROUTER_MODEL` (`vendor/model`), `ANTHROPIC_MODEL`, `AI_PROVIDER_ORDER`, `AI_ROUTING`. Then enable the assistant in
`/dr/ai` (or the `public.aiSearch` feature flag) and use *Test connection* to verify each key.

Default order: each task's preferred direct vendors first, then DeepSeek (low cost), then OpenRouter, and Anthropic Claude
as the final fallback.
HTTP 402 (no balance / credits, as DeepSeek and OpenRouter report it) counts as `quota`: the request falls back to the
next provider, and like auth, rate-limit, timeout and server errors it counts towards that provider's circuit breaker
(3 consecutive failures → skipped for 30 s), so an exhausted account is not called on every request.

Model defaults (`env.ts`) are only defaults: vendors rename and retire models, and the repository cannot check which
models a given account can use. Set each `*_MODEL` explicitly in production and confirm every provider with *Test
connection* in `/dr/ai`; an unknown model fails with HTTP 400/404 and the request falls back to the next provider.

**Add a provider** (e.g. Mistral): add its env vars to `lib/env.ts`, one `createOpenAiCompatible({...})` entry in
`runtime.ts`, one `catalog()` entry in `runtime.ts`, and its id to `AI_PROVIDER_ORDER`. No other code changes.

Safety: keys are sent only in request headers, never logged (`scrub()` also strips echoed keys from provider errors),
prompts are never logged, requests are rate limited per session and IP, and there is a daily request budget.
