import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { canManageBusiness, hasGlobalBusinessAccess } from "@/lib/business-access";
import type { Locale } from "@/i18n/locales";
import { LOCALES } from "@/config/locales";
import { ContentForm, type EntryInitial } from "@/components/dr/ContentForm";
import { CONTENT } from "@/features/content/config";
import { entryFormOptions } from "@/features/content/dashboard";
import { contentSection } from "../../guard";

type Sp = { saved?: string; published?: string; submitted?: string };

/** `<input type="date|datetime-local">` value from a stored date (UTC, no seconds). */
const toInput = (d: Date | null | undefined, withTime: boolean) => (d ? d.toISOString().slice(0, withTime ? 16 : 10) : undefined);

export default async function EditEntry({ params, searchParams }: { params: Promise<{ section: string; id: string }>; searchParams: Promise<Sp> }) {
  const [{ section: param, id }, sp] = await Promise.all([params, searchParams]);
  const section = contentSection(param);
  const config = CONTENT[section];
  const user = await requireDr(config.write);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const e = await prisma.listing.findFirst({
    where: { id, sectionKey: section, deletedAt: null },
    include: { translations: { select: { locale: true, title: true, summary: true, body: true } }, job: true, event: true, guide: true },
  });
  if (!e) notFound();
  // Same rule as the save action: staff with global access, the author, or a member of the entry's business.
  if (!hasGlobalBusinessAccess(user.role) && e.createdById !== user.id && !(e.businessId && (await canManageBusiness(user, e.businessId)))) notFound();

  const texts: EntryInitial["texts"] = {};
  for (const l of LOCALES) {
    const tr = e.translations.find((x) => x.locale === l);
    if (tr) texts[l] = { title: tr.title, summary: tr.summary ?? undefined, body: tr.body ?? undefined };
  }
  const initial: EntryInitial = {
    id: e.id, status: e.status, businessId: e.businessId ?? undefined, cityId: e.cityId ?? undefined, categoryId: e.categoryId ?? undefined, texts,
    employmentType: e.job?.employmentType, applyUrl: e.job?.applyUrl ?? undefined, applyEmail: e.job?.applyEmail ?? undefined, expiresAt: toInput(e.expiresAt, false), languages: e.job?.languages,
    startsAt: toInput(e.event?.startsAt, true), endsAt: toInput(e.event?.endsAt, true), venue: e.event?.venue ?? undefined, infoUrl: e.event?.infoUrl ?? undefined,
    readMinutes: e.guide?.readMinutes ?? undefined,
  };
  const options = await entryFormOptions(section, user, locale);
  const notice = sp.published ? "published" : sp.submitted ? "submitted" : sp.saved ? "saved" : null;

  return (
    <>
      <nav className="mb-2 text-sm"><Link href={`/dr/content/${section}`} className="text-muted hover:text-ink">{t(`nav.${section}`)}</Link></nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("content.editEntry")}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold" data-testid="entry-status">{t(`status.${e.status}`)}</span>
          {e.status === "published" && <Link href={`/${locale}/${section}/${e.slug}`} className="font-semibold text-brand hover:underline">{t("content.view")}</Link>}
        </div>
      </div>
      {notice && <div role="status" data-testid="form-notice" className="mb-6 rounded-xl bg-[oklch(0.95_0.05_150)] px-4 py-3 text-sm font-semibold text-[oklch(0.35_0.1_150)]">{t(`content.${notice}`)}</div>}
      <ContentForm key={e.updatedAt.toISOString()} section={section} initial={initial} {...options} requiresBusiness={config.requiresBusiness} canPublish={can(user.role, config.publish)} />
    </>
  );
}
