/**
 * AGENT 02 — Security Inspector (pure analysis). Reads configuration *facts* (booleans, lengths, counts), live response
 * headers and aggregated failure counts. It never prints a secret, an IP address or an e-mail of another person, and it
 * never changes credentials, roles or security settings.
 */
import { check } from "../core";
import type { Check, Inspection } from "../types";
import type { ProbeResult } from "../probe";

export type SecurityFacts = {
  ownerEmails: readonly string[];
  expectedOwner: string;
  /** Stored SUPER_ADMIN rows: whether each is the owner's address (no other address is shown). */
  storedSuperAdmins: { isOwner: boolean; active: boolean }[];
  activeAdmins: number;
  authSecretLength: number;
  appEnv: string;
  isolatedPreview: boolean;
  failures24h: { password: number; code: number; oauth: number };
  /** Number of distinct client addresses with at least `ipThreshold` failures in 24 h (addresses themselves are not kept). */
  noisyClients: number;
  ipThreshold: number;
  home: ProbeResult | null;
  dr: ProbeResult | null;
  api: ProbeResult | null;
};

const REQUIRED_HEADERS: [string, (v: string) => boolean][] = [
  ["content-security-policy", (v) => /frame-ancestors 'none'/.test(v) && /object-src 'none'/.test(v)],
  ["strict-transport-security", (v) => /max-age=(\d+)/.test(v) && Number(/max-age=(\d+)/.exec(v)![1]) >= 15_552_000],
  ["x-content-type-options", (v) => v.toLowerCase() === "nosniff"],
  ["x-frame-options", (v) => v.toUpperCase() === "DENY"],
  ["referrer-policy", (v) => v.length > 0],
];

export function analyzeSecurity(f: SecurityFacts): Inspection {
  const checks: Check[] = [];

  checks.push(f.ownerEmails.length === 1 && f.ownerEmails[0] === f.expectedOwner
    ? check.pass("security.owner_allowlist", "تەنها ناونیشانی خاوەن مافی SUPER_ADMINی هەیە (SUPER_ADMIN_EMAILS).")
    : { code: "security.owner_allowlist", result: "fail", message: "لیستی SUPER_ADMIN_EMAILS لە ناونیشانی خاوەن جیاوازە.", action: "src/lib/rbac.ts بپشکنە؛ تەنها بە ڕێنمایی ڕوونی خاوەن بگۆڕدرێت." });

  const foreign = f.storedSuperAdmins.filter((a) => !a.isOwner);
  checks.push(foreign.length
    ? { code: "security.stored_super_admin", result: "warn", message: `${foreign.length} ئەکاونتی تر ڕۆڵی SUPER_ADMINی هەڵگیراوی هەیە؛ effectiveRole وەک USER مامەڵەی لەگەڵ دەکات.`, count: foreign.length, action: "لە /dr/users ڕۆڵی ئەم ئەکاونتانە بە دەست کەم بکەرەوە (بە خۆکار ناگۆڕدرێت)." }
    : check.pass("security.stored_super_admin", "هیچ ئەکاونتێکی تر ڕۆڵی SUPER_ADMINی هەڵنەگرتووە."));
  checks.push(f.storedSuperAdmins.some((a) => a.isOwner && a.active)
    ? check.pass("security.owner_account", "ئەکاونتی خاوەن چالاکە و SUPER_ADMINە.")
    : { code: "security.owner_account", result: "warn", message: "ئەکاونتی چالاکی خاوەن بە ڕۆڵی SUPER_ADMIN نەدۆزرایەوە." });
  checks.push(check.info("security.admin_count", `${f.activeAdmins} ئەکاونتی ADMINی چالاک هەیە.`, { count: f.activeAdmins }));

  checks.push(f.authSecretLength >= 32
    ? check.pass("security.auth_secret", "AUTH_SECRET ڕێکخراوە و درێژییەکەی بەسە (نرخەکەی پیشان نادرێت).")
    : { code: "security.auth_secret", result: f.authSecretLength >= 16 ? "warn" : "fail", message: "AUTH_SECRET کورتە یان نییە.", action: "نهێنییەکی نوێی ≥32 پیت لە Cloudflare دابنێ (بە خۆکار ناگۆڕدرێت)." });

  checks.push(f.appEnv === "production" && !f.isolatedPreview
    ? check.pass("security.environment", "ژینگەی production و جیاکردنەوەی preview دروستن.")
    : check.info("security.environment", `ژینگە: ${f.appEnv}${f.isolatedPreview ? " (preview جیاکراوە)" : ""}.`));

  const total = f.failures24h.password + f.failures24h.code + f.failures24h.oauth;
  checks.push(total > 20 || f.noisyClients > 0
    ? { code: "security.failed_sign_ins", result: "warn", message: `لە ٢٤ کاتژمێردا ${total} هەوڵی چوونەژوورەوەی شکستخواردوو (وشەی نهێنی ${f.failures24h.password}، کۆد ${f.failures24h.code}، OAuth ${f.failures24h.oauth}); ${f.noisyClients} ناونیشان ≥${f.ipThreshold} جار.`, count: total, action: "/dr/audit بپشکنە؛ سنووری خێرایی (rate limit) پێشتر چالاکە." }
    : check.pass("security.failed_sign_ins", `هەوڵە شکستخواردووەکانی ٢٤ کاتژمێر ئاسایین (${total}).`));

  if (f.home) {
    const missing = REQUIRED_HEADERS.filter(([h, ok]) => !f.home!.headers[h] || !ok(f.home!.headers[h])).map(([h]) => ({ label: h }));
    checks.push(f.home.status === 200
      ? check.items("security.headers", missing, "fail", `${missing.length} سەرپەڕەی ئاسایش لە پەڕەی سەرەکیدا نییە یان لاوازە.`, "سەرپەڕەکانی ئاسایش (CSP، HSTS، nosniff، DENY، Referrer-Policy) هەن.", "next.config.ts securityHeaders بپشکنە.")
      : check.skip("security.headers", `پەڕەی سەرەکی وەڵامی ${f.home.status || f.home.error} دایەوە؛ سەرپەڕەکان نەپشکنران.`));
  } else checks.push(check.skip("security.headers", "پشکنینی HTTP نەکرا."));

  if (f.dr) {
    const cache = f.dr.headers["cache-control"] ?? "";
    const ok = f.dr.status === 200 && f.dr.body.includes("data-dr-sign-in") && /no-store/.test(cache) && /noindex/.test(f.dr.headers["x-robots-tag"] ?? "");
    const leaked = /data-testid="attention"|\/dr\/businesses\//.test(f.dr.body);
    checks.push(ok && !leaked
      ? check.pass("security.dr_anonymous", "/dr بۆ میوانی نەناسراو تەنها فۆرمی چوونەژوورەوە پیشان دەدات (no-store، noindex).")
      : { code: "security.dr_anonymous", result: "fail", message: `/dr بۆ میوانی نەناسراو وەڵامی چاوەڕواننەکراوی دایەوە (${f.dr.status || f.dr.error}).`, action: "src/app/dr/layout.tsx و سەرپەڕەکانی /dr بپشکنە." });
  } else checks.push(check.skip("security.dr_anonymous", "پشکنینی /dr نەکرا."));

  if (f.api && f.api.status === 200) {
    // Anonymous list request that asks for drafts: the API must still answer with published records only.
    let rows: { status?: unknown }[] | null = null;
    try { const json = JSON.parse(f.api.body) as { data?: unknown }; rows = Array.isArray(json.data) ? (json.data as { status?: unknown }[]) : null; } catch { rows = null; }
    const leaked = rows ? rows.filter((r) => r.status !== undefined && r.status !== "published").length : 0;
    checks.push(rows && !leaked
      ? check.pass("security.api_anonymous", `API بەبێ چوونەژوورەوە تەنها تۆماری بڵاوکراو دەداتەوە (${rows.length} تۆمار پشکنران).`)
      : { code: "security.api_anonymous", result: "fail", message: rows ? `${leaked} تۆماری بڵاونەکراوە بۆ میوانی نەناسراو دەرکەوت.` : "وەڵامی API شێوەی چاوەڕوانکراوی نییە.", action: "پاسەوانی ڕێگەکانی /api/v1 بپشکنە." });
  } else checks.push(check.skip("security.api_anonymous", `پشکنینی API نەکرا (${f.api ? f.api.status || f.api.error : "—"}).`));

  checks.push(check.skip("security.repository_secrets", "پشکنینی نهێنییەکان لە کۆدی GitHub لە CI دەکرێت (tests/ops-repository.test.ts)، نەک لە Worker."));

  return {
    inspected: checks.length,
    checks,
    evidence: [
      "src/lib/rbac.ts SUPER_ADMIN_EMAILS",
      "D1 User: role counts only",
      "D1 AuditLog: auth.*.failed counts (24 h); client addresses counted, never stored in the report",
      ...[f.home, f.dr, f.api].filter(Boolean).map((p) => `HTTP ${p!.status || p!.error} ${p!.url}`),
      "CI: tests/ops-repository.test.ts (tracked-file secret scan), tests/security.test.ts, tests/super-admin-owner.test.ts",
    ],
  };
}
