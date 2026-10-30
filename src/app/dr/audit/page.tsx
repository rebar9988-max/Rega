import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import type { Locale } from "@/i18n/locales";
import { AUDIT_PER_PAGE, auditHref, auditWhere, parseAuditFilters } from "@/features/admin-audit/filters";
import { AuditLogTable } from "@/features/admin-audit/AuditLogTable";
import { AuditFilters } from "@/features/admin-audit/AuditFilters";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireDr("audit.read");
  // Filters come from the URL and are validated (features/admin-audit/filters.ts); unknown values are ignored.
  const filters = parseAuditFilters(await searchParams);
  const { page } = filters;
  const where = auditWhere(filters);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * AUDIT_PER_PAGE, take: AUDIT_PER_PAGE, select: { id: true, actorEmail: true, action: true, entity: true, entityId: true, createdAt: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PER_PAGE));

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">{t("dashboard.auditLogs")}</h1>
      <AuditFilters value={filters} labels={{ action: t("dashboard.action"), entity: t("dashboard.entity"), actor: t("dashboard.filterActor"), apply: t("dashboard.filterApply"), reset: t("dashboard.filterReset") }} />
      <AuditLogTable rows={rows} locale={locale} empty={t("dashboard.empty")}
        labels={{ time: t("dashboard.time"), actor: t("dashboard.actor"), action: t("dashboard.action"), entity: t("dashboard.entity") }} />
      {pages > 1 && (
        <nav aria-label={t("common.page")} className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={auditHref(filters, page - 1)} className="font-semibold text-brand-text">{t("common.previous")}</Link> : <span />}
          <span className="text-muted">{t("common.page")} {page} {t("common.of")} {pages}</span>
          {page < pages ? <Link href={auditHref(filters, page + 1)} className="font-semibold text-brand-text">{t("common.next")}</Link> : <span />}
        </nav>
      )}
    </>
  );
}
