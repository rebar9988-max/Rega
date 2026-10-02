import { ProviderError, kindForStatus, parseRetryAfter, scrub } from "../errors";
import type { AiProvider, CallOptions, GenerateRequest, Message, ProviderOutput } from "../types";

export type AnthropicConfig = { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch };

type AnthropicResponse = {
  content?: { type?: string; text?: string }[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** Messages API version header (https://platform.claude.com/docs/en/api/overview). */
const API_VERSION = "2023-06-01";

/**
 * Newer Claude models reject a conversation that ends with an assistant turn (prefill), so the turns sent always
 * end with a user message (leading assistant turns are dropped as well). Pure; exported for tests.
 */
export function anthropicTurns(messages: Message[]): Message[] {
  let start = 0;
  let end = messages.length;
  while (start < end && messages[start].role !== "user") start += 1;
  while (end > start && messages[end - 1].role !== "user") end -= 1;
  return messages.slice(start, end);
}

/**
 * Anthropic Claude via the Messages API. The key travels in the `x-api-key` header, never in the URL.
 * Model-agnostic request shape: no custom temperature (newer Claude models reject non-default sampling values),
 * no prefill, no thinking parameter.
 */
export function createAnthropic(config: AnthropicConfig): AiProvider {
  const base = (config.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "");
  const doFetch = config.fetchImpl ?? fetch;

  return {
    id: "anthropic",
    label: "Anthropic Claude",
    model: config.model,
    tasks: ["chat", "summarize", "translate", "classify"],
    async generate(req: GenerateRequest, { signal }: CallOptions): Promise<ProviderOutput> {
      const messages = anthropicTurns(req.messages);
      if (messages.length === 0) throw new ProviderError("bad_request", undefined, "no user message");

      const response = await doFetch(`${base}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": config.apiKey, "anthropic-version": API_VERSION },
        body: JSON.stringify({
          model: config.model,
          system: req.system,
          messages,
          max_tokens: req.maxOutputTokens ?? 1024,
        }),
        signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ProviderError(kindForStatus(response.status), response.status, scrub(body), parseRetryAfter(response.headers.get("retry-after")));
      }

      const json = (await response.json()) as AnthropicResponse;
      // A refusal is an HTTP 200 with stop_reason "refusal": treat it like other vendors' safety blocks.
      if (json.stop_reason === "refusal") throw new ProviderError("blocked", 200, "refusal");
      const content = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
      if (!content) throw new ProviderError("empty", 200, json.stop_reason ?? "");

      return {
        content,
        model: config.model,
        usage: { tokensIn: json.usage?.input_tokens ?? 0, tokensOut: json.usage?.output_tokens ?? 0 },
      };
    },
  };
}
