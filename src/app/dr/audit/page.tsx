import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, type Locale } from "@/i18n/locales";
import { Ltr } from "@/components/ui/Bidi";

const PER_PAGE = 30;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireDr("audit.read");
  const page = Math.min(500, Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1));
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const [total, rows] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, actorEmail: true, action: true, entity: true, entityId: true, createdAt: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">{t("dashboard.auditLogs")}</h1>
      {rows.length === 0 ? <p className="text-muted">{t("dashboard.empty")}</p> : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead className="bg-surface-2 text-muted"><tr>{["time", "actor", "action", "entity"].map((c) => <th key={c} scope="col" className="px-4 py-3 text-start font-semibold">{t(`dashboard.${c}`)}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-3"><Ltr>{r.actorEmail ?? "—"}</Ltr></td>
                  <td className="px-4 py-3"><Ltr>{r.action}</Ltr></td>
                  <td className="px-4 py-3"><Ltr>{r.entity}{r.entityId ? `:${r.entityId.slice(0, 8)}` : ""}</Ltr></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label={t("common.page")} className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/dr/audit?page=${page - 1}`} className="font-semibold text-brand">{t("common.previous")}</Link> : <span />}
          <span className="text-muted">{t("common.page")} {page} {t("common.of")} {pages}</span>
          {page < pages ? <Link href={`/dr/audit?page=${page + 1}`} className="font-semibold text-brand">{t("common.next")}</Link> : <span />}
        </nav>
      )}
    </>
  );
}
