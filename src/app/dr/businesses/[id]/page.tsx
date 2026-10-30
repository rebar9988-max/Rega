import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { localize } from "@/lib/content";
import { businessReadiness, publicationSelect } from "@/lib/business-publication";
import type { Locale } from "@/i18n/locales";
import { BusinessForm } from "@/components/dr/BusinessForm";
import { isStorageConfigured } from "@/lib/env";
import { closedOnHolidays, hoursExceptions, hoursRows } from "@/lib/opening-hours";
import { assertBusinessAccess } from "@/lib/business-access";
import { BusinessTeam } from "@/components/dr/BusinessTeam";
import { GALLERY_PHOTOS } from "@/lib/business-admin";
import { offerState } from "@/lib/offers";
import { formOptions } from "../form-options";
import { BusinessActions } from "../BusinessActions";
import { publicVisibility } from "@/lib/business-publication";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/dr/StatusPill";
import { DrIcon } from "@/components/dr/icons";

type Sp = { saved?: string; published?: string; blocked?: string; submitted?: string; team?: string; visibility?: string };
const VISIBILITY_NOTICES = ["hidden", "shown", "restoredPending", "restoredDraft", "denied", "pinned", "unpinned", "unchanged"] as const;
const TEAM_NOTICES = ["added", "notfound", "invalid"];

export default async function EditBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  const user = await requireDr("business.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const b = await prisma.business.findFirst({
    where: { id, deletedAt: null },
    include: { category: true, locations: { where: { isPrimary: true, deletedAt: null }, take: 1, include: { city: true } }, translations: { select: { locale: true, description: true } } },
  });
  if (!b) notFound();
  await assertBusinessAccess(user, b.id);
  const loc = b.locations[0] ?? null;
  const services = await prisma.service.findMany({
    where: { businessId: b.id, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, nameCkb: true, status: true },
  });
  const offers = await prisma.offer.findMany({ where: { businessId: b.id }, orderBy: { endsAt: "desc" }, take: 50, select: { id: true, title: true, isActive: true, startsAt: true, endsAt: true } });
  const now = new Date();
  const options = await formOptions(locale);
  const readyRecord = await prisma.business.findUniqueOrThrow({ where: { id }, select: publicationSelect });
  const readiness = businessReadiness(readyRecord);
  const visibilityNotice = VISIBILITY_NOTICES.find((n) => n === sp.visibility);
  const hidden = b.status === "archived";
  const visibility = publicVisibility(b);
  const notice = sp.published ? "published" : sp.submitted ? "submitted" : sp.blocked ? "blocked" : sp.saved ? "saved" : null;

  return (
    <>
      <nav aria-label={t("common.breadcrumb")} className="mb-3 flex items-center gap-1.5 text-sm text-muted">
        <Link href="/dr/businesses" className="hover:text-ink hover:underline">{t("dashboard.businesses")}</Link>
        <DrIcon name="chevron" className="size-3.5 rtl:rotate-180" />
        <span className="min-w-0 truncate text-ink">{t("bizForm.editTitle")}</span>
      </nav>
      <header className="mb-5 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={b.name} src={b.logoUrl} size="size-12" />
          <div className="min-w-0">
            <h1 className="line-clamp-2 break-words text-xl! leading-tight! font-extrabold tracking-tight sm:text-2xl!"><bdi>{b.name}</bdi></h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <StatusPill testId="business-status" status={b.status} label={hidden ? t("businessVisibility.hidden") : t(`status.${b.status}`)} />
              <span data-testid="visibility" data-state={visibility} className={`inline-flex items-center gap-1 font-semibold ${visibility === "public" ? "text-[oklch(0.35_0.1_150)]" : "text-muted"}`}>
                <DrIcon name={visibility === "public" ? "view" : "hide"} className="size-3.5" />{t(`businessVisibility.${visibility}`)}
              </span>
              <span data-testid="staff-verification" className="inline-flex items-center gap-1 text-muted">{b.verified && <DrIcon name="check" className="size-3.5 text-[oklch(0.62_0.15_150)]" />}{b.verified ? t("businesses.verified") : t("businessModeration.unverified")}</span>
              {b.featured && <span className="inline-flex items-center gap-1 font-semibold text-brand-text"><DrIcon name="pin" className="size-3.5" />{t("drAdmin.pinned")}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          {visibility === "public" && (
            <Link href={`/${locale}/business/${b.slug}`} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2">
              <DrIcon name="site" className="size-4 text-muted" />{t("bizForm.viewPublic")}
            </Link>
          )}
          <BusinessActions
            b={{ id: b.id, name: b.name, slug: b.slug, status: b.status, verified: b.verified, featured: b.featured, deleted: false, isPublic: false }}
            rights={{ manages: true, canPublish: can(user.role, "business.publish"), canPin: can(user.role, "business.pin"), canDelete: can(user.role, "business.delete") }}
            back={`/dr/businesses/${b.id}`} locale={locale} showEdit={false} />
        </div>
      </header>

      {visibilityNotice && (
        <p role={visibilityNotice === "denied" ? "alert" : "status"} data-testid="visibility-notice" data-notice={visibilityNotice}
          className={`mb-5 rounded-xl px-4 py-3 text-sm font-semibold ${visibilityNotice === "denied" ? "bg-brand-soft text-ink" : "bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]"}`}>
          {["pinned", "unpinned", "unchanged"].includes(visibilityNotice) ? t(`drAdmin.notice_${visibilityNotice}`) : t(`businessVisibility.notice_${visibilityNotice}`)}
        </p>
      )}
      {hidden && !visibilityNotice && <p role="note" data-testid="hidden-note" className="mb-5 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink">{t("businessVisibility.hiddenNote")}</p>}

      {notice && (
        <div role="status" data-testid="form-notice" className={`mb-6 rounded-xl px-4 py-3 text-sm font-semibold ${notice === "blocked" ? "bg-brand-soft text-ink" : "bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]"}`}>
          {t(`bizForm.${notice}`)}
          {notice === "blocked" && readiness.missing.length > 0 && <> {readiness.missing.map((m) => t(`bizForm.req_${m}`)).join(" · ")}</>}
        </div>
      )}

      <section aria-labelledby="checklist" className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="publish-checklist">
        <h2 id="checklist" className="mb-3 text-sm font-bold">{readiness.ok ? t("bizForm.ready") : t("bizForm.checklist")}</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {(["name", "category", "address", "city", "country", "location", "locationVerified"] as const).map((k) => {
            const done = !readiness.missing.includes(k);
            return (
              <li key={k} className="flex items-center gap-2" data-done={done}>
                <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full text-xs font-bold ${done ? "bg-[oklch(0.9_0.08_150)] text-[oklch(0.35_0.1_150)]" : "bg-brand-soft text-brand-text"}`}>{done ? "✓" : "!"}</span>
                {t(`bizForm.req_${k}`)}
              </li>
            );
          })}
        </ul>
      </section>

      <BusinessForm
        key={b.updatedAt.toISOString()}
        initial={{
          id: b.id, name: b.name, nameCkb: b.nameCkb ?? undefined, categoryId: b.categoryId ?? undefined,
          description: b.description ?? undefined, phone: b.phone ?? undefined, whatsapp: b.whatsapp ?? undefined, email: b.email ?? undefined, website: b.website ?? undefined,
          facebookUrl: b.facebookUrl, instagramUrl: b.instagramUrl, tiktokUrl: b.tiktokUrl, snapchatUrl: b.snapchatUrl,
          addressLine1: loc?.addressLine1, postalCode: loc?.postalCode ?? undefined, countryCode: loc?.countryCode ?? "DE",
          city: loc?.city ? localize({ ...loc.city, name: loc.city.nameEn }, "name", locale).text : undefined,
          latitude: loc?.latitude, longitude: loc?.longitude, coordsSource: loc?.coordsSource, coordsVerified: Boolean(loc?.coordsVerifiedAt),
          hours: Object.fromEntries(hoursRows(loc?.openingHours).map((r) => [r.day, r.value])),
          holidaysClosed: closedOnHolidays(loc?.openingHours), hoursExceptions: hoursExceptions(loc?.openingHours),
          logoUrl: b.logoUrl, coverUrl: b.coverUrl, photos: b.photos, status: b.status, languages: b.languages,
          translations: {
            ckb: b.descriptionCkb ?? undefined, kmr: b.descriptionKmr ?? undefined, de: b.descriptionDe ?? undefined, ar: b.descriptionAr ?? undefined, tr: b.descriptionTr ?? undefined,
            ...Object.fromEntries(b.translations.flatMap((x) => (x.description ? [[x.locale, x.description]] : []))),
          },
        }}
        {...options}
        canPublish={can(user.role, "business.publish")}
        storageReady={isStorageConfigured()}
        maxPhotos={GALLERY_PHOTOS}
      />

      <section aria-labelledby="biz-services" className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="business-services">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="biz-services" className="text-base font-bold">{t("dashboard.services")}</h2>
          {can(user.role, "service.write") && <Link href={`/dr/services/new?business=${b.id}`} className="inline-flex min-h-10 items-center rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand-text hover:bg-brand hover:text-brand-ink">+ {t("svcForm.new")}</Link>}
        </div>
        {services.length === 0 ? <p className="text-sm text-muted">{t("svcForm.noneYet")}</p> : (
          <ul className="divide-y divide-line">
            {services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <bdi className="font-semibold">{s.nameCkb && locale === "ckb" ? s.nameCkb : s.name}</bdi>
                <span className="flex items-center gap-3"><span className="text-muted">{t(`status.${s.status}`)}</span>
                  {can(user.role, "service.write") && <Link href={`/dr/services/${s.id}`} className="font-semibold text-brand-text hover:underline">{t("bizForm.edit")}</Link>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="biz-offers" className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="business-offers">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="biz-offers" className="text-base font-bold">{t("offerForm.sectionOffers")}</h2>
          <Link href={`/dr/offers/new?business=${b.id}`} className="inline-flex min-h-10 items-center rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand-text hover:bg-brand hover:text-brand-ink" data-testid="new-offer">+ {t("offerForm.new")}</Link>
        </div>
        {offers.length === 0 ? <p className="text-sm text-muted">{t("offerForm.noneYet")}</p> : (
          <ul className="divide-y divide-line">
            {offers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <bdi className="font-semibold">{o.title}</bdi>
                <span className="flex items-center gap-3"><span className="text-muted">{t(`offerForm.state_${offerState(o, now)}`)}</span>
                  <Link href={`/dr/offers/${o.id}`} className="font-semibold text-brand-text hover:underline">{t("bizForm.edit")}</Link></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {TEAM_NOTICES.includes(sp.team ?? "") && (
        <p role="status" data-testid="team-notice" className="mt-8 rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold">{t(`team.notice_${sp.team}`)}</p>
      )}
      {can(user.role, "user.write") && <BusinessTeam businessId={b.id} />}
    </>
  );
}
