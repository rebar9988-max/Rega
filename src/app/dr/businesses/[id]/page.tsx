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
import { formOptions } from "../form-options";

type Sp = { saved?: string; published?: string; blocked?: string };

export default async function EditBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  const user = await requireDr("business.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const b = await prisma.business.findFirst({
    where: { id, deletedAt: null },
    include: { locations: { where: { isPrimary: true, deletedAt: null }, take: 1, include: { city: true } } },
  });
  if (!b) notFound();
  const loc = b.locations[0] ?? null;
  const options = await formOptions(locale);
  const readiness = publishReadiness({ name: b.name, categoryId: b.categoryId, primary: loc });
  const notice = sp.published ? "published" : sp.blocked ? "blocked" : sp.saved ? "saved" : null;

  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/businesses" className="text-muted hover:text-ink">{t("dashboard.businesses")}</Link></nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("bizForm.editTitle")}: <bdi>{b.name}</bdi></h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold" data-testid="business-status">{t(`status.${b.status}`)}</span>
          {b.status === "published" && <Link href={`/${locale}/businesses/${b.slug}`} className="font-semibold text-brand hover:underline">{t("bizForm.viewPublic")}</Link>}
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
        }}
        {...options}
        canPublish={can(user.role, "business.publish")}
      />
    </>
  );
}
