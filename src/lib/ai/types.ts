/**
 * REGA AI Gateway — shared types.
 * This folder (except index.ts) is framework-free so it can be unit-tested without Next.js.
 */

/** What the caller wants done. Routing chooses providers per task. */
export type Task = "chat" | "summarize" | "translate" | "classify";
export const TASKS: readonly Task[] = ["chat", "summarize", "translate", "classify"];

export type Message = { role: "user" | "assistant"; content: string };

export type GenerateRequest = {
  task: Task;
  system: string;
  messages: Message[];
  temperature?: number;
  maxOutputTokens?: number;
};

export type ProviderOutput = {
  content: string;
  model: string;
  usage?: { tokensIn: number; tokensOut: number };
};

export type CallOptions = { signal: AbortSignal };

/** One AI vendor. Adding a vendor = a factory implementing this + one catalog() entry in runtime.ts. */
export interface AiProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  readonly tasks: readonly Task[];
  generate(request: GenerateRequest, options: CallOptions): Promise<ProviderOutput>;
}

/** `quota`: the account has no balance/credits left (HTTP 402, e.g. DeepSeek, OpenRouter). */
export type FailureKind = "timeout" | "rate_limit" | "auth" | "quota" | "bad_request" | "server" | "network" | "blocked" | "empty";

export type Attempt = { provider: string; ok: boolean; kind?: FailureKind; status?: number; latencyMs: number };

export type GenerateResult = ProviderOutput & { provider: string; latencyMs: number; attempts: Attempt[] };

export type Routing = Record<Task, string[]>;

export type GatewayLogger = {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
};
