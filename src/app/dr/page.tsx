import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, formatNumber, LOCALE_META, type Locale } from "@/i18n/locales";
import { can } from "@/lib/rbac";
import { Ltr, Text } from "@/components/ui/Bidi";
import { Avatar } from "@/components/ui/Avatar";
import { localize } from "@/lib/content";
import { locationAudit } from "@/lib/business-admin";
import { DrIcon, type DrIconName } from "@/components/dr/icons";
import { StatusPill } from "@/components/dr/StatusPill";
import { redirect } from "next/navigation";

const LIST_SELECT = { id: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, logoUrl: true, status: true, featured: true, updatedAt: true } as const;

/** Overview: what needs attention first (real counts only, each one a link to the filtered list), then the work queues. */
export default async function Overview() {
  const user = await requireDr("business.read");
  // Owners see their own listings, not platform-wide totals.
  if (user.role === "BUSINESS_OWNER") redirect("/dr/businesses");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const live = { deletedAt: null };
  const [byStatus, pinnedCount, services, locations, staff, audit, pending, pinned, recent, activity] = await Promise.all([
    prisma.business.groupBy({ by: ["status"], where: live, _count: { _all: true } }),
    prisma.business.count({ where: { ...live, featured: true } }),
    prisma.service.count({ where: live }),
    prisma.location.count({ where: live }),
    prisma.user.count({ where: { deletedAt: null, status: "active", role: { not: "USER" } } }),
    locationAudit(),
    prisma.business.findMany({ where: { ...live, status: "pending" }, orderBy: { updatedAt: "asc" }, take: 5, select: LIST_SELECT }),
    prisma.business.findMany({ where: { ...live, featured: true }, orderBy: { updatedAt: "desc" }, take: 5, select: LIST_SELECT }),
    prisma.business.findMany({ where: live, orderBy: { updatedAt: "desc" }, take: 6, select: LIST_SELECT }),
    can(user.role, "audit.read") ? prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, actorEmail: true, action: true, createdAt: true } }) : Promise.resolve([]),
  ]);
  const count = (s: string) => byStatus.find((c) => c.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((n, c) => n + c._count._all, 0);
  const pageLang = LOCALE_META[locale].htmlLang;
  const noLocation = audit.missing + audit.invalid + audit.unverified;

  const stats: { key: string; label: string; n: number; href: string; icon: DrIconName; attention?: boolean }[] = [
    { key: "pending", label: t("status.pending"), n: count("pending"), href: "/dr/businesses?status=pending", icon: "clock", attention: count("pending") > 0 },
    { key: "published", label: t("dashboard.publishedBusinesses"), n: count("published"), href: "/dr/businesses?status=published", icon: "publish" },
    { key: "total", label: t("dashboard.totalBusinesses"), n: total, href: "/dr/businesses", icon: "businesses" },
    { key: "pinned", label: t("drAdmin.pinned"), n: pinnedCount, href: "/dr/businesses?pin=1", icon: "pin" },
  ];
  const signals: { label: string; n: number; href: string; icon: DrIconName }[] = [
    { label: t("drAdmin.attPending"), n: count("pending"), href: "/dr/businesses?status=pending", icon: "clock" },
    { label: t("drAdmin.attLocation"), n: noLocation, href: "/dr/businesses?loc=missing", icon: "mapPin" },
    { label: t("drAdmin.attHidden"), n: count("archived"), href: "/dr/businesses?status=archived", icon: "hide" },
  ];
  const attention = signals.filter((a) => a.n > 0);

  const row = (b: (typeof recent)[number], meta: React.ReactNode) => (
    <li key={b.id}>
      <Link href={`/dr/businesses/${b.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/70">
        <Avatar name={b.name} src={b.logoUrl} size="size-9" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {b.featured && <DrIcon name="pin" className="size-3.5 text-brand" />}
            <span className="truncate text-sm font-semibold text-ink"><Text value={localize(b, "name", locale)} pageLang={pageLang} /></span>
          </span>
          <span className="block text-xs text-muted">{meta}</span>
        </span>
        <StatusPill status={b.status} label={b.status === "archived" ? t("businessVisibility.hidden") : t(`status.${b.status}`)} testId="overview-status" />
      </Link>
    </li>
  );
  const panel = (id: string, title: string, icon: DrIconName, more: string, body: React.ReactNode) => (
    <section aria-labelledby={id} className="flex flex-col rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={id} className="flex items-center gap-2 text-sm font-bold text-ink"><DrIcon name={icon} className="size-4 text-muted" />{title}</h2>
        <Link href={more} className="text-xs font-semibold text-brand hover:underline">{t("drAdmin.viewAll")}</Link>
      </div>
      {body}
    </section>
  );
  const empty = (text: string) => <p className="px-4 py-8 text-center text-sm text-muted">{text}</p>;
  const when = (d: Date) => <time dateTime={d.toISOString()}>{formatDate(d, locale, { dateStyle: "medium" })}</time>;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t("dashboard.overview")}</h1>
          <p className="mt-1 text-sm text-muted">{t("drAdmin.overviewSubtitle")}</p>
        </div>
        {can(user.role, "business.write") && (
          <Link href="/dr/businesses/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink shadow-card transition hover:bg-brand-hover">
            <DrIcon name="plus" className="size-[18px]" />{t("bizForm.new")}
          </Link>
        )}
      </header>

      <section aria-label={t("drAdmin.needsAttention")} data-testid="attention" className="mb-5">
        {attention.length ? (
          <ul className="flex flex-wrap gap-2">
            {attention.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand/25 bg-brand-soft px-3.5 text-sm font-semibold text-ink transition hover:border-brand/50">
                  <DrIcon name={a.icon} className="size-4 text-brand" /><span className="tabular-nums text-brand">{formatNumber(a.n, locale)}</span>{a.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.95_0.05_150)] px-3.5 py-2 text-sm font-semibold text-[oklch(0.35_0.1_150)]"><DrIcon name="check" className="size-4" />{t("drAdmin.allClear")}</p>
        )}
      </section>

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="relative rounded-xl border border-line bg-surface p-4 shadow-card transition hover:border-ink/20">
            <dt className="flex items-center gap-2 text-xs font-medium text-muted">
              <span aria-hidden="true" className={`grid size-7 place-items-center rounded-lg ${s.attention ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink/70"}`}><DrIcon name={s.icon} className="size-4" /></span>
              <Link href={s.href} className="after:absolute after:inset-0 after:rounded-xl">{s.label}</Link>
            </dt>
            <dd className="mt-2 text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">{formatNumber(s.n, locale)}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        {panel("pending", t("drAdmin.pendingTitle"), "clock", "/dr/businesses?status=pending",
          pending.length ? <ul className="divide-y divide-line">{pending.map((b) => row(b, when(b.updatedAt)))}</ul> : empty(t("drAdmin.noPending")))}
        {panel("pinned", t("drAdmin.pinnedTitle"), "pin", "/dr/businesses?pin=1",
          pinned.length ? <ul className="divide-y divide-line">{pinned.map((b) => row(b, when(b.updatedAt)))}</ul> : empty(t("drAdmin.noPinned")))}
        {panel("recent", t("drAdmin.recentTitle"), "businesses", "/dr/businesses",
          recent.length ? <ul className="divide-y divide-line">{recent.map((b) => row(b, when(b.updatedAt)))}</ul> : empty(t("dashboard.empty")))}
        {activity.length > 0 && panel("activity", t("dashboard.recentActivity"), "auditLogs", "/dr/audit",
          <ul className="divide-y divide-line">
            {activity.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                <span className="min-w-0"><Ltr className="font-semibold text-ink">{r.action}</Ltr> <span className="text-muted">· <bdi>{r.actorEmail ?? "—"}</bdi></span></span>
                <time dateTime={r.createdAt.toISOString()} className="text-xs text-muted">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</time>
              </li>
            ))}
          </ul>)}
      </div>

      <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm" data-testid="secondary-stats">
        {([["totalServices", services], ["totalLocations", locations], ["staffUsers", staff], ["drafts", count("draft")]] as const).map(([k, n]) => (
          <div key={k} className="flex items-center gap-2"><dt className="text-muted">{t(`dashboard.${k}`)}</dt><dd className="font-bold tabular-nums text-ink">{formatNumber(n, locale)}</dd></div>
        ))}
      </dl>
    </>
  );
}
