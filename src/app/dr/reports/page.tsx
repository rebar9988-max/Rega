import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, type Locale } from "@/config/locales";
import { siteOrigin } from "@/lib/seo";
import { setReportStatus } from "./actions";

const STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;
const REASON_KEY = { illegal: "reasonIllegal", misleading: "reasonMisleading", spam: "reasonSpam", copyright: "reasonCopyright", privacy: "reasonPrivacy", other: "reasonOther" } as const;

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireDr("review.moderate");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("inbox");
  const tr = await getTranslations("report");
  const tl = await getTranslations("list");
  const where: Prisma.ReportWhereInput = status ? { status } : {};
  const rows = await prisma.report.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 100 });
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">{t("reportsTitle")}</h1>
      <nav aria-label={t("reportsTitle")} className="mb-6 flex flex-wrap gap-2 text-sm">
        {[undefined, ...STATUSES].map((s) => (
          <a key={s ?? "all"} href={s ? `/dr/reports?status=${s}` : "/dr/reports"} aria-current={s === status ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full border px-3 font-semibold ${s === status ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>{s ? t(`status_${s}`) : t("all")}</a>
        ))}
      </nav>
      {rows.length === 0 ? <p className="text-muted">{t("empty")}</p> : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const href = r.targetUrl.startsWith(siteOrigin()) ? r.targetUrl : null; // only links on this site are clickable
            return (
              <li key={r.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm" data-testid="report-row">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{tr(REASON_KEY[r.reason as keyof typeof REASON_KEY] ?? "reasonOther")} · <span className="text-muted">{t(`status_${r.status as "open"}`)}</span></span>
                  <time dateTime={r.createdAt.toISOString()} className="text-xs text-muted">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</time>
                </div>
                <p className="mb-1 break-all" dir="ltr">{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline">{r.targetUrl}</a> : r.targetUrl}</p>
                <p className="mb-2 whitespace-pre-line">{r.details}</p>
                <p className="mb-3 text-xs text-muted">{r.reporterName} · <bdi dir="ltr">{r.reporterEmail}</bdi></p>
                {r.note && <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">{r.note}</p>}
                <form action={setReportStatus} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="sr-only" htmlFor={`note-${r.id}`}>{t("note")}</label>
                  <input id={`note-${r.id}`} name="note" maxLength={1000} placeholder={t("note")} className="min-h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs" />
                  <label className="sr-only" htmlFor={`status-${r.id}`}>{t("setStatus")}</label>
                  <select id={`status-${r.id}`} name="status" defaultValue="" required className="min-h-9 rounded-lg border border-line bg-surface px-2 text-xs">
                    <option value="" disabled>{t("setStatus")}</option>
                    {STATUSES.filter((s) => s !== r.status).map((s) => <option key={s} value={s}>{t(`mark_${s}`)}</option>)}
                  </select>
                  <button type="submit" className={btn}>{tl("apply")}</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
