import { ProviderError, kindForStatus, parseRetryAfter, scrub } from "../errors";
import type { AiProvider, CallOptions, GenerateRequest, ProviderOutput, Task } from "../types";

export type OpenAiCompatibleConfig = {
  id: string;
  label: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  tasks?: readonly Task[];
  /** Extra static headers (e.g. OpenRouter's HTTP-Referer / X-Title). Never put secrets here. */
  headers?: Record<string, string>;
  /** Newer OpenAI models require `max_completion_tokens`; most other vendors still use `max_tokens`. */
  tokenParam?: "max_tokens" | "max_completion_tokens";
  /** Some model families (o-series / GPT-5) reject a custom temperature; set false to omit it. */
  sendTemperature?: boolean;
  /**
   * `reasoning_effort` for reasoning models that accept it. Their reasoning tokens are billed and share the output
   * budget, so "low" keeps short answers cheap and leaves room for the visible answer. Omitted when undefined.
   */
  reasoningEffort?: "low" | "medium" | "high";
  fetchImpl?: typeof fetch;
};

type ChatCompletion = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Generic client for the OpenAI-style `/chat/completions` protocol.
 * OpenAI, xAI Grok, Groq, DeepSeek and OpenRouter all speak it, so each of them is a config object, not new code.
 */
export function createOpenAiCompatible(config: OpenAiCompatibleConfig): AiProvider {
  const doFetch = config.fetchImpl ?? fetch;
  return {
    id: config.id,
    label: config.label,
    model: config.model,
    tasks: config.tasks ?? ["chat", "summarize", "translate", "classify"],
    async generate(req: GenerateRequest, { signal }: CallOptions): Promise<ProviderOutput> {
      const response = await doFetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}`, ...config.headers },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "system", content: req.system }, ...req.messages],
          ...(config.sendTemperature === false ? {} : { temperature: req.temperature ?? 0.3 }),
          [config.tokenParam ?? "max_tokens"]: req.maxOutputTokens ?? 1024,
          ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
          stream: false,
        }),
        signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ProviderError(kindForStatus(response.status), response.status, scrub(body), parseRetryAfter(response.headers.get("retry-after")));
      }

      const json = (await response.json()) as ChatCompletion;
      const choice = json.choices?.[0];
      const content = choice?.message?.content?.trim() ?? "";
      if (!content) throw new ProviderError(choice?.finish_reason === "content_filter" ? "blocked" : "empty", 200, choice?.finish_reason ?? "");

      return { content, model: config.model, usage: { tokensIn: json.usage?.prompt_tokens ?? 0, tokensOut: json.usage?.completion_tokens ?? 0 } };
    },
  };
}

/**
 * xAI documents `reasoning_effort` (default "high") for grok-4.5 and later; older or unknown ids get no parameter,
 * so a custom GROK_MODEL is never sent a field it may reject. Pure; exported for tests.
 */
export const grokReasoningEffort = (model: string) => (/^grok-4\.[5-9](?![0-9])/.test(model) ? ("low" as const) : undefined);

/** Groq's gpt-oss models are reasoning models that accept `reasoning_effort`; other Groq models do not. */
export const groqReasoningEffort = (model: string) => (model.startsWith("openai/gpt-oss-") ? ("low" as const) : undefined);

/** xAI Grok. */
export const createGrok = (c: { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch }) =>
  createOpenAiCompatible({
    id: "grok", label: "xAI Grok", baseUrl: c.baseUrl ?? "https://api.x.ai/v1", apiKey: c.apiKey, model: c.model,
    reasoningEffort: grokReasoningEffort(c.model), fetchImpl: c.fetchImpl,
  });

/** OpenAI. Model-agnostic request shape: no custom temperature, `max_completion_tokens`. */
export const createOpenAi = (c: { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch }) =>
  createOpenAiCompatible({
    id: "openai", label: "OpenAI", baseUrl: c.baseUrl ?? "https://api.openai.com/v1", apiKey: c.apiKey, model: c.model,
    tokenParam: "max_completion_tokens", sendTemperature: false, fetchImpl: c.fetchImpl,
  });

/** Groq (very fast open-weight models). Plain OpenAI-compatible protocol. */
export const createGroq = (c: { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch }) =>
  createOpenAiCompatible({
    id: "groq", label: "Groq", baseUrl: c.baseUrl ?? "https://api.groq.com/openai/v1", apiKey: c.apiKey, model: c.model,
    reasoningEffort: groqReasoningEffort(c.model), fetchImpl: c.fetchImpl,
  });

/** DeepSeek (low-cost). OpenAI-compatible protocol with classic `max_tokens`; an empty balance answers HTTP 402. */
export const createDeepSeek = (c: { apiKey: string; model: string; baseUrl?: string; fetchImpl?: typeof fetch }) =>
  createOpenAiCompatible({ id: "deepseek", label: "DeepSeek", baseUrl: c.baseUrl ?? "https://api.deepseek.com", apiKey: c.apiKey, model: c.model, fetchImpl: c.fetchImpl });

/**
 * OpenRouter (one key, many vendors' models; `model` is "vendor/model"). OpenAI-compatible protocol.
 * HTTP-Referer / X-Title are OpenRouter's optional, public app-attribution headers (not secrets).
 */
export const createOpenRouter = (c: { apiKey: string; model: string; baseUrl?: string; siteUrl?: string; fetchImpl?: typeof fetch }) =>
  createOpenAiCompatible({
    id: "openrouter", label: "OpenRouter", baseUrl: c.baseUrl ?? "https://openrouter.ai/api/v1", apiKey: c.apiKey, model: c.model,
    headers: { "HTTP-Referer": c.siteUrl ?? "https://www.regaplatform.com", "X-Title": "REGA Platform" }, fetchImpl: c.fetchImpl,
  });
