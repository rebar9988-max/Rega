import { ProviderError, kindForStatus, parseRetryAfter, scrub } from "../errors";
import type { AiProvider, CallOptions, GenerateRequest, ProviderOutput } from "../types";

export type GeminiConfig = { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch };

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

/** Google Gemini via the Generative Language REST API. The key travels in a header, never in the URL. */
export function createGemini(config: GeminiConfig): AiProvider {
  const base = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const doFetch = config.fetchImpl ?? fetch;

  return {
    id: "gemini",
    label: "Google Gemini",
    model: config.model,
    tasks: ["chat", "summarize", "translate", "classify"],
    async generate(req: GenerateRequest, { signal }: CallOptions): Promise<ProviderOutput> {
      const response = await doFetch(`${base}/models/${encodeURIComponent(config.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: req.temperature ?? 0.3, maxOutputTokens: req.maxOutputTokens ?? 1024 },
        }),
        signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ProviderError(kindForStatus(response.status), response.status, scrub(body), parseRetryAfter(response.headers.get("retry-after")));
      }

      const json = (await response.json()) as GeminiResponse;
      if (json.promptFeedback?.blockReason) throw new ProviderError("blocked", 200, json.promptFeedback.blockReason);
      const candidate = json.candidates?.[0];
      const content = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      if (!content) throw new ProviderError(candidate?.finishReason === "SAFETY" ? "blocked" : "empty", 200, candidate?.finishReason ?? "");

      return {
        content,
        model: config.model,
        usage: { tokensIn: json.usageMetadata?.promptTokenCount ?? 0, tokensOut: json.usageMetadata?.candidatesTokenCount ?? 0 },
      };
    },
  };
}
