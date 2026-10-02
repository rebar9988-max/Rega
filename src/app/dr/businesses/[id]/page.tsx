import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { localize } from "@/lib/content";
import { publishReadiness } from "@/lib/coordinates";
import type { Locale } from "@/i18n/locales";
import { BusinessForm } from "@/components/dr/BusinessForm";
import { isStorageConfigured } from "@/lib/env";
import { hoursRows } from "@/lib/opening-hours";
import { assertBusinessAccess } from "@/lib/business-access";
import { BusinessTeam } from "@/components/dr/BusinessTeam";
import { formOptions } from "../form-options";

type Sp = { saved?: string; published?: string; blocked?: string; submitted?: string; team?: string };
const TEAM_NOTICES = ["added", "notfound", "invalid"];

export default async function EditBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  const user = await requireDr("business.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const b = await prisma.business.findFirst({
    where: { id, deletedAt: null },
    include: { locations: { where: { isPrimary: true, deletedAt: null }, take: 1, include: { city: true } }, translations: { select: { locale: true, description: true } } },
  });
  if (!b) notFound();
  await assertBusinessAccess(user, b.id);
  const loc = b.locations[0] ?? null;
  const services = await prisma.service.findMany({
    where: { businessId: b.id, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, nameCkb: true, status: true },
  });
  const options = await formOptions(locale);
  const readiness = publishReadiness({ name: b.name, categoryId: b.categoryId, primary: loc });
  const notice = sp.published ? "published" : sp.submitted ? "submitted" : sp.blocked ? "blocked" : sp.saved ? "saved" : null;

  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/businesses" className="text-muted hover:text-ink">{t("dashboard.businesses")}</Link></nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("bizForm.editTitle")}: <bdi>{b.name}</bdi></h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold" data-testid="business-status">{t(`status.${b.status}`)}</span>
          {b.status === "published" && <Link href={`/${locale}/business/${b.slug}`} className="font-semibold text-brand hover:underline">{t("bizForm.viewPublic")}</Link>}
        </div>
      </div>

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
                <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full text-xs font-bold ${done ? "bg-[oklch(0.9_0.08_150)] text-[oklch(0.35_0.1_150)]" : "bg-brand-soft text-brand"}`}>{done ? "✓" : "!"}</span>
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
          description: b.description ?? undefined, phone: b.phone ?? undefined, email: b.email ?? undefined, website: b.website ?? undefined,
          addressLine1: loc?.addressLine1, postalCode: loc?.postalCode ?? undefined, countryCode: loc?.countryCode ?? "DE",
          city: loc?.city ? localize({ ...loc.city, name: loc.city.nameEn }, "name", locale).text : undefined,
          latitude: loc?.latitude, longitude: loc?.longitude, coordsSource: loc?.coordsSource, coordsVerified: Boolean(loc?.coordsVerifiedAt),
          hours: Object.fromEntries(hoursRows(loc?.openingHours).map((r) => [r.day, r.value])),
          logoUrl: b.logoUrl, coverUrl: b.coverUrl, status: b.status, languages: b.languages,
          translations: {
            ckb: b.descriptionCkb ?? undefined, kmr: b.descriptionKmr ?? undefined, de: b.descriptionDe ?? undefined, ar: b.descriptionAr ?? undefined, tr: b.descriptionTr ?? undefined,
            ...Object.fromEntries(b.translations.flatMap((x) => (x.description ? [[x.locale, x.description]] : []))),
          },
        }}
        {...options}
        canPublish={can(user.role, "business.publish")}
        storageReady={isStorageConfigured()}
      />

      <section aria-labelledby="biz-services" className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="business-services">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="biz-services" className="text-base font-bold">{t("dashboard.services")}</h2>
          {can(user.role, "service.write") && <Link href={`/dr/services/new?business=${b.id}`} className="inline-flex min-h-10 items-center rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand hover:bg-brand hover:text-brand-ink">+ {t("svcForm.new")}</Link>}
        </div>
        {services.length === 0 ? <p className="text-sm text-muted">{t("svcForm.noneYet")}</p> : (
          <ul className="divide-y divide-line">
            {services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <bdi className="font-semibold">{s.nameCkb && locale === "ckb" ? s.nameCkb : s.name}</bdi>
                <span className="flex items-center gap-3"><span className="text-muted">{t(`status.${s.status}`)}</span>
                  {can(user.role, "service.write") && <Link href={`/dr/services/${s.id}`} className="font-semibold text-brand hover:underline">{t("bizForm.edit")}</Link>}</span>
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
