import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatNumber, type Locale } from "@/i18n/locales";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { BUSINESS_LIST, BUSINESS_NEW } from "@/features/business/paths";

export default async function BusinessHome() {
  const user = await requireDr("business.read");
  const locale = await getLocale() as Locale;
  const t = await getTranslations();
  // Even platform staff entering the owner workspace see only explicit active memberships here.
  const where = { deletedAt: null, members: { some: { userId: user.id, isActive: true } } };
  const [total, businesses] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({ where, orderBy: { updatedAt: "desc" }, take: 6,
      select: { id: true, name: true, status: true, verified: true } }),
  ]);
  return <div className="mx-auto max-w-3xl space-y-6" data-testid="business-owner-home">
    <div className="text-center sm:text-start">
      <p className="mb-2 text-sm font-bold text-brand" lang="en" dir="ltr">REGA Business</p>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("businessOwner.dashboard")}</h1>
      <p className="mt-2 text-sm leading-7 text-muted">{t(total ? "businessOwner.manageLead" : "businessOwner.welcome")}</p>
    </div>
    <section className="rega-card space-y-5 p-5 sm:p-6" aria-label={t("businessOwner.myBusinesses")}>
      {total > 0 && <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">{t("businessOwner.myBusinesses")}</h2><p className="mt-1 text-3xl font-extrabold">{formatNumber(total, locale)}</p></div>
        <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand"><FigmaIcon name="briefcase-business" className="size-7" /></span>
      </div>}
      <Link href={BUSINESS_NEW} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-bold text-brand-ink hover:bg-brand-hover" data-testid="owner-add-business">
        <FigmaIcon name="plus-square" className="size-5 shrink-0" /><span>{t("businessOwner.addBusiness")}</span>
      </Link>
      {businesses.length > 0 && <ul className="divide-y divide-line" data-testid="owner-businesses">
        {businesses.map((b) => <li key={b.id}>
          <Link href={`${BUSINESS_LIST}/${b.id}`} className="flex min-h-20 flex-wrap items-center justify-between gap-3 rounded-lg py-4 hover:bg-surface-2">
            <bdi className="min-w-0 break-words font-bold">{b.name}</bdi>
            <span className="text-sm text-muted">{t(`status.${b.status}`)} · {t(b.verified ? "businessModeration.verification" : "businessModeration.unverified")}</span>
          </Link>
        </li>)}
      </ul>}
      {total > 0 && <Link href={BUSINESS_LIST} className="flex min-h-11 items-center font-semibold text-brand hover:underline">{t("businessOwner.myBusinesses")}</Link>}
    </section>
    <nav aria-label={t("businessOwner.title")} className="rega-card divide-y divide-line px-5">
      {[[`${BUSINESS_LIST}?status=pending`, "businessOwner.requests", "file-text"], [`/${locale}/account`, "auth.profile", "user"]].map(([href, key, icon]) =>
        <Link key={href} href={href} className="flex min-h-16 items-center gap-3 py-3 font-semibold hover:text-brand"><FigmaIcon name={icon} className="size-5 shrink-0" /><span>{t(key)}</span><FigmaIcon name="arrow-right" className="ms-auto size-4 shrink-0 rtl:rotate-180" /></Link>)}
    </nav>
    <Link href={`/${locale}/contact`} className="flex min-h-16 items-center gap-3 rounded-xl bg-surface-2 px-5 py-4 text-sm font-semibold hover:text-brand"><FigmaIcon name="phone" className="size-5 shrink-0" />{t("businessOwner.help")}</Link>
  </div>;
}
