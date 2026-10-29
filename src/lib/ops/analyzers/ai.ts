/**
 * AGENT 10 — AI Discovery Inspector (pure analysis). Deterministic retrieval tests only: it never calls a model,
 * never switches the public assistant on or off and never reads conversation text into its report.
 */
import { check } from "../core";
import type { Check, Inspection } from "../types";

export type AiFacts = {
  flag: { enabled: boolean; rollout: number } | null;
  codeDefault: boolean;
  provider: string;
  /** Provider ids with a configured key (booleans only, never the key). */
  configuredProviders: string[];
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
  const paid = f.provider === "disabled" ? [] : f.configuredProviders;
  checks.push(on && paid.length
    ? { code: "ai.paid_providers", result: "warn", message: `کلیلی ${paid.length} دابینکەری AI ڕێکخراوە (${paid.join(", ")}) و یاریدەدەر چالاکە: ڕەنگە تێچوو دروست بکات. ئەم بریکارە هیچ مۆدێلێک بانگ ناکات.`, action: "پلانی هەر دابینکەرێک بپشکنە یان AI_PROVIDER=disabled دابنێ (بڕیاری خاوەن)." }
    : check.pass("ai.paid_providers", "هیچ مۆدێلێکی AI بە بێ ئاگاداری خاوەن کار ناکات."));
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
  return { inspected: f.hiddenProbes + f.publicProbes + 1 + f.answersScanned, checks, evidence: ["D1 FeatureFlag public.aiSearch", "src/lib/flags.ts FLAG_DEFAULTS", "src/lib/search-where.ts PUBLIC_BUSINESS", "searchService.search (deterministic, no model)", "D1 AiMessage: assistant link paths only (text not stored)"] };
}
