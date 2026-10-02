import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { formatNumber, type Locale } from "@/i18n/locales";
import { hasGlobalBusinessAccess, managedBusinessWhere } from "@/lib/business-access";
import { CONTENT } from "@/features/content/config";
import { textOf } from "@/features/content/queries";
import { moderateEntry } from "@/features/content/actions";
import { PER_PAGE } from "@/lib/data/params";
import { contentSection } from "../guard";

const STATUSES = ["pending", "draft", "published", "archived"] as const;
type Sp = { status?: string; page?: string };

export default async function DrContentList({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Sp> }) {
  const section = contentSection((await params).section);
  const config = CONTENT[section];
  const user = await requireDr(config.write);
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const page = Math.min(500, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const canModerate = can(user.role, config.publish);

  // Owners see their own entries and those of businesses they manage; staff with global access see everything.
  const scope: Prisma.ListingWhereInput = hasGlobalBusinessAccess(user.role) ? {} : { OR: [{ createdById: user.id }, { business: managedBusinessWhere(user) }] };
  const where: Prisma.ListingWhereInput = { sectionKey: section, deletedAt: null, ...(status ? { status } : {}), ...scope };
  const [total, rows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE,
      select: { id: true, slug: true, status: true, verified: true, updatedAt: true, translations: { select: { locale: true, title: true, summary: true, body: true } }, business: { select: { name: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => `/dr/content/${section}?${new URLSearchParams({ ...(status ? { status } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  const act = (id: string, intent: string, label: string) => (
    <form key={intent} action={moderateEntry}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="section" value={section} /><input type="hidden" name="intent" value={intent} />
      <button type="submit" className={btn}>{label}</button>
    </form>
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t(`nav.${section}`)}</h1>
        <Link href={`/dr/content/${section}/new`} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover">+ {t("content.newEntry")}</Link>
      </div>
      <form role="search" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="status" className="sr-only">{t("common.status")}</label>
        <select id="status" name="status" defaultValue={status ?? ""} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">{t("common.all")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("list.apply")}</button>
      </form>
      <p aria-live="polite" className="mb-3 text-sm text-muted">{t("search.resultCount", { count: formatNumber(total, locale) })}</p>

      {rows.length === 0 ? <p className="text-muted" data-testid="content-empty">{t("content.listEmpty")}</p> : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-surface-2 text-muted"><tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("content.colTitle")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("content.colBusiness")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("content.colUpdated")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const tx = textOf(r, locale);
                return (
                  <tr key={r.id} data-testid="content-row">
                    <td className="px-4 py-3 font-semibold"><bdi>{tx?.title ?? r.slug}</bdi></td>
                    <td className="px-4 py-3 text-muted">{r.business ? <bdi>{r.business.name}</bdi> : "—"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold">{t(`status.${r.status}`)}</span></td>
                    <td className="px-4 py-3 text-muted"><time dateTime={r.updatedAt.toISOString()}>{r.updatedAt.toLocaleDateString(locale)}</time></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/dr/content/${section}/${r.id}`} className={`${btn} inline-flex items-center`}>{t("common.edit")}</Link>
                        {r.status === "published" && <Link href={`/${locale}/${section}/${r.slug}`} className={`${btn} inline-flex items-center`}>{t("content.view")}</Link>}
                        {canModerate && r.status !== "published" && r.status !== "archived" && act(r.id, "publish", t("content.approve"))}
                        {canModerate && r.status === "pending" && act(r.id, "reject", t("dashboard.reject"))}
                        {canModerate && r.status !== "archived" && act(r.id, "archive", t("content.archive"))}
                        {canModerate && r.status === "archived" && act(r.id, "restore", t("content.restore"))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label={t("list.pagination")} className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className={`${btn} inline-flex items-center`}>{t("common.previous")}</Link> : <span />}
          <span className="text-muted">{t("common.page")} {formatNumber(page, locale)} {t("common.of")} {formatNumber(pages, locale)}</span>
          {page < pages ? <Link href={href(page + 1)} className={`${btn} inline-flex items-center`}>{t("common.next")}</Link> : <span />}
        </nav>
      )}
    </>
  );
}
