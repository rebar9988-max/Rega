# REGA Platform

Production web application for **https://www.regaplatform.com**.
Canonical host: `www.regaplatform.com`. Apex (`regaplatform.com`) 308-redirects to it.

## Stack

| Layer | Choice |
| --- | --- |
| Web + API | Next.js 15 (App Router, TypeScript, React 19), Tailwind 4 |
| Database | PostgreSQL via Prisma |
| Auth | Auth.js v5, credentials + bcrypt, JWT sessions |
| Storage | any S3-compatible bucket (Cloudflare R2, AWS S3, MinIO) |
| AI | server-side provider abstraction (Gemini), key never in the client |
| i18n | next-intl — ckb (Sorani, default, RTL), kmr (Kurmanji, Latin script, LTR), de, ar (RTL), tr |

## Layout

```
prisma/schema.prisma          database model (all entities)
src/lib/rbac.ts               permission matrix (5 roles, 28 permissions)
src/lib/api.ts                response envelope, pagination, sorting helpers
src/lib/validation.ts         Zod schemas shared by API + forms
src/lib/ai.ts                 REGA AI: retrieval + provider call
src/lib/storage.ts            pre-signed S3 uploads
src/app/api/v1/*              REST API (web, iOS, Android share this)
src/messages/*.json           UI translations for the five locales
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

## Deploy on Vercel

1. Push this folder to a Git repository (GitHub/GitLab/Bitbucket).
2. Vercel -> Add New -> Project -> import that repository. The Next.js preset is detected automatically.
3. Project Settings -> Environment Variables, add for **Production** (and Preview separately, with test credentials):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled Postgres URL (e.g. Neon `-pooler` host) |
   | `DIRECT_DATABASE_URL` | direct Postgres URL (migrations) |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_URL` | `https://www.regaplatform.com` |
   | `CANONICAL_HOST` | `www.regaplatform.com` |
   | `NEXT_PUBLIC_SITE_URL` | `https://www.regaplatform.com` |
   | `APP_ENV` | `production` |
   | `AI_PROVIDER` | `gemini` (or `disabled`) |
   | `GEMINI_API_KEY` | server-side only, never prefixed with NEXT_PUBLIC_ |
   | `STORAGE_*` | R2/S3 bucket + key, server-side only |
   | `MEDIA_PUBLIC_URL` | public CDN base URL of the bucket |

4. Run the migration once from your machine, pointed at the production database:
   `DATABASE_URL=<prod> DIRECT_DATABASE_URL=<prod> npx prisma migrate deploy`
   then `npm run db:seed` to create the first super admin.

## Production runtime configuration (Cloudflare Worker)

The running Worker `rega-platform` needs these **runtime** secrets (Workers & Pages → rega-platform → Settings →
Variables and Secrets; *not* the Build section, which is invisible to the running Worker):

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection (or a `HYPERDRIVE` binding in `wrangler.jsonc`) |
| `AUTH_SECRET` | yes | Auth.js session signing (≥ 16 chars) |
| `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `AI_PROVIDER=auto` | optional | AI assistant; only configured providers are used |

`GET /api/v1/health` lists the **names** of missing required variables (never values). Optional GitHub Actions helpers
(manual `workflow_dispatch`, values stay in GitHub Secrets and are masked):
`worker-secrets-sync.yml` uploads DATABASE_URL / AUTH_SECRET / AI keys to the Worker (needs `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`), `db-migrate.yml` runs `prisma migrate deploy` (additive; needs `DIRECT_DATABASE_URL`).

## DNS records

Add the domain in Vercel (Settings -> Domains). Then at your DNS provider:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | the A record Vercel shows for the apex | 3600 |
| CNAME | `www` | the CNAME target Vercel shows for www | 3600 |

Vercel shows the exact targets when the domain is added — use those values.
Leave MX, TXT and unrelated subdomains untouched. HTTPS is issued automatically.

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
| Gemini, xAI Grok, OpenAI, Groq (shared OpenAI-compatible base; Mistral / OpenRouter are config only) | `providers/` |
| Timeout, fallback, circuit breaker, health probe | `gateway.ts` |
| Task → provider order (env-overridable) | `routing.ts` |
| Env wiring + daily budget | `runtime.ts` (the only file that reads secrets) |

**Configure** (host environment / secret manager only, never git): `AI_PROVIDER=auto`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`,
optionally `GEMINI_MODEL`, `GROK_MODEL`, `OPENAI_MODEL`, `GROQ_MODEL`, `AI_PROVIDER_ORDER`, `AI_ROUTING`. Then enable the assistant in
`/dr/ai` (or the `public.aiSearch` feature flag) and use *Test connection* to verify each key.

**Add a provider** (e.g. Mistral): add its env vars to `lib/env.ts`, one `createOpenAiCompatible({...})` entry in
`runtime.ts`, one `catalog()` entry in `runtime.ts`, and its id to `AI_PROVIDER_ORDER`. No other code changes.

Safety: keys are sent only in request headers, never logged (`scrub()` also strips echoed keys from provider errors),
prompts are never logged, requests are rate limited per session and IP, and there is a daily request budget.
