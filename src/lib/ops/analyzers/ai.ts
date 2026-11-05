/**
 * AGENT 10 — AI Discovery Inspector (pure analysis). Deterministic retrieval tests only: it never calls a model,
 * never switches the public assistant on or off and never reads conversation text into its report.
 */
import { check } from "../core";
import { PROVIDER_BILLING, WORKERS_AI, costDecision, permittedProviderIds } from "../../ai/routing";
import type { Check, Inspection } from "../types";

export type AiFacts = {
  flag: { enabled: boolean; rollout: number } | null;
  codeDefault: boolean;
  provider: string;
  /** Provider ids with a configured key (booleans only, never the key). */
  configuredProviders: string[];
  /** Provider id → configured model name (for the verified free-model check). */
  models: Record<string, string>;
  /** AI_DAILY_LIMIT: shared model requests per UTC day. */
  dailyLimit: number;
  /** AI_SERVICE_URL and AI_SERVICE_TOKEN are both set (Workers AI rerank via rega-ai-python). Presence only. */
  rerankService: boolean;
  /** Owner's zero-cost approvals (AI_FREE_TIER_APPROVED / AI_PAID_APPROVED): provider ids only. */
  approvedFree: string[];
  approvedPaid: string[];
  /** Effective Workers AI rerank cap per UTC day. */
  rerankLimit: number;
  /** Today's atomic reservations (AiUsageDaily provider "_budget"). */
  modelAttemptsToday: number;
  rerankCallsToday: number;
  /** Today's Neurons reserved from the one shared Workers AI budget (rerank + chat), and that budget. */
  workersAiNeuronsToday: number;
  workersAiNeuronBudget: number;
  publicFilter: { status?: unknown; verified?: unknown; deletedAt?: unknown; archivedAt?: unknown };
  nonsenseHits: number;
  /** Retrieval for names of listings that are NOT public: how many of them came back. */
  hiddenProbes: number;
  hiddenLeaks: number;
  /** Retrieval for public listing names: hits that are not in the public set. */
  publicProbes: number;
  nonPublicHits: number;
  /** Stored assistant answers scanned for listing links; links to non-public listings = unsupported claims. */
  answersScanned: number;
  unsupportedLinks: number;
};

export function analyzeAi(f: AiFacts): Inspection {
  const checks: Check[] = [];
  const on = Boolean(f.flag?.enabled) && (f.flag?.rollout ?? 0) > 0;
  checks.push(on
    ? { code: "ai.public_flag", result: "warn", message: `یاریدەدەری AIی گشتی چالاکە (rollout ${f.flag!.rollout}%). ئەم بریکارە بە خۆکار نایگۆڕێت.`, action: "ئەگەر نەتەوێت، لە /dr/ai بە دەست بیکوژێنەرەوە." }
    : check.pass("ai.public_flag", "یاریدەدەری AIی گشتی کوژاوەتەوە."));
  checks.push(f.codeDefault === false
    ? check.pass("ai.default_off", "بەهای بنەڕەتی public.aiSearch لە کۆددا false ە.")
    : { code: "ai.default_off", result: "fail", message: "بەهای بنەڕەتی public.aiSearch لە کۆددا false نییە.", action: "src/lib/flags.ts ڕاست بکەرەوە." });
  // €0 guarantee (PM-01): the exact providers the gateway builds (AI_PROVIDER, then the owner's zero-cost approvals).
  const policy = { approvedFree: f.approvedFree, approvedPaid: f.approvedPaid };
  const { active, blocked } = permittedProviderIds(f.provider, f.configuredProviders, policy, f.models);
  const paid = active.filter((id) => PROVIDER_BILLING[id] !== "free-tier");
  const free = active.filter((id) => PROVIDER_BILLING[id] === "free-tier");
  checks.push(paid.length
    ? { code: "ai.paid_providers", result: "warn", message: `خاوەن ${paid.length} دابینکەری پارەداری پەسەند کردووە (${paid.join(", ")}) لە AI_PAID_APPROVED: تێچووی سفر مسۆگەر نییە.`, count: paid.length, action: "ئەگەر تێچووی سفر دەوێت، AI_PAID_APPROVED بەتاڵ بکە." }
    : free.length
      ? check.info("ai.paid_providers", `تەنها دابینکەری خۆڕایی پەسەندکراو کار دەکەن (${free.join(", ")}). هیچ دابینکەرێکی پارەدار و هیچ fallbackێکی پارەدار نییە.`)
      : check.pass("ai.paid_providers", "هیچ دابینکەرێک پەسەند نەکراوە: AI بە سەلامەتی دادەخرێت و هیچ مۆدێلێک بانگ ناکرێت."));
  checks.push(blocked.length
    ? check.info("ai.cost_blocked", `${blocked.length} دابینکەری خاوەن کلیل بەهۆی سیاسەتی تێچووی سفر بلۆک کراون (${blocked.map((b) => `${b.id}: ${b.reason}`).join(", ")}).`)
    : check.pass("ai.cost_blocked", "هیچ دابینکەرێکی خاوەن کلیل بلۆک نەکراوە."));
  checks.push(f.modelAttemptsToday >= f.dailyLimit
    ? { code: "ai.daily_budget", result: "warn", message: `سنووری ڕۆژانە گەیشت: ${f.modelAttemptsToday}/${f.dailyLimit} هەوڵی مۆدێل. تا نیوەشەوی UTC هیچ مۆدێلێک بانگ ناکرێت.` }
    : check.info("ai.daily_budget", `ئەمڕۆ ${f.modelAttemptsToday}/${f.dailyLimit} هەوڵی مۆدێل (هەموو هەوڵێک، fallback و پشکنینی /dr/ai یش، پێش بانگکردن بە شێوەی atomic دەژمێردرێت).`));
  const workersAiOn = costDecision(WORKERS_AI, policy).allowed;
  checks.push(workersAiOn
    ? (f.workersAiNeuronsToday >= f.workersAiNeuronBudget
      ? { code: "ai.workers_ai_budget", result: "warn", message: `بودجەی Workers AI گەیشت: ${f.workersAiNeuronsToday}/${f.workersAiNeuronBudget} Neuron. تا نیوەشەوی UTC هیچ بانگکردنێکی Workers AI ناکرێت.` }
      : check.info("ai.workers_ai_budget", `Workers AI پەسەندکراوە (ڕیزبەندی ${f.rerankService ? "و" : "نییە،"} گفتوگۆ): ئەمڕۆ ${f.workersAiNeuronsToday}/${f.workersAiNeuronBudget} Neuron لە یەک بودجەی هاوبەش (≤ 85٪ی 10,000ی خۆڕایی). ڕیزبەندی ${f.rerankCallsToday}/${f.rerankLimit}. بەشەکە بۆ هەموو هەژمارەکەیە؛ Workerی تر لە هەمان هەژمار نابینرێن.`))
    : check.pass("ai.workers_ai_budget", "Workers AI پەسەند نەکراوە: نە ڕیزبەندی، نە گفتوگۆ (تێچووی سفر)."));
  const filterOk = f.publicFilter.status === "published" && f.publicFilter.verified === true && f.publicFilter.deletedAt === null && f.publicFilter.archivedAt === null;
  checks.push(filterOk
    ? check.pass("ai.published_only_filter", "دۆزینەوە تەنها بازرگانیی بڵاوکراو، پشتڕاستکراو و نەسڕاوە بەکاردەهێنێت (PUBLIC_BUSINESS).")
    : { code: "ai.published_only_filter", result: "fail", message: "فلتەری PUBLIC_BUSINESS تەنها تۆماری گشتی سنووردار ناکات.", action: "src/lib/search-where.ts بپشکنە." });
  checks.push(f.nonsenseHits === 0
    ? check.pass("ai.no_results", "گەڕانی بێ واتا هیچ ئەنجامێکی نەدایەوە (وەڵامی «هیچ نییە» بێ مۆدێل).")
    : { code: "ai.no_results", result: "fail", message: `گەڕانی بێ واتا ${f.nonsenseHits} ئەنجامی دایەوە.` });
  checks.push(f.hiddenProbes === 0
    ? check.skip("ai.private_data", "هیچ تۆمارێکی ناگشتی نییە بۆ تاقیکردنەوەی جیاکردنەوە.")
    : f.hiddenLeaks === 0
      ? check.pass("ai.private_data", `${f.hiddenProbes} ناوی بازرگانیی ناگشتی تاقیکرانەوە؛ هیچیان لە دۆزینەوەدا دەرنەکەوتن.`)
      : { code: "ai.private_data", result: "fail", message: `${f.hiddenLeaks} بازرگانیی ناگشتی لە دۆزینەوەی AIدا دەرکەوتن.`, action: "retrieverەکانی src/lib/search/postgres.ts بپشکنە." });
  checks.push(f.publicProbes === 0
    ? check.skip("ai.retrieval_scope", "هیچ بازرگانییەکی گشتی نییە بۆ تاقیکردنەوە.")
    : f.nonPublicHits === 0
      ? check.pass("ai.retrieval_scope", `${f.publicProbes} گەڕانی تاقیکاری تەنها تۆماری گشتییان دایەوە.`)
      : { code: "ai.retrieval_scope", result: "fail", message: `${f.nonPublicHits} ئەنجامی دۆزینەوە تۆماری ناگشتی بوون.` });
  checks.push(f.answersScanned === 0
    ? check.skip("ai.unsupported_claims", "هیچ وەڵامێکی هەڵگیراوی AI نییە بۆ پشکنین.")
    : f.unsupportedLinks === 0
      ? check.pass("ai.unsupported_claims", `${f.answersScanned} وەڵامی دواییی AI تەنها بەستەری تۆماری گشتییان تێدایە.`)
      : { code: "ai.unsupported_claims", result: "warn", message: `${f.unsupportedLinks} بەستەر لە وەڵامەکانی AIدا بۆ تۆمارێکی ناگشتی یان نەبوو دەچن.`, count: f.unsupportedLinks, action: "ڕێساکانی promptی AI و retrieverەکان بپشکنە." });
  checks.push(check.pass("ai.inspector_no_model", "ئەم پشکنینە هیچ مۆدێلێکی AI بانگ نەکرد (تێچووی سفر)."));
  return { inspected: f.hiddenProbes + f.publicProbes + 1 + f.answersScanned, checks, evidence: ["D1 FeatureFlag public.aiSearch", "env AI_PROVIDER, AI_DAILY_LIMIT, AI_FREE_TIER_APPROVED, AI_PAID_APPROVED; keys and AI_SERVICE_URL/TOKEN as presence only", "D1 AiUsageDaily _budget reservations (today)", "src/lib/ai/routing.ts PROVIDER_BILLING", "src/lib/flags.ts FLAG_DEFAULTS", "src/lib/search-where.ts PUBLIC_BUSINESS", "searchService.search (deterministic, no model)", "D1 AiMessage: assistant link paths only (text not stored)"] };
}
