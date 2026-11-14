import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { currentAccount } from "@/lib/auth-helpers";
import { listMyRequests } from "@/features/smart-request/service";
import { StatusBadge } from "@/features/smart-request/ui";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "smartRequest" });
  return pageMetadata({ locale, path: "/smart-request", title: t("title"), description: t("subtitle") });
}

const btn = "inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 text-base font-bold text-brand-ink hover:bg-brand-hover";

export default async function SmartRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("smartRequest");
  const tn = await getTranslations("nav");
  const user = await currentAccount().catch(() => null);
  const requests = user ? await listMyRequests(user.id).catch(() => []) : [];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} crumbs={[{ label: tn("home"), href: "/" }, { label: t("title") }]} />
      <div className="container-page max-w-3xl pb-10">
        <section aria-labelledby="sr-how" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 id="sr-how" className="text-lg font-bold">{t("howTitle")}</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["step1", "step2", "step3"] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{i + 1}</span>
                <span>{t(k)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/smart-request/new" className={btn}>{t("cta")}</Link>
            {user && <Link href="/smart-request/inbox" className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold hover:border-brand">{t("businessInboxLink")}</Link>}
          </div>
          <p className="mt-4 text-xs text-muted">{t("privacyNote")}</p>
        </section>

        <section aria-labelledby="sr-mine" className="mt-8">
          <h2 id="sr-mine" className="text-lg font-bold">{t("myRequests")}</h2>
          {!user ? (
            <p className="mt-3 text-sm text-muted">{t("signinPrompt")} <Link href="/login?next=/smart-request" className="font-semibold text-brand-text underline">{t("signin")}</Link></p>
          ) : requests.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t("noRequests")}</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/smart-request/${r.id}`} className="rega-card flex flex-wrap items-center justify-between gap-3 p-4">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{r.title}</span>
                      <span className="mt-1 block text-xs text-muted">{t("matched", { count: r.matchedCount })} · {t("offersCount", { count: r.offerCount })}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {r.newOffers > 0 && <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-ink">{t("newOffers", { count: r.newOffers })}</span>}
                      <StatusBadge row={r} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
