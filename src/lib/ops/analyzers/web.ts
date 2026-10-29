/**
 * AGENT 03 — QA Automation and AGENT 04 — Performance Inspector (pure analysis of bounded live probes).
 * Probes come from the Worker itself, so timings describe the server/edge, not a visitor's device. Real-browser
 * checks (mobile interactions, Lighthouse) stay in the existing CI workflows and are reported as such.
 */
import { check } from "../core";
import type { Check, FindingItem, Inspection } from "../types";
import { htmlLangDir, scriptSources, type ProbeResult } from "../probe";

export type QaTarget = { kind: "home" | "list" | "search" | "category" | "business" | "city" | "health" | "robots" | "sitemap"; url: string; locale?: string; expect?: { lang: string; dir: string } };
export type QaRouteIntegrity = { badCategorySlugs: string[]; badBusinessSlugs: string[]; publishedWithoutCategory: string[] };

const path = (url: string) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return url; } };
const short = (p: ProbeResult): FindingItem => ({ label: `${path(p.url)} → ${p.status || p.error}` });
/** A client error page (Next.js) or the generic error boundary rendered with a 200. */
const ERROR_MARKERS = /Application error: a client-side exception|__next_error__|data-rega-error-boundary/;

export function analyzeQa(targets: QaTarget[], results: ProbeResult[], integrity: QaRouteIntegrity): Inspection {
  const checks: Check[] = [];
  const pairs = targets.map((t, i) => ({ t, p: results[i] })).filter((x) => x.p);
  const edgeBlocked = pairs.filter(({ p }) => p.status === 403 && /cloudflare/i.test(p.headers.server ?? ""));
  const failed = pairs.filter(({ p }) => !edgeBlocked.some((e) => e.p === p) && (p.status !== 200 || ERROR_MARKERS.test(p.body)));
  const skipped = pairs.filter(({ p }) => p.error === "budget" || p.error === "aborted");

  checks.push(check.items("qa.routes", failed.filter(({ p }) => !skipped.some((s) => s.p === p)).map(({ p }) => short(p)), "fail",
    "هەندێک ڕێگەی گشتی وەڵامی هەڵەیان دایەوە.", `هەموو ${pairs.length - skipped.length} ڕێگە پشکنراوەکە HTTP 200 بوون بێ پەڕەی هەڵە.`, "لۆگی Worker و دواین deploy بپشکنە."));
  if (edgeBlocked.length) checks.push({ code: "qa.edge_blocked", result: "warn", message: `${edgeBlocked.length} داواکاریی پشکنەر لەلایەن پاراستنی Cloudflare ڕێگری لێکرا (403)؛ ئەنجام پشتڕاست نییە.`, items: edgeBlocked.map(({ p }) => short(p)), action: "ئەنجامی CI «Production browser check» ببینە." });
  if (skipped.length) checks.push(check.info("qa.budget", `${skipped.length} ڕێگە بەهۆی سنووری داواکاری یان کات نەپشکنران.`));

  const langMismatch = pairs.filter(({ t, p }) => t.expect && p.status === 200 && (() => { const h = htmlLangDir(p.body); return h.lang !== t.expect!.lang || h.dir !== t.expect!.dir; })());
  checks.push(check.items("qa.language_direction", langMismatch.map(({ t, p }) => ({ label: `${path(p.url)} (${t.expect!.lang}/${t.expect!.dir})` })), "fail",
    "زمان یان ئاراستەی (lang/dir) هەندێک پەڕە هەڵەیە.", "گۆڕینی زمان: lang و dirی هەموو پەڕە پشکنراوەکان دروستن (RTL/LTR).", "LOCALE_META و layoutی [locale] بپشکنە."));

  const noAlternates = pairs.filter(({ t, p }) => t.kind === "home" && p.status === 200 && !/hreflang="x-default"/i.test(p.body));
  checks.push(check.items("qa.hreflang", noAlternates.map(({ p }) => short(p)), "warn", "پەڕەی سەرەکی بەستەری hreflangی زمانەکانی نییە.", "بەستەرەکانی hreflang (لەگەڵ x-default) هەن.", "metadata.alternates بپشکنە."));

  const searchPage = pairs.find(({ t }) => t.kind === "search");
  checks.push(searchPage && searchPage.p.status === 200 ? check.pass("qa.search", "پەڕەی گەڕان و فلتەر وەڵام دەداتەوە.") : check.skip("qa.search", "پەڕەی گەڕان نەپشکنرا."));

  const bad = [...integrity.badCategorySlugs.map((s) => ({ label: `category:${s}` })), ...integrity.badBusinessSlugs.map((s) => ({ label: `business:${s}` }))];
  checks.push(check.items("qa.route_integrity", bad, "fail", `${bad.length} ڕێگەی گشتی slugی نادروستیان هەیە (بەستەری شکاو).`, "slugی هەموو پۆل و بازرگانییە گشتییەکان دروستن.", "slugەکان لە /dr ڕاست بکەرەوە."));
  checks.push(check.items("qa.category_navigation", integrity.publishedWithoutCategory.map((label) => ({ label })), "warn", `${integrity.publishedWithoutCategory.length} بازرگانیی بڵاوکراو لە هیچ پۆلێکی گشتیدا دەرناکەون.`, "هەموو بازرگانییە بڵاوکراوەکان لە ڕێگەی پۆلەکانەوە دەگەیەنرێن.", "پۆلی چالاک بۆیان دیاری بکە."));

  checks.push(check.skip("qa.mobile_interactions", "تاقیکردنەوەی کلیک و مۆبایل لە CI دەکرێت (Production browser check: Chromium desktop + mobile)."));

  return { inspected: pairs.length + integrity.badBusinessSlugs.length + integrity.badCategorySlugs.length, checks, evidence: [...pairs.map(({ p }) => `HTTP ${p.status || p.error} ${path(p.url)} ${p.totalMs} ms`), "D1 Category/Business slugs (public only)", "CI: .github/workflows/production-browser.yml, ci.yml (Playwright E2E)"] };
}

/** Thresholds of a Worker-side probe (TTFB includes D1 queries of an uncached page). */
export const PERF = Object.freeze({ ttfbWarnMs: 800, ttfbFailMs: 2_000, htmlWarnBytes: 300_000, scriptsWarn: 30 });
export const LIGHTHOUSE_TARGETS = Object.freeze({ performance: 95, accessibility: 100, bestPractices: 100, seo: 100 });

export function analyzePerformance(results: ProbeResult[]): Inspection {
  const ok = results.filter((p) => p.status === 200);
  const checks: Check[] = [];
  const label = (p: ProbeResult, v: string): FindingItem => ({ label: `${path(p.url)}: ${v}` });

  const slowFail = ok.filter((p) => p.ttfbMs > PERF.ttfbFailMs);
  const slowWarn = ok.filter((p) => p.ttfbMs > PERF.ttfbWarnMs && p.ttfbMs <= PERF.ttfbFailMs);
  checks.push(slowFail.length
    ? { code: "performance.ttfb", result: "fail", message: `${slowFail.length} پەڕە زیاتر لە ${PERF.ttfbFailMs} ms بۆ یەکەم بایت چاوەڕێیان کرد.`, items: slowFail.map((p) => label(p, `${p.ttfbMs} ms (${p.headers["x-rega-cache"] ?? p.headers["cf-cache-status"] ?? "?"})`)), action: "کوێرییەکانی D1 و edge cacheی ئەم پەڕانە بپشکنە." }
    : check.items("performance.ttfb", slowWarn.map((p) => label(p, `${p.ttfbMs} ms`)), "warn", `${slowWarn.length} پەڕە خاون (>${PERF.ttfbWarnMs} ms).`, `هەموو پەڕەکان لە ژێر ${PERF.ttfbWarnMs} ms یەکەم بایتیان گەیشت.`, "کاشکردن و ژمارەی کوێرییەکان بپشکنە."));

  const heavy = ok.filter((p) => p.bytes > PERF.htmlWarnBytes || p.truncated);
  checks.push(check.items("performance.html_size", heavy.map((p) => label(p, `${Math.round(p.bytes / 1024)} KB`)), "warn", `${heavy.length} پەڕە HTMLی گەورەیان هەیە.`, `قەبارەی HTMLی هەموو پەڕەکان لە ژێر ${Math.round(PERF.htmlWarnBytes / 1024)} KBە.`, "داتای ناو پەڕە (RSC payload) کەم بکەرەوە."));

  const manyScripts = ok.filter((p) => scriptSources(p.body).length > PERF.scriptsWarn);
  checks.push(check.items("performance.scripts", manyScripts.map((p) => label(p, `${scriptSources(p.body).length} scripts`)), "warn", `${manyScripts.length} پەڕە فایلی JavaScriptی زۆر دادەبەزێنن.`, `هەموو پەڕەکان کەمتر لە ${PERF.scriptsWarn} فایلی JavaScript بار دەکەن.`, "importی قورس بۆ client componentەکان بپشکنە."));

  const third = ok.filter((p) => scriptSources(p.body).some((s) => /^https?:\/\//.test(s) && !/rega24\.com|cloudflareinsights\.com/.test(s)));
  checks.push(check.items("performance.third_party", third.map((p) => label(p, "third-party script")), "warn", "JavaScriptی لایەنی سێیەم دۆزرایەوە.", "هیچ JavaScriptێکی لایەنی سێیەم (جگە لە Cloudflare Web Analytics) بار ناکرێت.", "سەرچاوەی scriptەکە بپشکنە."));

  const failedProbes = results.filter((p) => p.status !== 200);
  if (failedProbes.length) checks.push(check.info("performance.unmeasured", `${failedProbes.length} پەڕە نەپێوران (${failedProbes.map((p) => p.status || p.error).join(", ")}).`));

  checks.push(check.skip("performance.lighthouse", `Lighthouse لە Worker ناکرێت؛ ئامانجەکان: performance ${LIGHTHOUSE_TARGETS.performance}، accessibility ${LIGHTHOUSE_TARGETS.accessibility}، best-practices ${LIGHTHOUSE_TARGETS.bestPractices}، SEO ${LIGHTHOUSE_TARGETS.seo} — ئەنجامی پێوانەکراو لە PROJECT_MEMORY.md تۆمار دەکرێت.`));
  checks.push(check.skip("performance.core_web_vitals", "داتای مەیدانیی Core Web Vitals لێرە بەردەست نییە (هیچ خزمەتگوزارییەکی پارەدار زیاد نەکرا)."));

  return { inspected: results.length, checks, evidence: results.map((p) => `HTTP ${p.status || p.error} ${path(p.url)} ttfb ${p.ttfbMs} ms, total ${p.totalMs} ms, ${p.bytes} B, cache ${p.headers["x-rega-cache"] ?? p.headers["cf-cache-status"] ?? "-"}`) };
}
