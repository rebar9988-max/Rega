import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { formatNumber, LOCALE_META, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { Text } from "@/components/ui/Bidi";
import { textWhere } from "@/lib/search-where";
import { hasGlobalBusinessAccess, managedBusinessWhere } from "@/lib/business-access";
import { updateService } from "./actions";

const PER_PAGE = 20;
const STATUSES = ["draft", "published", "archived"] as const;
type Sp = { q?: string; status?: string; business?: string; page?: string };

export default async function DrServices({ searchParams }: { searchParams: Promise<Sp> }) {
  const user = await requireDr("service.read");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 120) || undefined;
  const business = sp.business?.trim().slice(0, 64) || undefined;
  const page = Math.min(500, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const pageLang = LOCALE_META[locale].htmlLang;
  const canWrite = can(user.role, "service.write");
  const canPublish = can(user.role, "service.publish");

  const where: Prisma.ServiceWhereInput = {
    deletedAt: null,
    // Business owners see only the services of businesses they are a member of.
    business: { deletedAt: null, ...(user.role === "BUSINESS_OWNER" ? managedBusinessWhere(user) : {}) },
    ...(status ? { status } : {}),
    ...(business ? { businessId: business } : {}),
    ...textWhere(q),
  };
  const [total, rows] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE,
      select: {
        id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, status: true, featured: true, businessId: true,
        business: { select: { slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, status: true } },
        category: { select: { nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } },
      },
    }),
  ]);
  const mine = hasGlobalBusinessAccess(user.role) ? null
    : new Set((await prisma.businessMember.findMany({ where: { userId: user.id, isActive: true, businessId: { in: rows.map((r) => r.businessId) } }, select: { businessId: true } })).map((m) => m.businessId));
  const manages = (id: string) => mine === null || mine.has(id);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => `/dr/services?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(business ? { business } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  const act = (id: string, intent: string) => (
    <form key={intent} action={updateService}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="intent" value={intent} />
      <button type="submit" className={btn}>{t(`svcForm.act_${intent}`)}</button>
    </form>
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("dashboard.services")}</h1>
        {canWrite && <Link href={`/dr/services/new${business ? `?business=${encodeURIComponent(business)}` : ""}`} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover">+ {t("svcForm.new")}</Link>}
      </div>
      <form role="search" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">{t("common.search")}</label>
        <input id="q" name="q" defaultValue={q} placeholder={t("search.placeholder")} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand" />
        {business && <input type="hidden" name="business" value={business} />}
        <label htmlFor="status" className="sr-only">{t("common.status")}</label>
        <select id="status" name="status" defaultValue={status ?? ""} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">{t("common.all")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("list.apply")}</button>
      </form>
      <p aria-live="polite" className="mb-3 text-sm text-muted">{t("search.resultCount", { count: formatNumber(total, locale) })}</p>

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center" data-testid="services-empty">
          <p className="font-semibold">{t("svcForm.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("svcForm.emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-surface-2 text-muted"><tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("services.singular")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("businesses.singular")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("services.category")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <span className="font-semibold"><Text value={localize(s, "name", locale)} pageLang={pageLang} /></span>
                    {s.featured && <div className="mt-1 text-xs text-muted">★ {t("businesses.featured")}</div>}
                  </td>
                  <td className="px-4 py-3"><Text value={localize(s.business, "name", locale)} pageLang={pageLang} /></td>
                  <td className="px-4 py-3">{s.category ? <Text value={localize({ ...s.category, name: s.category.nameDe }, "name", locale)} pageLang={pageLang} /> : "—"}</td>
                  <td className="px-4 py-3" data-testid="service-status">{t(`status.${s.status}`)}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                    {canWrite && manages(s.businessId) && <Link href={`/dr/services/${s.id}`} className={`${btn} inline-flex items-center`}>{t("bizForm.edit")}</Link>}
                    {canPublish && manages(s.businessId) && s.status !== "archived" && (s.status === "published" ? act(s.id, "unpublish") : act(s.id, "publish"))}
                    {canWrite && manages(s.businessId) && (s.status === "archived" ? act(s.id, "restore") : act(s.id, "archive"))}
                    {canPublish && manages(s.businessId) && act(s.id, s.featured ? "unfeature" : "feature")}
                    {s.status === "published" && s.business.status === "published" && <Link href={`/${locale}/services/${s.business.slug}/${s.slug}`} className={`${btn} inline-flex items-center`}>{t("bizForm.viewPublic")}</Link>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label={t("common.page")} className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="font-semibold text-brand">{t("common.previous")}</Link> : <span />}
          <span className="text-muted">{t("common.page")} {page} {t("common.of")} {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="font-semibold text-brand">{t("common.next")}</Link> : <span />}
        </nav>
      )}
    </>
  );
}
