import { ProviderError } from "../errors";
import type { AiProvider, GenerateRequest, ProviderOutput, Task } from "../types";

/**
 * Cloudflare Workers AI as a gateway provider, executed by the existing rega-ai-python service, which owns the Workers
 * AI binding (no API key, no second binding or service). It never runs without the owner's zero-cost approval (`workers-ai` in AI_FREE_TIER_APPROVED) and a
 * verified free model. Before every call it reserves its worst-case Neuron cost from the one shared Workers AI budget
 * (src/lib/ai/budget.ts); a refused or unreadable reservation means no call (fail closed).
 */
export type WorkersAiConfig = {
  model: string;
  /** Runs the model (rega-ai-python /v1/generate); resolves to a Workers AI-shaped result. */
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
  /** Atomically reserves `neurons` of today's shared Workers AI budget; false = do not call. */
  reserveNeurons: (neurons: number) => Promise<boolean>;
  /** Worst-case Neuron cost of one call for this many prompt characters and output tokens. */
  worstNeurons: (promptChars: number, maxOutputTokens: number) => number;
};

const TASKS: readonly Task[] = ["chat", "summarize", "translate", "classify"];
const DEFAULT_MAX_OUTPUT = 1024;

function text(result: unknown): { content: string; usage?: { tokensIn: number; tokensOut: number } } {
  const r = (result ?? {}) as { response?: unknown; choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const content = typeof r.response === "string" ? r.response : typeof r.choices?.[0]?.message?.content === "string" ? (r.choices[0].message!.content as string) : "";
  const usage = r.usage && typeof r.usage.prompt_tokens === "number" ? { tokensIn: r.usage.prompt_tokens, tokensOut: r.usage.completion_tokens ?? 0 } : undefined;
  return { content: content.trim(), usage };
}

/** Workers AI errors carry codes in the message (4006 = daily free allocation used, 3040 = out of capacity). */
export function workersAiError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/4006|neuron|allocation|quota/i.test(message)) return new ProviderError("quota", 429, "workers-ai: daily allocation");
  if (/3040|capacity|429|rate/i.test(message)) return new ProviderError("rate_limit", 429, "workers-ai: capacity");
  if (/5035|403|paid plan/i.test(message)) return new ProviderError("auth", 403, "workers-ai: model needs a paid plan");
  return new ProviderError("server", 500, "workers-ai: error");
}

export function createWorkersAi(config: WorkersAiConfig): AiProvider {
  return {
    id: "workers-ai",
    label: "Cloudflare Workers AI",
    model: config.model,
    tasks: TASKS,
    async generate(request: GenerateRequest, { signal }): Promise<ProviderOutput> {
      const maxTokens = request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT;
      const promptChars = request.system.length + request.messages.reduce((n, m) => n + m.content.length, 0);
      const neurons = config.worstNeurons(promptChars, maxTokens);
      if (!(await config.reserveNeurons(neurons))) throw new ProviderError("quota", 429, "workers-ai: REGA neuron budget reached");
      if (signal.aborted) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
      const call = config.run(config.model, {
        messages: [{ role: "system", content: request.system }, ...request.messages],
        max_tokens: maxTokens,
        temperature: request.temperature ?? 0.3,
      });
      // The binding takes no AbortSignal: the gateway's timeout still ends the attempt.
      const aborted = new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })), { once: true }));
      let result: unknown;
      try {
        result = await Promise.race([call, aborted]);
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") throw error;
        throw workersAiError(error);
      }
      const out = text(result);
      if (!out.content) throw new ProviderError("empty", 200, "workers-ai: empty answer");
      return { content: out.content, model: config.model, usage: out.usage };
    },
  };
}
