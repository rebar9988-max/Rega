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
        if model == "@cf/google/gemma-4-26b-a4b-it":
            self.chat = payload
            return {"response": " Silav ", "usage": {"prompt_tokens": 12, "completion_tokens": 3}}
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


def test_branch_preview_never_calls_ai_even_with_a_valid_inherited_token(monkeypatch):
    monkeypatch.setenv("REGA_ISOLATED_PREVIEW", "1")
    with client(FailingAI()) as preview:
        response = preview.post("/embed", headers=auth(), json={"texts": ["test"]})
        assert response.status_code == 503
        assert response.json()["applicationReady"] is False
        health = preview.get("/__preview-health")
        assert health.status_code == 200
        assert health.headers["cache-control"] == "no-store"


GEMMA = "@cf/google/gemma-4-26b-a4b-it"


def test_generate_runs_only_the_verified_free_model():
    ai = FakeAI()
    c = client(ai)
    body = {"model": GEMMA, "messages": [{"role": "system", "content": "s"}, {"role": "user", "content": "hi"}], "max_tokens": 64}
    response = c.post("/v1/generate", headers=auth(), json=body)
    assert response.status_code == 200
    assert response.json() == {"ok": True, "model": GEMMA, "content": "Silav", "usage": {"tokensIn": 12, "tokensOut": 3}}
    assert ai.chat["max_tokens"] == 64 and ai.chat["messages"][1] == {"role": "user", "content": "hi"}
    for model in ["@cf/moonshotai/kimi-k2.6", "@cf/zai-org/glm-5.2", "gpt-4.1-mini"]:
        denied = c.post("/v1/generate", headers=auth(), json={**body, "model": model})
        assert denied.status_code == 400 and denied.json()["error"]["code"] == "model_not_allowed"
    assert c.post("/v1/generate", json=body).status_code == 401
    assert c.post("/v1/generate", headers=auth(), json={**body, "max_tokens": 4096}).status_code == 422


def test_generate_maps_workers_ai_limits_without_leaking_details():
    class Exhausted:
        async def run(self, _model, _payload):
            raise RuntimeError("4006: daily free allocation of 10,000 neurons used, secret-ish detail")

    response = client(Exhausted()).post("/v1/generate", headers=auth(), json={"model": GEMMA, "messages": [{"role": "user", "content": "x"}]})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "quota"
    assert "secret" not in response.text
