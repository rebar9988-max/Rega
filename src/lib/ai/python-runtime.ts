import "server-only";
import { serverEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import type { SearchHit } from "@/lib/search/types";
import { rerankWithService, type PythonAiClientConfig } from "./python-client";

function config(): PythonAiClientConfig | null {
  const env = serverEnv();
  if (!env.AI_SERVICE_URL || !env.AI_SERVICE_TOKEN) return null;
  return {
    baseUrl: env.AI_SERVICE_URL,
    token: env.AI_SERVICE_TOKEN,
    timeoutMs: env.AI_SERVICE_TIMEOUT_MS,
  };
}

/**
 * Optional advanced semantic pass. Postgres remains the primary retriever and the authoritative source of facts.
 * Any Python error returns the candidates unchanged, so the AI engine can never make the REGA assistant unavailable.
 */
export async function rerankWithPython(query: string, hits: SearchHit[]): Promise<SearchHit[]> {
  const started = Date.now();
  const ranked = await rerankWithService(
    config(),
    query,
    hits,
    (hit) => ({
      id: hit.id,
      text: [hit.title, hit.subtitle, hit.context].filter(Boolean).join("\n").slice(0, 4_000),
    }),
    (error) => log.warn("ai.python.rerank_fallback", { kind: error.kind, status: error.status }),
  );

  if (ranked.used) {
    log.info("ai.python.rerank", {
      candidates: hits.length,
      model: ranked.model,
      latencyMs: Date.now() - started,
    });
  }
  return ranked.items;
}
