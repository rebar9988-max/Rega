import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { formatNumber, LOCALE_META, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { normalizeSearch } from "@/lib/text";
import { Text } from "@/components/ui/Bidi";
import { isValidCoordinate } from "@/lib/coordinates";
import { locationAudit } from "@/lib/business-admin";
import { updateBusiness } from "./actions";

const PER_PAGE = 20;
const STATUSES = ["draft", "published", "archived"] as const;

type Sp = { q?: string; status?: string; page?: string; loc?: string; blocked?: string };

/** Businesses whose primary location is missing, invalid or not yet confirmed. */
const NEEDS_LOCATION: Prisma.BusinessWhereInput = {
  NOT: { locations: { some: { isPrimary: true, deletedAt: null, coordsVerifiedAt: { not: null }, latitude: { gte: -90, lte: 90 }, longitude: { gte: -180, lte: 180 }, NOT: { AND: [{ latitude: 0 }, { longitude: 0 }] } } } },
};

export default async function DrBusinesses({ searchParams }: { searchParams: Promise<Sp> }) {
  const user = await requireDr("business.read");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 120) || undefined;
  const page = Math.min(500, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const canPublish = can(user.role, "business.publish");
  const canWrite = can(user.role, "business.write");

  const needsLocation = sp.loc === "missing";
  const where: Prisma.BusinessWhereInput = { deletedAt: null, ...(status ? { status } : {}), ...(q ? { searchText: { contains: normalizeSearch(q) } } : {}), ...(needsLocation ? NEEDS_LOCATION : {}) };
  const [audit, total, rows] = await Promise.all([
    locationAudit(),
    prisma.business.count({ where }),
    prisma.business.findMany({
      where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE,
      select: {
        id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, status: true, verified: true, featured: true, viewCount: true,
        locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { latitude: true, longitude: true, coordsVerifiedAt: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => `/dr/businesses?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(needsLocation ? { loc: "missing" } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const locState = (l?: { latitude: number | null; longitude: number | null; coordsVerifiedAt: Date | null }) =>
    !l || l.latitude == null || l.longitude == null ? "locMissing" : !isValidCoordinate(l.latitude, l.longitude) ? "auditInvalid" : l.coordsVerifiedAt ? "locOk" : "locUnverified";
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  const pageLang = LOCALE_META[locale].htmlLang;

  const act = (id: string, intent: string) => (
    <form key={intent} action={updateBusiness}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="intent" value={intent} />
      <button type="submit" className={btn}>{t(`dashboard.${intent}`)}</button>
    </form>
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("dashboard.businesses")}</h1>
        {canWrite && <Link href="/dr/businesses/new" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover">+ {t("bizForm.new")}</Link>}
      </div>
      {sp.blocked && <p role="alert" data-testid="publish-blocked" className="mb-6 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t("bizForm.blockedNotice")} <Link href={`/dr/businesses/${encodeURIComponent(sp.blocked)}`} className="text-brand underline">{t("bizForm.edit")}</Link></p>}
      <section aria-labelledby="loc-audit" className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-4" data-testid="location-audit">
        <h2 id="loc-audit" className="mb-3 text-sm font-bold">{t("bizForm.auditTitle")}</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {([["auditPublished", audit.published], ["auditUnpublished", audit.unpublished], ["auditMissing", audit.missing], ["auditInvalid", audit.invalid], ["auditUnverified", audit.unverified]] as const).map(([k, n]) => (
            <div key={k} className="rounded-xl bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">{t(`bizForm.${k}`)}</dt><dd className="text-lg font-extrabold" data-testid={`audit-${k}`}>{formatNumber(n, locale)}</dd></div>
          ))}
        </dl>
      </section>
      <form role="search" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">{t("common.search")}</label>
        <input id="q" name="q" defaultValue={q} placeholder={t("search.placeholder")} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand" />
        <label htmlFor="status" className="sr-only">{t("common.status")}</label>
        <select id="status" name="status" defaultValue={status ?? ""} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">{t("common.all")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name="loc" value="missing" defaultChecked={needsLocation} className="size-5 accent-[var(--brand)]" />{t("bizForm.filterMissing")}</label>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("list.apply")}</button>
      </form>
      <p aria-live="polite" className="mb-3 text-sm text-muted">{t("search.resultCount", { count: formatNumber(total, locale) })}</p>

      {rows.length === 0 ? <p className="text-muted">{t("dashboard.empty")}</p> : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-surface-2 text-muted"><tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("businesses.singular")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("bizForm.location")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("dashboard.views")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/businesses/${b.slug}`} className="font-semibold hover:underline"><Text value={localize(b, "name", locale)} pageLang={pageLang} /></Link>
                    <div className="mt-1 flex gap-2 text-xs text-muted">{b.verified && <span>✓ {t("businesses.verified")}</span>}{b.featured && <span>★ {t("businesses.featured")}</span>}</div>
                  </td>
                  <td className="px-4 py-3">{t(`status.${b.status}`)}</td>
                  <td className="px-4 py-3" data-testid="loc-state">{(() => { const st = locState(b.locations[0]); return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st === "locOk" ? "bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]" : "bg-brand-soft text-brand"}`}>{t(`bizForm.${st}`)}</span>; })()}</td>
                  <td className="px-4 py-3">{formatNumber(b.viewCount, locale)}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                    {canWrite && <Link href={`/dr/businesses/${b.id}`} className={`${btn} inline-flex items-center`}>{t("bizForm.edit")}</Link>}
                    {canPublish && (b.status === "published" ? act(b.id, "unpublish") : act(b.id, "publish"))}
                    {canWrite && b.status !== "archived" && act(b.id, "archive")}
                    {canPublish && act(b.id, b.featured ? "unfeature" : "feature")}
                    {canPublish && act(b.id, b.verified ? "unverify" : "verify")}
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
