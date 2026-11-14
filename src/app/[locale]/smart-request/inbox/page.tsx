import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { currentAccount } from "@/lib/auth-helpers";
import { localizeText } from "@/lib/content";
import { markSeen, businessInbox } from "@/features/smart-request/service";
import { togglePrefAction } from "@/features/smart-request/actions";
import { OfferForm } from "@/features/smart-request/OfferForm";
import { distanceLabel, isActionable } from "@/features/smart-request/rules";
import { StatusBadge } from "@/features/smart-request/ui";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "smartRequest" });
  return pageMetadata({ locale, path: "/smart-request/inbox", title: t("inboxTitle"), description: t("inboxIntro"), noindex: true });
}

export default async function SmartRequestInboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const user = await currentAccount().catch(() => null);
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/smart-request/inbox`)}`);
  const t = await getTranslations("smartRequest");
  const { businesses, items } = await businessInbox(user.id);
  // Opening the inbox is what marks a request as seen; the "new" badge below was decided before.
  await Promise.all(items.filter((i) => !i.seen).map((i) => markSeen(user.id, i.recipientId).catch(() => null)));
  return (
    <>
      <PageHeader title={t("inboxTitle")} subtitle={t("inboxIntro")} crumbs={[{ label: t("title"), href: "/smart-request" }, { label: t("inboxTitle") }]} />
      <div className="container-page max-w-3xl pb-10">
        {businesses.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-5 text-sm text-muted">{t("notBusiness")}</p>
        ) : (
          <>
            <ul className="grid gap-3">
              {businesses.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
                  <div>
                    <p className="font-bold">{localizeText(b, "name", locale)}</p>
                    <p className="text-xs text-muted">{b.enabled ? t("receivingOn") : t("receivingOff")}</p>
                  </div>
                  <form action={togglePrefAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="businessId" value={b.id} />
                    <input type="hidden" name="enabled" value={b.enabled ? "0" : "1"} />
                    <button type="submit" className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">{b.enabled ? t("pause") : t("resume")}</button>
                  </form>
                </li>
              ))}
            </ul>
            {items.length === 0 ? (
              <p className="mt-6 text-sm text-muted">{t("inboxEmpty")}</p>
            ) : (
              <ul className="mt-6 grid gap-4" data-testid="inbox-list">
                {items.map((i) => (
                  <li key={i.recipientId} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-bold">{i.request.title}</h2>
                      <span className="flex items-center gap-2">
                        {!i.seen && <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-ink">{t("newBadge")}</span>}
                        <StatusBadge row={i.request} />
                      </span>
                    </div>
                    {i.request.description && <p className="mt-2 whitespace-pre-line text-sm">{i.request.description}</p>}
                    <p className="mt-2 text-xs text-muted">{t("distance")}: {distanceLabel(i.distanceKm)}{businesses.length > 1 && <> · {localizeText(businesses.find((b) => b.id === i.businessId) ?? {}, "name", locale)}</>}</p>
                    {isActionable(i.request) && (
                      <div className="mt-4">
                        <h3 className="mb-2 text-sm font-bold">{t("yourOffer")}</h3>
                        <OfferForm requestId={i.request.id} businessId={i.businessId} offer={i.offer} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
