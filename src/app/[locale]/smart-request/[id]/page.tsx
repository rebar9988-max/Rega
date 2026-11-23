import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";
import { isLocale } from "@/config/locales";
import { LOCALE_META } from "@/i18n/locales";
import { pageMetadata } from "@/lib/seo";
import { currentRequester } from "@/features/smart-request/guest";
import { localizeText } from "@/lib/content";
import { whatsappLink } from "@/lib/whatsapp";
import { endRequestAction, selectOfferAction } from "@/features/smart-request/actions";
import { getMyRequest, markOffersSeen } from "@/features/smart-request/service";
import { distanceLabel, formatEuro, isActionable } from "@/features/smart-request/rules";
import { StatusBadge } from "@/features/smart-request/ui";

const AV_KEY = { now: "avNow", today: "avToday", tomorrow: "avTomorrow", thisWeek: "avThisWeek", onRequest: "avOnRequest" } as const;
const secondary = "min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-brand";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "smartRequest" });
  return pageMetadata({ locale, path: "/smart-request", title: t("title"), description: t("subtitle"), noindex: true });
}

export default async function SmartRequestDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  // Public: the signed-in owner or the guest device that created the request; anyone else gets 404.
  const requester = await currentRequester().catch(() => null);
  if (!requester) notFound();
  const t = await getTranslations("smartRequest");
  const data = await getMyRequest(requester.actor, id);
  if (!data) notFound();
  const { request, offers } = data;
  await markOffersSeen(requester.actor, id).catch(() => null);
  const actionable = isActionable(request);
  const cheapest = offers.length ? Math.min(...offers.map((o) => o.priceCents)) : null;
  const date = new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { dateStyle: "medium" }).format(request.expiresAt);
  return (
    <>
      <PageHeader title={request.title} subtitle={request.description ?? undefined} crumbs={[{ label: t("title"), href: "/smart-request" }, { label: request.title }]} />
      <div className="container-page max-w-3xl pb-10">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <StatusBadge row={request} />
          <span className="text-muted">{t("matched", { count: request.matchedCount })}</span>
          <span className="text-muted">{t("expiresOn", { date })}</span>
        </div>

        <section aria-labelledby="sr-offers" className="mt-6">
          <h2 id="sr-offers" className="text-lg font-bold">{t("offersTitle")} ({offers.length})</h2>
          {offers.length === 0 ? (
            <p className="mt-3 rounded-xl border border-line bg-surface px-4 py-5 text-sm text-muted">{t("noOffers")}</p>
          ) : (
            <ul className="mt-3 grid gap-3" data-testid="offer-list">
              {offers.map((o) => {
                const wa = o.contact ? whatsappLink(o.contact.whatsapp) : null;
                return (
                  <li key={o.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/business/${o.business.slug}`} className="block truncate font-bold hover:text-brand-text">{localizeText(o.business, "name", locale)}</Link>
                        <p className="mt-1 text-xs text-muted">
                          {o.business.ratingCount > 0 && <>★ {o.business.ratingAvg.toFixed(1)} ({o.business.ratingCount}) · </>}
                          {o.distanceKm !== null && <>{t("distance")}: {distanceLabel(o.distanceKm)} · </>}
                          {t("availability")}: {t(AV_KEY[o.availability as keyof typeof AV_KEY] ?? "avOnRequest")}
                        </p>
                      </div>
                      <p className="text-xl font-bold" dir="ltr">{formatEuro(o.priceCents)}{o.priceCents === cheapest && offers.length > 1 && <span className="ms-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-text">✓</span>}</p>
                    </div>
                    {o.message && <p className="mt-3 text-sm">{o.message}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {o.status === "selected" ? (
                        <>
                          <span className="inline-flex min-h-11 items-center rounded-xl bg-brand-soft px-4 text-sm font-bold">{t("selected")}</span>
                          {o.contact?.phone && <a href={`tel:${o.contact.phone.replace(/[^\d+]/g, "")}`} className={`${secondary} inline-flex items-center`}>{t("call")}</a>}
                          {wa && <a href={wa} rel="noopener noreferrer" target="_blank" className={`${secondary} inline-flex items-center`}>{t("whatsapp")}</a>}
                        </>
                      ) : actionable ? (
                        <form action={selectOfferAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="offerId" value={o.id} />
                          <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("selectOffer")}</button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {actionable && (
          <div className="mt-8 flex flex-wrap gap-3">
            {(["closed", "cancelled"] as const).map((kind) => (
              <form key={kind} action={endRequestAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={request.id} />
                <input type="hidden" name="kind" value={kind} />
                <button type="submit" className={secondary}>{kind === "closed" ? t("closeRequest") : t("cancelRequest")}</button>
              </form>
            ))}
          </div>
        )}
        <p className="mt-6 text-xs text-muted">{t("privacyNote")}</p>
      </div>
    </>
  );
}
