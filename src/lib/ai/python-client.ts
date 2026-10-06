export type PythonAiClientConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export type RerankCandidate = { id: string; text: string };
export type RerankResult = { items: { id: string; score: number }[]; model: string };

export type PythonAiFailureKind = "timeout" | "network" | "unauthorized" | "service" | "malformed";

export class PythonAiServiceError extends Error {
  constructor(public readonly kind: PythonAiFailureKind, public readonly status?: number) {
    super(`Python AI service failed: ${kind}`);
    this.name = "PythonAiServiceError";
  }
}

const cleanBaseUrl = (value: string) => value.replace(/\/+$/, "");

export function createPythonAiClient(config: PythonAiClientConfig) {
  const doFetch = config.fetchImpl ?? fetch;

  async function rerank(input: { query: string; items: RerankCandidate[]; topK?: number }): Promise<RerankResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let response: Response;
    try {
      response = await doFetch(`${cleanBaseUrl(config.baseUrl)}/v1/rerank`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({ query: input.query, items: input.items, top_k: input.topK }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new PythonAiServiceError("timeout");
      }
      throw new PythonAiServiceError("network");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new PythonAiServiceError(response.status === 401 ? "unauthorized" : "service", response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PythonAiServiceError("malformed");
    }
    if (!body || typeof body !== "object") throw new PythonAiServiceError("malformed");
    const value = body as { ok?: unknown; model?: unknown; items?: unknown };
    if (value.ok !== true || typeof value.model !== "string" || !Array.isArray(value.items)) {
      throw new PythonAiServiceError("malformed");
    }

    const items: { id: string; score: number }[] = [];
    const seen = new Set<string>();
    for (const row of value.items) {
      if (!row || typeof row !== "object") throw new PythonAiServiceError("malformed");
      const item = row as { id?: unknown; score?: unknown };
      if (typeof item.id !== "string" || typeof item.score !== "number" || !Number.isFinite(item.score) || seen.has(item.id)) {
        throw new PythonAiServiceError("malformed");
      }
      seen.add(item.id);
      items.push({ id: item.id, score: item.score });
    }
    if (items.length === 0) throw new PythonAiServiceError("malformed");
    return { model: value.model, items };
  }

  return { rerank };
}

export async function rerankWithService<T>(
  config: PythonAiClientConfig | null,
  query: string,
  candidates: readonly T[],
  toCandidate: (item: T) => RerankCandidate,
  onFailure?: (error: PythonAiServiceError) => void,
): Promise<{ items: T[]; used: boolean; model?: string }> {
  if (!config || candidates.length < 2 || !query.trim()) return { items: [...candidates], used: false };

  try {
    const client = createPythonAiClient(config);
    const requestItems = candidates.map(toCandidate);
    const original = new Map(requestItems.map((candidate, index) => [candidate.id, candidates[index]]));
    const result = await client.rerank({ query, items: requestItems, topK: requestItems.length });

    const reordered: T[] = [];
    const seen = new Set<string>();
    for (const ranked of result.items) {
      const item = original.get(ranked.id);
      if (item !== undefined && !seen.has(ranked.id)) {
        reordered.push(item);
        seen.add(ranked.id);
      }
    }
    for (const candidate of requestItems) {
      if (!seen.has(candidate.id)) reordered.push(original.get(candidate.id)!);
    }
    return { items: reordered, used: true, model: result.model };
  } catch (error) {
    const safe = error instanceof PythonAiServiceError ? error : new PythonAiServiceError("service");
    onFailure?.(safe);
    return { items: [...candidates], used: false };
  }
}
