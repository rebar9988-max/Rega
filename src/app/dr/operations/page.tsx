import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, formatNumber, type Locale } from "@/i18n/locales";
import { Ltr } from "@/components/ui/Bidi";
import { DrIcon } from "@/components/dr/icons";
import { StatusPill } from "@/components/dr/StatusPill";
import { BusinessActionButton } from "@/components/dr/BusinessActionButton";
import { AGENTS, type OpsReport, type RunStatus } from "@/lib/ops/types";
import { BLOCK_REASONS, OPS_LIMITS, blockMessage, newExecutionId, startOfUtcDay, type BlockReason } from "@/lib/ops/core";
import { REPORT_ACTION, recentReports, runCounts } from "@/lib/ops/store";
import { runAgentAction, runAllAction } from "./actions";

export const dynamic = "force-dynamic";

/** Report status -> the dashboard's existing status-pill tones (no new colours). */
const TONE: Record<RunStatus | "NONE", string> = { PASS: "published", WARN: "pending", FAIL: "archived", SKIPPED: "draft", BLOCKED: "draft", NONE: "draft" };

/** REGA24 Digital Operations Center — owner only. Ten read-only agents; reports are stored in the audit trail. */
export default async function Operations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireDr("operations.manage");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const count = (k: string) => (/^\d{1,3}$/.test(one(k)) ? Number(one(k)) : 0);
  const blocked = (BLOCK_REASONS as string[]).includes(one("blocked")) ? (one("blocked") as BlockReason) : null;
  // Owner-facing outcome of the last click, in Sorani (a refused run stores no report, so it is said here).
  const notice = blocked
    ? blockMessage(blocked)
    : one("ran") ? `${count("ran")} بریکار کاریان کرد · ${count("blockedCount")} ڕاگیران · ${count("notStarted")} بەهۆی سنووری کات دەستیان پێنەکرد.` : null;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("ops");
  const [history, counts, today, flag] = await Promise.all([
    recentReports(60),
    runCounts(),
    prisma.auditLog.count({ where: { action: REPORT_ACTION, createdAt: { gte: startOfUtcDay(new Date()) } } }),
    prisma.featureFlag.findUnique({ where: { key: "public.aiSearch" }, select: { enabled: true, rollout: true } }),
  ]);
  const latest = new Map<string, OpsReport>();
  for (const { report } of history) if (!latest.has(report.agent)) latest.set(report.agent, report);
  const when = (iso: string) => <time dateTime={iso}>{formatDate(new Date(iso), locale, { dateStyle: "medium", timeStyle: "short" })}</time>;
  const statusLabel = (s: RunStatus | "NONE") => t(`status_${s}`);
  const aiOn = Boolean(flag?.enabled) && (flag?.rollout ?? 0) > 0;
  const btn = "inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition";

  const policy: [string, string, boolean][] = [
    [t("policyManual"), t("on"), true],
    [t("policyScheduled"), t("policyScheduledOff"), false],
    [t("policyCi"), t("on"), true],
    [t("policyAutoApproval"), t("neverAllowed"), false],
    [t("policyAi"), aiOn ? t("aiOn") : t("aiOff"), aiOn],
  ];

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl! leading-tight! font-extrabold tracking-tight text-ink sm:text-[1.75rem]!">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("subtitle")}</p>
        </div>
        <form action={runAllAction}>
          <input type="hidden" name="executionId" value={newExecutionId("all")} />
          <BusinessActionButton testId="ops-run-all" className={`${btn} bg-brand text-brand-ink shadow-card hover:bg-brand-hover`}>
            <DrIcon name="operations" className="size-[18px]" />{t("runAll")}
          </BusinessActionButton>
        </form>
      </header>

      {notice && <p role="status" lang="ckb" dir="rtl" data-testid="ops-notice" className="mb-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">{notice}</p>}

      <div className="mb-6 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <section aria-labelledby="ops-policy" className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <h2 id="ops-policy" className="mb-3 text-sm font-bold text-ink">{t("policyTitle")}</h2>
          <dl className="grid gap-2 text-sm" data-testid="ops-policy">
            {policy.map(([k, v, on]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="text-muted">{k}</dt>
                <dd className={`font-semibold ${on ? "text-ink" : "text-muted"}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="ops-cost" className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <h2 id="ops-cost" className="mb-3 text-sm font-bold text-ink">{t("costTitle")}</h2>
          <p className="text-sm"><span className="text-muted">{t("quotaToday")}: </span><span className="font-bold tabular-nums text-ink" data-testid="ops-quota">{formatNumber(today, locale)} / {formatNumber(OPS_LIMITS.maxRunsPerDay, locale)}</span></p>
          <p className="mt-2 text-xs text-muted">{t("costNote")}</p>
          <p className="mt-2 text-xs text-muted">{t("reportLanguage")}</p>
        </section>
      </div>

      <ul className="mb-8 grid gap-4 md:grid-cols-2 [&>*]:min-w-0" data-testid="ops-agents">
        {AGENTS.map((a) => {
          const r = latest.get(a.id);
          const status: RunStatus | "NONE" = r?.status ?? "NONE";
          return (
            <li key={a.id} id={a.id} data-agent={a.id} className="flex flex-col rounded-xl border border-line bg-surface shadow-card">
              <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><span className="tabular-nums text-muted">{a.number}</span>{t(`agents.${a.nameKey}`)}</h2>
                  <p className="mt-0.5 text-xs text-muted">{a.runtime === "worker" ? t("runtime_worker") : t("runtime_workerci")}</p>
                </div>
                <StatusPill status={TONE[status]} label={statusLabel(status)} testId="ops-status" />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 text-xs sm:grid-cols-3">
                <div><dt className="text-muted">{t("lastRun")}</dt><dd className="font-semibold text-ink">{r ? when(r.checked_at) : t("never")}</dd></div>
                <div><dt className="text-muted">{t("nextRun")}</dt><dd className="font-semibold text-ink">{t("manualOnly")}</dd></div>
                <div><dt className="text-muted">{t("inspections")}</dt><dd className="font-semibold tabular-nums text-ink">{formatNumber(counts.get(a.id) ?? 0, locale)}</dd></div>
                <div><dt className="text-muted">{t("passed")}</dt><dd className="font-semibold tabular-nums text-ink">{formatNumber(r?.passed ?? 0, locale)}</dd></div>
                <div><dt className="text-muted">{t("warnings")}</dt><dd className="font-semibold tabular-nums text-ink">{formatNumber(r?.warnings ?? 0, locale)}</dd></div>
                <div><dt className="text-muted">{t("failed")}</dt><dd className="font-semibold tabular-nums text-ink">{formatNumber(r?.failed ?? 0, locale)}</dd></div>
              </dl>
              {r && <p lang="ckb" dir="rtl" className="px-4 pb-2 text-sm text-ink" data-testid="ops-summary">{r.summary}</p>}
              {r && (
                <details className="border-t border-line px-4 py-2 text-sm">
                  <summary className="cursor-pointer py-1 font-semibold text-ink">{t("details")} · {t("findings")} ({formatNumber(r.findings.length, locale)})</summary>
                  <div className="space-y-3 pb-2 pt-1">
                    {r.findings.length ? (
                      <ul className="space-y-2" data-testid="ops-findings">
                        {r.findings.map((f) => (
                          <li key={f.code} className="rounded-lg bg-surface-2/60 px-3 py-2">
                            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted"><span className="font-semibold text-ink">{t(`sev_${f.severity}`)}</span><Ltr>{f.code}</Ltr></p>
                            <p lang="ckb" dir="rtl" className="mt-0.5 text-sm text-ink">{f.message}</p>
                            {f.items?.length ? (
                              <ul className="mt-1 flex flex-wrap gap-1.5">
                                {f.items.map((i) => (
                                  <li key={i.label} className="max-w-full truncate rounded-md border border-line bg-surface px-2 py-0.5 text-xs">
                                    {i.href ? <Link href={i.href} className="text-brand hover:underline"><Ltr>{i.label}</Ltr></Link> : <Ltr>{i.label}</Ltr>}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-muted">{t("noFindings")}</p>}
                    {r.recommended_actions.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-muted">{t("actions")}</h3>
                        <ul lang="ckb" dir="rtl" className="mt-1 list-disc space-y-0.5 ps-5 text-sm">{r.recommended_actions.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-bold text-muted">{t("evidence")} · {t("inspected")}: {formatNumber(r.inspected_items, locale)} · {formatNumber(r.duration_ms, locale)} ms · {t(`cost_${r.cost_status}`)}</h3>
                      <ul className="mt-1 space-y-0.5 text-xs text-muted">{r.evidence.map((e) => <li key={e} className="break-all"><Ltr>{e}</Ltr></li>)}</ul>
                    </div>
                  </div>
                </details>
              )}
              <form action={runAgentAction} className="mt-auto border-t border-line px-4 py-3">
                <input type="hidden" name="agent" value={a.id} />
                <input type="hidden" name="executionId" value={newExecutionId(a.id)} />
                <BusinessActionButton testId={`ops-run-${a.id}`} className={`${btn} min-h-9 border border-line text-ink hover:bg-surface-2`}>{t("run")}</BusinessActionButton>
              </form>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="ops-history" className="rounded-xl border border-line bg-surface shadow-card">
        <h2 id="ops-history" className="border-b border-line px-4 py-3 text-sm font-bold text-ink">{t("history")}</h2>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm" data-testid="ops-history">
              <thead className="bg-surface-2 text-muted"><tr>{[t("colTime"), t("colAgent"), t("colStatus"), t("colDuration"), t("colExecution"), t("colActor")].map((c) => <th key={c} scope="col" className="px-4 py-2.5 text-start font-semibold">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {history.slice(0, 30).map(({ report: r, actorEmail }) => (
                  <tr key={r.execution_id}>
                    <td className="whitespace-nowrap px-4 py-2.5">{when(r.checked_at)}</td>
                    <td className="px-4 py-2.5">{t(`agents.${AGENTS.find((a) => a.id === r.agent)?.nameKey ?? "business"}`)}</td>
                    <td className="px-4 py-2.5"><StatusPill status={TONE[r.status]} label={statusLabel(r.status)} testId="ops-history-status" /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatNumber(r.duration_ms, locale)} ms</td>
                    <td className="px-4 py-2.5 text-xs"><Ltr>{r.execution_id}</Ltr></td>
                    <td className="px-4 py-2.5 text-xs"><bdi>{actorEmail ?? "—"}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-4 py-8 text-center text-sm text-muted">{t("historyEmpty")}</p>}
      </section>
    </>
  );
}
