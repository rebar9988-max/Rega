import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import type { Locale } from "@/i18n/locales";
import { assertBusinessAccess } from "@/lib/business-access";
import { ServiceForm } from "@/components/dr/ServiceForm";
import { SERVICE_CURRENCIES } from "@/lib/service-admin";
import { serviceFormOptions } from "../form-options";

type Sp = { saved?: string; published?: string; blocked?: string };

export default async function EditService({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  const user = await requireDr("service.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const s = await prisma.service.findFirst({ where: { id, deletedAt: null }, include: { business: { select: { slug: true, status: true, name: true } } } });
  if (!s) notFound();
  await assertBusinessAccess(user, s.businessId);
  const options = await serviceFormOptions(user, locale);
  const notice = sp.published ? "published" : sp.blocked ? "blocked" : sp.saved ? "saved" : null;

  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/services" className="text-muted hover:text-ink">{t("dashboard.services")}</Link></nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("svcForm.editTitle")}: <bdi>{s.name}</bdi></h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold" data-testid="service-status">{t(`status.${s.status}`)}</span>
          {s.status === "published" && s.business.status === "published" && <Link href={`/${locale}/services/${s.business.slug}/${s.slug}`} className="font-semibold text-brand hover:underline">{t("bizForm.viewPublic")}</Link>}
        </div>
      </div>
      {notice && (
        <div role="status" data-testid="form-notice" className={`mb-6 rounded-xl px-4 py-3 text-sm font-semibold ${notice === "blocked" ? "bg-brand-soft text-ink" : "bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]"}`}>
          {t(`svcForm.notice_${notice}`)}
        </div>
      )}
      {s.status === "published" && s.business.status !== "published" && (
        <p className="mb-6 rounded-xl bg-surface-2 px-4 py-3 text-sm" data-testid="business-not-public">{t("svcForm.businessNotPublic")}</p>
      )}
      <ServiceForm
        key={s.updatedAt.toISOString()}
        initial={{
          id: s.id, businessId: s.businessId, categoryId: s.categoryId, name: s.name, nameCkb: s.nameCkb, nameKmr: s.nameKmr, nameAr: s.nameAr, nameTr: s.nameTr,
          description: s.description, descriptionCkb: s.descriptionCkb, descriptionDe: s.descriptionDe, descriptionAr: s.descriptionAr,
          priceFrom: s.priceFrom?.toString() ?? null, priceTo: s.priceTo?.toString() ?? null, currency: s.currency, durationMin: s.durationMin, sortOrder: s.sortOrder,
        }}
        {...options}
        currencies={SERVICE_CURRENCIES}
        canPublish={can(user.role, "service.publish")}
      />
    </>
  );
}
