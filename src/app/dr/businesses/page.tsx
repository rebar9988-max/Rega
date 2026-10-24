import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { formatDate, formatNumber, LOCALE_META, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { Text } from "@/components/ui/Bidi";
import { Avatar } from "@/components/ui/Avatar";
import { isValidCoordinate } from "@/lib/coordinates";
import { locationAudit } from "@/lib/business-admin";
import { hasGlobalBusinessAccess, managedBusinessWhere } from "@/lib/business-access";
import { textWhere } from "@/lib/search-where";
import { BUSINESS_CATEGORY, publicVisibility } from "@/lib/business-publication";
import { BusinessActionButton } from "@/components/dr/BusinessActionButton";
import { DrIcon } from "@/components/dr/icons";
import { StatusPill } from "@/components/dr/StatusPill";
import { updateBusiness, recoverBusiness } from "./actions";
import { BusinessActions } from "./BusinessActions";

const PER_PAGE = 20;
const STATUSES = ["pending", "published", "draft", "archived"] as const;
const NOTICES = ["hidden", "shown", "restoredPending", "restoredDraft", "denied", "deleted", "recovered", "pinned", "unpinned", "unchanged"] as const;

type Sp = { q?: string; status?: string; page?: string; loc?: string; blocked?: string; visibility?: string; item?: string; cat?: string; city?: string; pin?: string };

/** Businesses whose primary location is missing, invalid or not yet confirmed. */
const NEEDS_LOCATION: Prisma.BusinessWhereInput = {
  NOT: { locations: { some: { isPrimary: true, deletedAt: null, coordsVerifiedAt: { not: null }, latitude: { gte: -90, lte: 90 }, longitude: { gte: -180, lte: 180 }, NOT: { AND: [{ latitude: 0 }, { longitude: 0 }] } } } },
};
const NAME_COLUMNS = { nameDe: true, nameCkb: true, nameKmr: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } as const;

export default async function DrBusinesses({ searchParams }: { searchParams: Promise<Sp> }) {
  const user = await requireDr("business.read");
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const canPublish = can(user.role, "business.publish");
  const canWrite = can(user.role, "business.write");
  const canPin = can(user.role, "business.pin");
  const canDelete = can(user.role, "business.delete");
  // Business owners see (and can open) only the businesses they are a member of, never other owners' drafts.
  const ownerOnly = user.role === "BUSINESS_OWNER";
  const scope: Prisma.BusinessWhereInput = ownerOnly ? managedBusinessWhere(user) : {};

  const showDeleted = canDelete && sp.status === "deleted";
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 120) || undefined;
  const cat = sp.cat?.slice(0, 64) || undefined;
  const city = sp.city?.slice(0, 64) || undefined;
  const pinned = sp.pin === "1";
  const needsLocation = sp.loc === "missing";
  const page = Math.min(500, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));

  const filters: Prisma.BusinessWhereInput = {
    ...scope, ...textWhere(q),
    ...(cat ? { categoryId: cat } : {}),
    ...(city ? { locations: { some: { isPrimary: true, deletedAt: null, cityId: city } } } : {}),
    ...(pinned ? { featured: true } : {}),
    ...(needsLocation ? NEEDS_LOCATION : {}),
  };
  const where: Prisma.BusinessWhereInput = showDeleted ? { ...filters, deletedAt: { not: null } } : { ...filters, deletedAt: null, ...(status ? { status } : {}) };

  const [audit, counts, pinnedCount, deletedCount, categories, cities, total, rows] = await Promise.all([
    ownerOnly ? Promise.resolve(null) : locationAudit(),
    prisma.business.groupBy({ by: ["status"], where: { deletedAt: null, ...scope }, _count: { _all: true } }),
    prisma.business.count({ where: { deletedAt: null, featured: true, ...scope } }),
    canDelete ? prisma.business.count({ where: { deletedAt: { not: null }, ...scope } }) : Promise.resolve(0),
    prisma.category.findMany({ where: BUSINESS_CATEGORY, select: { id: true, ...NAME_COLUMNS } }),
    prisma.city.findMany({ where: { locations: { some: { isPrimary: true, deletedAt: null, business: { deletedAt: null, ...scope } } } }, select: { id: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true }, take: 300 }),
    prisma.business.count({ where }),
    prisma.business.findMany({
      where, orderBy: [{ featured: "desc" }, { updatedAt: "desc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE,
      select: {
        id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, status: true, verified: true, featured: true,
        viewCount: true, logoUrl: true, updatedAt: true, archivedAt: true, deletedAt: true,
        category: { select: { sectionKey: true, isActive: true, deletedAt: true, ...NAME_COLUMNS } },
        locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { latitude: true, longitude: true, coordsVerifiedAt: true, city: { select: { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true } } } },
      },
    }),
  ]);
  // EMPLOYEE accounts edit only the businesses they are members of; everyone with access sees the full list.
  const mine = hasGlobalBusinessAccess(user.role) ? null : new Set((await prisma.businessMember.findMany({ where: { userId: user.id, isActive: true, businessId: { in: rows.map((r) => r.id) } }, select: { businessId: true } })).map((m) => m.businessId));
  const manages = (id: string) => canWrite && (mine === null || mine.has(id));

  const pageLang = LOCALE_META[locale].htmlLang;
  const label = (row: Record<string, unknown> & { nameDe?: string | null; nameEn?: string | null }) => localize({ ...row, name: row.nameDe ?? row.nameEn }, "name", locale).text;
  const cityLabel = (c: { nameEn: string } & Record<string, unknown>) => localize({ ...c, name: c.nameEn }, "name", locale).text;
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Links keep the other filters; changing a filter goes back to page 1.
  const keep = { ...(q ? { q } : {}), ...(cat ? { cat } : {}), ...(city ? { city } : {}), ...(needsLocation ? { loc: "missing" } : {}) };
  const current = { ...keep, ...(showDeleted ? { status: "deleted" } : status ? { status } : {}), ...(pinned ? { pin: "1" } : {}) };
  const link = (params: Record<string, string>) => { const s = new URLSearchParams(params).toString(); return `/dr/businesses${s ? `?${s}` : ""}`; };
  const href = (p: number) => link({ ...current, ...(p > 1 ? { page: String(p) } : {}) });
  const back = href(page);
  const filtered = Boolean(q || cat || city || needsLocation);

  const notice = NOTICES.find((n) => n === sp.visibility);
  const noticeItem = notice && sp.item ? await prisma.business.findFirst({ where: { id: sp.item.slice(0, 64), ...scope }, select: { id: true, name: true, deletedAt: true } }) : null;

  const tiles: { key: string; label: string; n: number; href: string; on: boolean; tone?: string }[] = [
    { key: "all", label: t("common.all"), n: all, href: link(keep), on: !status && !pinned && !showDeleted },
    { key: "pending", label: t("status.pending"), n: count("pending"), href: link({ ...keep, status: "pending" }), on: status === "pending", tone: "bg-sun" },
    { key: "published", label: t("status.published"), n: count("published"), href: link({ ...keep, status: "published" }), on: status === "published", tone: "bg-[oklch(0.62_0.15_150)]" },
    { key: "draft", label: t("status.draft"), n: count("draft"), href: link({ ...keep, status: "draft" }), on: status === "draft", tone: "bg-muted/50" },
    { key: "archived", label: t("businessVisibility.hidden"), n: count("archived"), href: link({ ...keep, status: "archived" }), on: status === "archived", tone: "bg-brand/60" },
    ...(ownerOnly ? [] : [{ key: "pinned", label: t("drAdmin.pinned"), n: pinnedCount, href: link({ ...keep, pin: "1" }), on: pinned && !status }]),
    ...(canDelete && deletedCount > 0 ? [{ key: "deleted", label: t("drAdmin.deleted"), n: deletedCount, href: link({ ...keep, status: "deleted" }), on: showDeleted }] : []),
  ];
  const attention = audit ? audit.missing + audit.invalid + audit.unverified : 0;
  const select = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface ps-3 pe-8 text-sm text-ink outline-none transition focus:border-brand sm:w-auto sm:max-w-52";

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t("dashboard.businesses")}</h1>
          <p className="mt-1 text-sm text-muted">{t("drAdmin.listSubtitle")}</p>
        </div>
        {canWrite && (
          <Link href="/dr/businesses/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink shadow-card transition hover:bg-brand-hover">
            <DrIcon name="plus" className="size-[18px]" />{t("bizForm.new")}
          </Link>
        )}
      </header>

      {notice && (
        <div role={notice === "denied" ? "alert" : "status"} data-testid="visibility-notice" data-notice={notice}
          className={`mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm font-semibold ${notice === "denied" ? "border-brand/30 bg-brand-soft text-ink" : "border-[oklch(0.62_0.15_150)]/30 bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]"}`}>
          <DrIcon name={notice === "denied" ? "alert" : "check"} className="size-[18px]" />
          <span className="min-w-0 flex-1">{noticeItem && <><bdi>{noticeItem.name}</bdi>: </>}{notice === "deleted" || notice === "recovered" || notice === "pinned" || notice === "unpinned" || notice === "unchanged" ? t(`drAdmin.notice_${notice}`) : t(`businessVisibility.notice_${notice}`)}</span>
          {notice === "deleted" && canDelete && noticeItem?.deletedAt && (
            <form action={recoverBusiness}>
              <input type="hidden" name="id" value={noticeItem.id} /><input type="hidden" name="back" value={back} />
              <BusinessActionButton testId="undo-delete" className="min-h-9 rounded-lg border border-current px-3 text-sm font-bold">{t("drAdmin.undo")}</BusinessActionButton>
            </form>
          )}
        </div>
      )}
      {sp.blocked && <p role="alert" data-testid="publish-blocked" className="mb-5 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-ink">{t("bizForm.blockedNotice")} <Link href={`/dr/businesses/${encodeURIComponent(sp.blocked)}`} className="text-brand underline">{t("bizForm.edit")}</Link></p>}

      <nav aria-label={t("common.status")} className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-testid="status-tiles">
        <ul className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]">
          {tiles.map((tile) => (
            <li key={tile.key}>
              <Link href={tile.href} aria-current={tile.on ? "page" : undefined} data-testid={`tile-${tile.key}`}
                className={`flex min-h-16 min-w-32 flex-col justify-center gap-0.5 rounded-xl border bg-surface px-4 py-2.5 transition sm:min-w-0 ${tile.on ? "border-brand ring-1 ring-brand" : "border-line hover:border-ink/20"}`}>
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  {tile.key === "pinned" ? <DrIcon name="pin" className="size-3.5 text-brand" /> : tile.key === "deleted" ? <DrIcon name="trash" className="size-3.5" /> : tile.tone && <span aria-hidden="true" className={`size-2 rounded-full ${tile.tone}`} />}
                  {tile.label}
                </span>
                <span className="text-xl font-extrabold tabular-nums text-ink">{formatNumber(tile.n, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {audit && (
        <section aria-labelledby="loc-audit" data-testid="location-audit" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          <h2 id="loc-audit" className="flex items-center gap-2 font-semibold text-ink"><DrIcon name="mapPin" className="size-4 text-muted" />{t("bizForm.auditTitle")}</h2>
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {([["auditMissing", audit.missing], ["auditInvalid", audit.invalid], ["auditUnverified", audit.unverified]] as const).map(([k, n]) => (
              <div key={k} className="flex items-center gap-1.5">
                <dt className="text-muted">{t(`bizForm.${k}`)}</dt>
                <dd data-testid={`audit-${k}`} className={`font-bold tabular-nums ${n > 0 ? "text-brand" : "text-ink"}`}>{formatNumber(n, locale)}</dd>
              </div>
            ))}
          </dl>
          {attention > 0 && !needsLocation && <Link href={link({ ...current, loc: "missing" })} className="ms-auto text-sm font-semibold text-brand hover:underline">{t("bizForm.filterMissing")}</Link>}
        </section>
      )}

      <form role="search" className="mb-4 flex flex-col gap-2 rounded-xl border border-line bg-surface p-2 sm:flex-row sm:flex-wrap sm:items-center">
        {showDeleted ? <input type="hidden" name="status" value="deleted" /> : status && <input type="hidden" name="status" value={status} />}
        {pinned && <input type="hidden" name="pin" value="1" />}
        <label htmlFor="q" className="sr-only">{t("common.search")}</label>
        <div className="relative min-w-0 flex-1 sm:min-w-56">
          <DrIcon name="search" className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
          <input id="q" name="q" type="search" defaultValue={q} placeholder={t("drAdmin.searchPlaceholder")} className="min-h-11 w-full rounded-xl border border-line bg-surface-2 ps-10 pe-3 text-sm outline-none transition focus:border-brand focus:bg-surface" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label className="sr-only" htmlFor="cat">{t("bizForm.category")}</label>
          <select id="cat" name="cat" defaultValue={cat ?? ""} className={select}>
            <option value="">{t("drAdmin.allCategories")}</option>
            {categories.map((c) => ({ id: c.id, name: label(c) })).sort((a, b) => a.name.localeCompare(b.name, pageLang)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="city">{t("drAdmin.colCity")}</label>
          <select id="city" name="city" defaultValue={city ?? ""} className={select}>
            <option value="">{t("drAdmin.allCities")}</option>
            {cities.map((c) => ({ id: c.id, name: cityLabel(c) })).sort((a, b) => a.name.localeCompare(b.name, pageLang)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-ink"><input type="checkbox" name="loc" value="missing" defaultChecked={needsLocation} className="size-5 accent-[var(--brand)]" />{t("bizForm.filterMissing")}</label>
        <div className="flex gap-2 sm:ms-auto">
          {filtered && <Link href={link({ ...(showDeleted ? { status: "deleted" } : status ? { status } : {}), ...(pinned ? { pin: "1" } : {}) })} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink sm:flex-none">{t("drAdmin.clear")}</Link>}
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-ink px-5 text-sm font-semibold text-surface transition hover:bg-ink/85 sm:flex-none">{t("list.apply")}</button>
        </div>
      </form>

      <p aria-live="polite" className="mb-2 px-1 text-sm text-muted">{t("search.resultCount", { count: formatNumber(total, locale) })}</p>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center" data-testid="empty-list">
          <span aria-hidden="true" className="mb-3 grid size-12 place-items-center rounded-full bg-surface-2 text-muted"><DrIcon name="businesses" className="size-6" /></span>
          <p className="font-semibold text-ink">{filtered || status || pinned || showDeleted ? t("drAdmin.filtersEmpty") : t("dashboard.empty")}</p>
          {(filtered || status || pinned || showDeleted) && <Link href="/dr/businesses" className="mt-3 text-sm font-semibold text-brand hover:underline">{t("drAdmin.clear")}</Link>}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <table role="table" className="block w-full text-sm md:table">
            <thead className="sr-only md:not-sr-only md:table-header-group">
              <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3 text-start">{t("businesses.singular")}</th>
                <th scope="col" className="hidden px-3 py-3 text-start md:table-cell">{t("bizForm.category")}</th>
                <th scope="col" className="hidden px-3 py-3 text-start lg:table-cell">{t("drAdmin.colCity")}</th>
                <th scope="col" className="px-3 py-3 text-start">{t("common.status")}</th>
                <th scope="col" className="hidden px-3 py-3 text-start lg:table-cell">{t("bizForm.location")}</th>
                <th scope="col" className="hidden px-3 py-3 text-start xl:table-cell">{t("drAdmin.colUpdated")}</th>
                <th scope="col" className="hidden px-3 py-3 text-start 2xl:table-cell">{t("dashboard.views")}</th>
                <th scope="col" className="px-4 py-3 text-end"><span className="sr-only">{t("common.actions")}</span></th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="block divide-y divide-line md:table-row-group">
              {rows.map((b) => {
                const loc = b.locations[0];
                const st = !loc || loc.latitude == null || loc.longitude == null ? "locMissing" : !isValidCoordinate(loc.latitude, loc.longitude) ? "auditInvalid" : loc.coordsVerifiedAt ? "locOk" : "locUnverified";
                const vis = publicVisibility(b);
                const categoryName = b.category ? label(b.category) : null;
                const cityName = loc?.city ? cityLabel(loc.city) : null;
                const name = localize(b, "name", locale);
                const editable = manages(b.id) && !b.deletedAt;
                return (
                  <tr key={b.id} role="row" data-pinned={b.featured || undefined}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors md:table-row md:p-0 md:hover:bg-surface-2/60 ${b.featured && !b.deletedAt ? "bg-brand-soft/35" : ""}`}>
                    <td role="cell" className="col-start-1 row-start-1 min-w-0 md:px-4 md:py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={b.name} src={b.logoUrl} size="size-10" />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {b.featured && !b.deletedAt && <span title={t("drAdmin.pinned")} className="text-brand" data-testid="pinned-mark"><DrIcon name="pin" className="size-3.5" /><span className="sr-only">{t("drAdmin.pinned")}</span></span>}
                            {editable
                              ? <Link href={`/dr/businesses/${b.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-brand hover:underline"><Text value={name} pageLang={pageLang} /></Link>
                              : <span className="min-w-0 truncate font-semibold text-ink"><Text value={name} pageLang={pageLang} /></span>}
                          </div>
                          <p className="truncate text-xs text-muted md:hidden">{[categoryName, cityName].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                      </div>
                      {canPublish && b.status === "pending" && !b.deletedAt && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 md:ps-[3.25rem]" data-testid="moderation">
                          <form action={updateBusiness}>
                            <input type="hidden" name="id" value={b.id} /><input type="hidden" name="intent" value="publish" />
                            <BusinessActionButton className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-bold text-surface hover:bg-ink/85"><DrIcon name="check" className="size-3.5" />{t("businessModeration.approve")}</BusinessActionButton>
                          </form>
                          <form action={updateBusiness} className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
                            <input type="hidden" name="id" value={b.id} /><input type="hidden" name="intent" value="reject" />
                            <label className="sr-only" htmlFor={`reason-${b.id}`}>{t("dashboard.rejectReason")}</label>
                            <input id={`reason-${b.id}`} name="reason" maxLength={500} placeholder={t("dashboard.rejectReason")} className="min-h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-xs sm:w-44 sm:flex-none" />
                            <BusinessActionButton className="min-h-9 shrink-0 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2">{t("dashboard.reject")}</BusinessActionButton>
                          </form>
                        </div>
                      )}
                    </td>
                    <td role="cell" className="hidden min-w-0 px-3 py-3 text-ink/80 md:table-cell" data-testid="primary-category"><span className="line-clamp-2">{categoryName ?? "—"}</span></td>
                    <td role="cell" className="hidden min-w-0 px-3 py-3 text-ink/80 lg:table-cell"><span className="line-clamp-2">{cityName ?? "—"}</span></td>
                    <td role="cell" className="col-start-1 row-start-2 min-w-0 ps-[3.25rem] md:px-3 md:py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="sr-only md:hidden">{t("common.status")}: </span>
                        {b.deletedAt ? <StatusPill status="deleted" label={t("drAdmin.deleted")} /> : <StatusPill status={b.status} label={b.status === "archived" ? t("businessVisibility.hidden") : t(`status.${b.status}`)} />}
                        {b.verified && !b.deletedAt && <span title={t("businessModeration.verification")} className="text-[oklch(0.62_0.15_150)]" data-testid="staff-verification"><DrIcon name="check" className="size-4" /><span className="sr-only">{t("businessModeration.verification")}</span></span>}
                        {!b.deletedAt && b.status === "published" && vis === "notPublic" && <span data-testid="visibility" data-state={vis} className="text-xs font-semibold text-brand">{t("businessVisibility.notPublic")}</span>}
                      </div>
                    </td>
                    <td role="cell" className="hidden px-3 py-3 lg:table-cell" data-testid="loc-state">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${st === "locOk" ? "text-[oklch(0.35_0.1_150)]" : "text-brand"}`}><DrIcon name={st === "locOk" ? "check" : "alert"} className="size-3.5" />{t(`bizForm.${st}`)}</span>
                    </td>
                    <td role="cell" className="hidden whitespace-nowrap px-3 py-3 text-muted xl:table-cell"><time dateTime={b.updatedAt.toISOString()}>{formatDate(b.updatedAt, locale, { dateStyle: "medium" })}</time></td>
                    <td role="cell" className="hidden px-3 py-3 tabular-nums text-muted 2xl:table-cell">{formatNumber(b.viewCount, locale)}</td>
                    <td role="cell" className="col-start-2 row-span-2 row-start-1 self-center md:px-4 md:py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {editable && (
                          <Link href={`/dr/businesses/${b.id}`} className="hidden min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-surface-2 sm:inline-flex">
                            <DrIcon name="edit" className="size-4 text-muted" />{t("bizForm.edit")}
                          </Link>
                        )}
                        <BusinessActions
                          b={{ id: b.id, name: b.name, slug: b.slug, status: b.status, verified: b.verified, featured: b.featured, deleted: Boolean(b.deletedAt), isPublic: vis === "public" && !b.deletedAt }}
                          rights={{ manages: manages(b.id), canPublish, canPin, canDelete }} back={back} locale={locale} showEdit />
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
        <nav aria-label={t("common.page")} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted">{t("common.page")} {formatNumber(page, locale)} {t("common.of")} {formatNumber(pages, locale)}</span>
          <div className="flex items-center gap-1">
            {page > 1 ? <Link href={href(page - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line bg-surface px-3 font-semibold hover:bg-surface-2"><DrIcon name="chevron" className="size-4 rotate-180 rtl:rotate-0" />{t("common.previous")}</Link> : null}
            {[...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, c) => a - c).map((p) => (
              <Link key={p} href={href(p)} aria-current={p === page ? "page" : undefined}
                className={`grid min-h-10 min-w-10 place-items-center rounded-lg px-2 font-semibold tabular-nums ${p === page ? "bg-brand text-brand-ink" : "border border-line bg-surface hover:bg-surface-2"}`}>{formatNumber(p, locale)}</Link>
            ))}
            {page < pages ? <Link href={href(page + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line bg-surface px-3 font-semibold hover:bg-surface-2">{t("common.next")}<DrIcon name="chevron" className="size-4 rtl:rotate-180" /></Link> : null}
          </div>
        </nav>
      )}
    </>
  );
}
