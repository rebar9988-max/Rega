import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, formatNumber, type Locale } from "@/i18n/locales";
import { can } from "@/lib/rbac";
import { Ltr } from "@/components/ui/Bidi";
import { redirect } from "next/navigation";

export default async function Overview() {
  const user = await requireDr("business.read");
  // Owners see their own listings, not platform-wide totals.
  if (user.role === "BUSINESS_OWNER") redirect("/dr/businesses");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("dashboard");
  const live = { deletedAt: null };
  const [total, published, drafts, services, locations, staff, recent] = await Promise.all([
    prisma.business.count({ where: live }),
    prisma.business.count({ where: { ...live, status: "published" } }),
    prisma.business.count({ where: { ...live, status: "draft" } }),
    prisma.service.count({ where: live }),
    prisma.location.count({ where: live }),
    prisma.user.count({ where: { deletedAt: null, status: "active", role: { not: "USER" } } }),
    can(user.role, "audit.read") ? prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, actorEmail: true, action: true, entity: true, createdAt: true } }) : Promise.resolve([]),
  ]);
  const stats: [string, number][] = [["totalBusinesses", total], ["publishedBusinesses", published], ["drafts", drafts], ["totalServices", services], ["totalLocations", locations], ["staffUsers", staff]];

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">{t("overview")}</h1>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(([k, n]) => (
          <div key={k} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <dd className="text-3xl font-extrabold text-brand">{formatNumber(n, locale)}</dd>
            <dt className="text-sm text-muted">{t(k)}</dt>
          </div>
        ))}
      </dl>
      {recent.length > 0 && (
        <section className="mt-10" aria-labelledby="recent">
          <h2 id="recent" className="mb-3 text-lg font-bold">{t("recentActivity")}</h2>
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span><Ltr className="font-semibold">{r.action}</Ltr> <span className="text-muted">· {r.actorEmail ?? "—"}</span></span>
                <time dateTime={r.createdAt.toISOString()} className="text-muted">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
