import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { assertBusinessAccess } from "@/lib/business-access";
import { isStorageConfigured } from "@/lib/env";
import { OFFER_CURRENCIES, OFFER_LIMITS, offerDates, offerState, offerTimezone } from "@/lib/offers";
import { OfferForm } from "@/components/dr/OfferForm";
import { setOfferActiveAction } from "../actions";

type Sp = { saved?: string; activated?: string; deactivated?: string; ended?: string };

export default async function EditOffer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  const user = await requireDr("business.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations();
  const locale = await getLocale();
  const offer = await prisma.offer.findFirst({
    where: { id },
    include: { business: { select: { id: true, name: true, slug: true, status: true, deletedAt: true, locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { countryCode: true } } } } },
  });
  if (!offer || offer.business.deletedAt) notFound();
  await assertBusinessAccess(user, offer.businessId);

  const tz = offerTimezone(offer.business.locations[0]?.countryCode);
  const state = offerState(offer, new Date());
  const dates = offerDates(offer, tz);
  const notice = sp.ended ? "ended" : sp.deactivated ? "deactivated" : sp.activated ? "activated" : sp.saved ? "saved" : null;

  return (
    <>
      <nav className="mb-2 text-sm"><Link href={`/admin/businesses/${offer.businessId}`} className="text-muted hover:text-ink"><bdi>{offer.business.name}</bdi></Link></nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("offerForm.editTitle")}: <bdi>{offer.title}</bdi></h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold" data-testid="offer-state">{t(`offerForm.state_${state}`)}</span>
          {state === "active" && offer.business.status === "published" && <Link href={`/${locale}/business/${offer.business.slug}`} className="font-semibold text-brand hover:underline">{t("bizForm.viewPublic")}</Link>}
        </div>
      </div>
      {notice && (
        <div role="status" data-testid="form-notice" className={`mb-6 rounded-xl px-4 py-3 text-sm font-semibold ${notice === "ended" ? "bg-brand-soft text-ink" : "bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]"}`}>
          {t(`offerForm.notice_${notice}`)}
        </div>
      )}
      {state === "active" && offer.business.status !== "published" && (
        <p className="mb-6 rounded-xl bg-surface-2 px-4 py-3 text-sm" data-testid="business-not-public">{t("offerForm.businessNotPublic")}</p>
      )}

      <OfferForm
        key={offer.updatedAt.toISOString()}
        initial={{
          id: offer.id, businessId: offer.businessId, title: offer.title, description: offer.description, imageUrl: offer.imageUrl,
          discountType: offer.discountType === "percent" || offer.discountType === "amount" ? offer.discountType : "none",
          discountValue: offer.discountValue?.toString() ?? null, currency: offer.currency, startDate: dates.startDate, endDate: dates.endDate,
        }}
        businessName={offer.business.name} currencies={OFFER_CURRENCIES} limits={OFFER_LIMITS} storageReady={isStorageConfigured()}
      />

      <form action={setOfferActiveAction} className="mt-6">
        <input type="hidden" name="id" value={offer.id} />
        <input type="hidden" name="active" value={offer.isActive ? "0" : "1"} />
        <button type="submit" className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-bold hover:border-brand hover:text-brand" data-testid="offer-switch">
          {offer.isActive ? t("offerForm.deactivate") : t("offerForm.activate")}
        </button>
        <p className="mt-2 text-xs text-muted">{offer.isActive ? t("offerForm.deactivateHint") : t("offerForm.activateHint")}</p>
      </form>
    </>
  );
}
