import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { localizeText } from "@/lib/content";
import { getCategories, getNearbyCities } from "@/lib/data";
import { currentRequester } from "@/features/smart-request/guest";
import { listMyRequests } from "@/features/smart-request/service";
import { SmartRequestForm } from "@/features/smart-request/SmartRequestForm";
import { StatusBadge } from "@/features/smart-request/ui";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "smartRequest" });
  return pageMetadata({ locale, path: "/smart-request", title: t("title"), description: t("subtitle") });
}

export default async function SmartRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("smartRequest");
  const tn = await getTranslations("nav");
  // Public: no sign-in. A signed-in account sees its requests; a guest sees the requests saved on this device.
  const requester = await currentRequester().catch(() => null);
  const [requests, categories, cities] = await Promise.all([
    requester ? listMyRequests(requester.actor).catch(() => []) : Promise.resolve([] as Awaited<ReturnType<typeof listMyRequests>>),
    getCategories().catch(() => []),
    getNearbyCities().catch(() => []),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} crumbs={[{ label: tn("home"), href: "/" }, { label: t("title") }]} />
      <div className="container-page max-w-3xl pb-10">
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-1 text-xs font-bold text-brand-text"><span aria-hidden="true">✓</span>{t("freeBadge")}</span>
          <ol aria-label={t("howTitle")} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {(["step1", "step2", "step3"] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-ink">{i + 1}</span>
                <span>{t(k)}</span>
              </li>
            ))}
          </ol>
        </div>

        <section aria-label={t("newTitle")} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-6">
          <SmartRequestForm
            categories={categories.map((c) => ({ id: c.id, label: localizeText(c, "name", locale) })).filter((c) => c.label)}
            cities={cities.map((c) => ({ id: c.id, label: localizeText(c, "name", locale) }))}
          />
          <p className="mt-4 text-xs text-muted">{t("privacyNote")}</p>
        </section>

        {requests.length > 0 && (
          <section aria-labelledby="sr-mine" className="mt-8">
            <h2 id="sr-mine" className="text-lg font-bold">{t("myRequests")}</h2>
            {requester?.guest && <p className="mt-1 text-xs text-muted">{t("deviceNote")}</p>}
            <ul className="mt-3 grid gap-2" data-testid="my-requests">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/smart-request/${r.id}`} className="rega-card flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{r.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{t("matched", { count: r.matchedCount })} · {t("offersCount", { count: r.offerCount })}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.newOffers > 0 && <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-ink">{t("newOffers", { count: r.newOffers })}</span>}
                      <StatusBadge row={r} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {requester && !requester.guest && (
          <p className="mt-8 text-sm"><Link href="/smart-request/inbox" className="font-semibold text-brand-text underline">{t("businessInboxLink")}</Link></p>
        )}
      </div>
    </>
  );
}
