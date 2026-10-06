# REGA Python AI Engine

This directory is the isolated Python AI engine behind the REGA Next.js application. It is **not** a second REGA backend and it is **not** an AI provider gateway.

## Responsibilities

- semantic reranking of candidates already retrieved by REGA
- multilingual embeddings for future RAG/indexing pipelines
- safe text normalization, language/script hints and chunking
- future AI/ML workloads that have a concrete Python advantage

It does **not** own authentication, authorization, public routes, CRUD, Prisma, business listings, provider routing, provider fallback, or REGA UI.

## Runtime

Production targets a separate Cloudflare Python Worker named `rega-ai-python`. FastAPI runs through Cloudflare's ASGI adapter. Workers AI bindings provide:

- `@cf/baai/bge-reranker-base` for semantic reranking
- `@cf/baai/bge-m3` for multilingual embeddings

No database credential and no Gemini/OpenAI/xAI/Groq/DeepSeek/OpenRouter/Anthropic key is required by this service.

## Internal API

- `GET /health` — non-sensitive liveness metadata
- `POST /v1/rerank` — protected by `AI_SERVICE_TOKEN`
- `POST /v1/embed` — protected by `AI_SERVICE_TOKEN`
- `POST /v1/process` — protected by `AI_SERVICE_TOKEN`

POST bodies are capped and validated. Errors use stable codes and never include exception text or environment values.

## Local development and tests

Install `uv` and Node, then:

```bash
cd services/ai-python
uv sync
AI_SERVICE_TOKEN=dev-only-token-at-least-24-characters uv run pywrangler dev
uv run pytest
```

The Next.js app can be pointed at the local Worker with server-only `AI_SERVICE_URL` and `AI_SERVICE_TOKEN`.

## Failure behavior

REGA's existing Postgres retrieval remains authoritative. The Next.js integration calls Python only to improve ranking after candidates exist. If Python is missing, times out, returns malformed data, is unauthorized, or Workers AI is unavailable, REGA keeps the original candidate order and continues through the existing AI Gateway.

Simple LLM calls never need to pass through this service.
