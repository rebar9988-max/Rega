import os

from fastapi.testclient import TestClient

from app import app

TOKEN = "test-token-0123456789abcdef0123456789"


class FakeAI:
    async def run(self, model, payload):
        if model.endswith("bge-m3"):
            return {"data": [[1.0, 0.0], [0.0, 1.0]][: len(payload["text"])]}
        if model.endswith("bge-reranker-base"):
            return {"response": [{"id": 1, "score": 0.91}, {"id": 0, "score": 0.12}]}
        raise RuntimeError("unexpected model")


class FailingAI:
    async def run(self, _model, _payload):
        raise RuntimeError("provider secret-ish detail must not escape")


def client(ai=None):
    os.environ["AI_SERVICE_TOKEN"] = TOKEN
    app.state.ai_override = ai
    return TestClient(app, raise_server_exceptions=False)


def auth():
    return {"authorization": f"Bearer {TOKEN}"}


def test_health_is_public_and_safe():
    response = client().get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["service"] == "rega-ai-python"
    assert "AI_SERVICE_TOKEN" not in response.text


def test_internal_endpoints_require_server_token():
    response = client(FakeAI()).post("/v1/process", json={"text": "hello"})
    assert response.status_code == 401
    assert response.json() == {"ok": False, "error": {"code": "unauthorized"}}


def test_validation_and_payload_limits_are_structured():
    c = client(FakeAI())
    invalid = c.post("/v1/rerank", headers=auth(), json={"query": "", "items": []})
    assert invalid.status_code == 422
    assert invalid.json() == {"ok": False, "error": {"code": "validation_error"}}

    too_large = c.post("/v1/process", headers={**auth(), "content-length": "200000"}, content=b"{}")
    assert too_large.status_code == 413
    assert too_large.json()["error"]["code"] == "payload_too_large"


def test_text_processing_normalizes_detects_and_chunks():
    response = client(FakeAI()).post(
        "/v1/process",
        headers=auth(),
        json={"text": "ڕێگا   بۆ خزمەتگوزاری\n\nBerlin", "chunk_size": 256, "overlap": 32},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["language"] == "ckb"
    assert "  " not in body["normalized"]
    assert body["chunks"]


def test_embedding_uses_workers_ai_binding():
    response = client(FakeAI()).post("/v1/embed", headers=auth(), json={"texts": ["ڕێگا", "Restaurant"]})
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "@cf/baai/bge-m3"
    assert body["vectors"] == [[1.0, 0.0], [0.0, 1.0]]


def test_rerank_returns_semantic_order_by_original_candidate_id():
    response = client(FakeAI()).post(
        "/v1/rerank",
        headers=auth(),
        json={"query": "restaurant", "items": [{"id": "first", "text": "lawyer"}, {"id": "second", "text": "restaurant"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == ["second", "first"]
    assert body["model"] == "@cf/baai/bge-reranker-base"


def test_workers_ai_failure_is_safe_and_does_not_expose_provider_error():
    response = client(FailingAI()).post("/v1/embed", headers=auth(), json={"texts": ["safe input"]})
    assert response.status_code == 503
    assert response.json() == {"ok": False, "error": {"code": "embedding_unavailable"}}
    assert "secret-ish" not in response.text
