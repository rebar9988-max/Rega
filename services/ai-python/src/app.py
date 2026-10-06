from __future__ import annotations

import hmac
import math
import os
import re
import unicodedata
from typing import Any

from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

MAX_BODY_BYTES = 128_000
MAX_ITEMS = 24
MAX_ITEM_CHARS = 4_000
DEFAULT_EMBED_MODEL = "@cf/baai/bge-m3"
DEFAULT_RERANK_MODEL = "@cf/baai/bge-reranker-base"

app = FastAPI(
    title="REGA Python AI Engine",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


class ApiError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


class Candidate(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=MAX_ITEM_CHARS)


class RerankRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1_000)
    items: list[Candidate] = Field(min_length=1, max_length=MAX_ITEMS)
    top_k: int | None = Field(default=None, ge=1, le=MAX_ITEMS)


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=16)


class ProcessRequest(BaseModel):
    text: str = Field(min_length=1, max_length=32_000)
    chunk_size: int = Field(default=1_200, ge=256, le=4_000)
    overlap: int = Field(default=120, ge=0, le=800)


def _env(request: Request, name: str, default: str | None = None) -> str | None:
    env = request.scope.get("env")
    if env is not None:
        try:
            value = getattr(env, name)
            if value is not None:
                return str(value)
        except Exception:
            pass
    return os.environ.get(name, default)


def _ai_binding(request: Request) -> Any:
    override = getattr(app.state, "ai_override", None)
    if override is not None:
        return override
    env = request.scope.get("env")
    if env is None:
        return None
    try:
        return getattr(env, "AI")
    except Exception:
        return None


def _to_python(value: Any) -> Any:
    if hasattr(value, "to_py"):
        try:
            value = value.to_py()
        except Exception:
            pass
    if isinstance(value, dict):
        return {str(k): _to_python(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_python(v) for v in value]
    return value


async def require_internal(
    request: Request,
    authorization: str | None = Header(default=None),
) -> None:
    expected = _env(request, "AI_SERVICE_TOKEN")
    if not expected or len(expected) < 24:
        raise ApiError(503, "service_not_configured")
    supplied = authorization.removeprefix("Bearer ").strip() if authorization and authorization.startswith("Bearer ") else ""
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise ApiError(401, "unauthorized")


@app.middleware("http")
async def payload_limit(request: Request, call_next):
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > MAX_BODY_BYTES:
                return JSONResponse(status_code=413, content={"ok": False, "error": {"code": "payload_too_large"}})
        except ValueError:
            return JSONResponse(status_code=400, content={"ok": False, "error": {"code": "invalid_content_length"}})
    if request.method in {"POST", "PUT", "PATCH"}:
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"ok": False, "error": {"code": "payload_too_large"}})
    return await call_next(request)


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status, content={"ok": False, "error": {"code": exc.code}})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"ok": False, "error": {"code": "validation_error"}})


@app.exception_handler(Exception)
async def unhandled_error_handler(_request: Request, exc: Exception):
    # Never log request content, environment values, stack traces, or provider responses.
    print({"event": "rega_ai_python.unhandled", "type": type(exc).__name__})
    return JSONResponse(status_code=500, content={"ok": False, "error": {"code": "internal_error"}})


@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "rega-ai-python",
        "version": "1",
        "capabilities": ["embed", "rerank", "process"],
    }


def _validate_texts(texts: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in texts:
        if not isinstance(value, str):
            raise ApiError(422, "validation_error")
        value = value.strip()
        if not value or len(value) > MAX_ITEM_CHARS:
            raise ApiError(422, "validation_error")
        cleaned.append(value)
    return cleaned


def _extract_vectors(raw: Any, expected: int) -> list[list[float]]:
    payload = _to_python(raw)
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list) or len(data) != expected:
        raise ApiError(503, "embedding_unavailable")
    vectors: list[list[float]] = []
    for row in data:
        if not isinstance(row, list) or not row:
            raise ApiError(503, "embedding_unavailable")
        try:
            vector = [float(value) for value in row]
        except (TypeError, ValueError):
            raise ApiError(503, "embedding_unavailable") from None
        if not all(math.isfinite(value) for value in vector):
            raise ApiError(503, "embedding_unavailable")
        vectors.append(vector)
    return vectors


async def _embed(request: Request, texts: list[str]) -> tuple[list[list[float]], str]:
    ai = _ai_binding(request)
    if ai is None:
        raise ApiError(503, "ai_binding_unavailable")
    model = _env(request, "AI_EMBEDDING_MODEL", DEFAULT_EMBED_MODEL) or DEFAULT_EMBED_MODEL
    try:
        raw = await ai.run(model, {"text": texts})
    except Exception:
        raise ApiError(503, "embedding_unavailable") from None
    return _extract_vectors(raw, len(texts)), model


@app.post("/v1/embed", dependencies=[Depends(require_internal)])
async def embed(payload: EmbedRequest, request: Request):
    texts = _validate_texts(payload.texts)
    vectors, model = await _embed(request, texts)
    return {"ok": True, "model": model, "vectors": vectors}


def _extract_ranking(raw: Any, count: int) -> list[tuple[int, float]]:
    payload = _to_python(raw)
    rows: Any
    if isinstance(payload, dict):
        rows = payload.get("response", payload.get("data"))
    else:
        rows = payload
    if not isinstance(rows, list):
        raise ApiError(503, "rerank_unavailable")

    out: list[tuple[int, float]] = []
    seen: set[int] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        index = row.get("id", row.get("index"))
        score = row.get("score")
        try:
            index = int(index)
            score = float(score)
        except (TypeError, ValueError):
            continue
        if 0 <= index < count and index not in seen and math.isfinite(score):
            out.append((index, score))
            seen.add(index)
    if not out:
        raise ApiError(503, "rerank_unavailable")
    return sorted(out, key=lambda item: item[1], reverse=True)


@app.post("/v1/rerank", dependencies=[Depends(require_internal)])
async def rerank(payload: RerankRequest, request: Request):
    ai = _ai_binding(request)
    if ai is None:
        raise ApiError(503, "ai_binding_unavailable")
    model = _env(request, "AI_RERANK_MODEL", DEFAULT_RERANK_MODEL) or DEFAULT_RERANK_MODEL
    top_k = min(payload.top_k or len(payload.items), len(payload.items))
    contexts = [{"text": item.text} for item in payload.items]
    try:
        raw = await ai.run(model, {"query": payload.query, "contexts": contexts, "top_k": top_k})
    except Exception:
        raise ApiError(503, "rerank_unavailable") from None

    ranking = _extract_ranking(raw, len(payload.items))[:top_k]
    return {
        "ok": True,
        "model": model,
        "items": [{"id": payload.items[index].id, "score": score} for index, score in ranking],
    }


def _normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).replace("\r\n", "\n").replace("\r", "\n")
    value = "".join(ch for ch in value if ch in "\n\t" or unicodedata.category(ch) != "Cc")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def _language(value: str) -> str:
    if re.search(r"[ڕڵڤۆێە]", value):
        return "ckb"
    if re.search(r"[êîûşçÊÎÛŞÇ]", value):
        return "kmr"
    if re.search(r"[\u0600-\u06ff]", value):
        return "arabic-script"
    if re.search(r"[ğışİĞŞ]", value):
        return "tr"
    if re.search(r"[äöüßÄÖÜ]", value):
        return "de"
    if re.search(r"[A-Za-z]", value):
        return "latin"
    return "unknown"


def _chunks(value: str, chunk_size: int, overlap: int) -> list[str]:
    if overlap >= chunk_size:
        overlap = max(0, chunk_size // 4)
    if len(value) <= chunk_size:
        return [value] if value else []

    chunks: list[str] = []
    start = 0
    while start < len(value) and len(chunks) < 64:
        end = min(len(value), start + chunk_size)
        if end < len(value):
            split = max(value.rfind("\n", start + chunk_size // 2, end), value.rfind(". ", start + chunk_size // 2, end))
            if split > start:
                end = split + 1
        piece = value[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(value):
            break
        start = max(start + 1, end - overlap)
    return chunks


@app.post("/v1/process", dependencies=[Depends(require_internal)])
async def process(payload: ProcessRequest):
    normalized = _normalize(payload.text)
    return {
        "ok": True,
        "language": _language(normalized),
        "normalized": normalized,
        "chunks": _chunks(normalized, payload.chunk_size, payload.overlap),
    }
