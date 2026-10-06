# Python AI Engine

REGA remains a Next.js/TypeScript application. The existing REGA AI Gateway remains the only provider-routing, fallback, budget and application-security layer. Python is an optional internal compute service for advanced AI work.

## Architecture

```text
Browser
  -> REGA Next.js /api/v1/ai/chat
  -> authentication / feature flags / rate limits
  -> existing Postgres retrieval
  -> optional REGA Python AI Engine (semantic rerank)
  -> existing REGA AI Gateway
  -> Gemini / OpenAI / xAI Grok / Groq / DeepSeek / OpenRouter / Anthropic
  -> Next.js
  -> Browser
```

For ordinary provider calls there is no Python hop. The browser has no Python service URL or token and never calls the service from client code.

## Why Python exists

The isolated service gives REGA a place for workloads where Python and AI/ML tooling provide a concrete advantage:

- multilingual embeddings
- semantic reranking after REGA's authoritative retrieval
- document normalization and chunking
- future RAG, extraction, classification and ML pipelines

It does not implement public routes, Auth.js, RBAC, Prisma CRUD, business-directory rules, provider routing, provider fallback, UI, maps or admin features.

## Service

Location: `services/ai-python`

Production target: a separate Cloudflare Python Worker named `rega-ai-python`, using FastAPI through Cloudflare's ASGI adapter.

Workers AI bindings currently power:

- `@cf/baai/bge-reranker-base` — semantic reranking
- `@cf/baai/bge-m3` — multilingual embeddings

The Python Worker receives no production database credential and no direct provider API keys.

### Endpoints

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | public liveness only | alive/version/capabilities; no configuration values |
| `POST /v1/rerank` | Bearer `AI_SERVICE_TOKEN` | reorder candidate documents by semantic relevance |
| `POST /v1/embed` | Bearer `AI_SERVICE_TOKEN` | produce multilingual embeddings |
| `POST /v1/process` | Bearer `AI_SERVICE_TOKEN` | normalize, script/language hint and chunk text |

The POST API is deliberately small. Payload size, string lengths and collection sizes are bounded. Errors contain stable codes only.

## Next.js integration

Server-only configuration:

- `AI_SERVICE_URL`
- `AI_SERVICE_TOKEN`
- `AI_SERVICE_TIMEOUT_MS` (default 1500 ms)

`src/lib/ai/python-client.ts` owns the HTTP contract and validation. `src/lib/ai/python-runtime.ts` maps REGA search hits into reranking candidates.

The assistant still performs primary retrieval in `src/lib/search/postgres.ts`. Python is invoked only when at least two candidates exist. The ranked IDs are mapped back to the original trusted REGA records; Python cannot introduce a listing that Postgres did not retrieve.

## Failure isolation

Python is optional by construction:

- missing URL/token -> skip Python
- timeout -> retain original Postgres order
- network failure -> retain original order
- HTTP error / unauthorized -> retain original order
- malformed Python response -> retain original order
- Workers AI outage -> Python returns a safe 503; Next.js retains original order

The existing provider gateway and normal REGA pages continue to work. No database migration is part of this feature.

## Local development

Main app:

```bash
AI_SERVICE_URL=http://127.0.0.1:8787
AI_SERVICE_TOKEN=dev-only-token-at-least-24-characters
AI_SERVICE_TIMEOUT_MS=1500
```

Python service:

```bash
cd services/ai-python
uv sync
AI_SERVICE_TOKEN=dev-only-token-at-least-24-characters uv run pywrangler dev
uv run pytest
```

Workers AI uses the configured remote binding when enabled, so local inference can consume Cloudflare Workers AI usage.

## Tests

The repository CI runs:

- existing REGA lint/typecheck/unit/E2E/build gates
- TypeScript Next.js -> Python contract/fallback tests
- Python FastAPI auth/validation/payload/processing/embedding/reranking/error tests
- Cloudflare Worker dry-run for the main Next.js Worker

The Python deployment workflow also smoke-tests the deployed service before enabling it in the main Worker.

## Production deployment

`.github/workflows/ai-python-deploy.yml` deploys only the isolated Python Worker when relevant files reach `main`.

Order is intentionally fail-safe:

1. deploy `rega-ai-python`
2. create/rotate a high-entropy `AI_SERVICE_TOKEN`
3. configure that token on the Python Worker
4. resolve its workers.dev URL
5. verify `/health`, auth rejection, protected processing, embeddings and reranking
6. only after those checks pass, set `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` on the existing `rega-platform` Worker

If steps 1–5 fail, the main Worker is not pointed at the failed Python deployment and the existing REGA path remains unchanged.

Required GitHub repository secrets for deployment are the existing Cloudflare credentials:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

No real secret is committed. The deployment workflow masks the generated service token.

## Database safety

The Python service has no `DATABASE_URL`, no Prisma client and no migrations. Retrieval remains inside REGA. This keeps authorization and data access in the existing application and avoids making the AI service a privileged database actor.
