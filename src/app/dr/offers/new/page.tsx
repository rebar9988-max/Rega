import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { canManageBusiness, managedBusinessWhere } from "@/lib/business-access";
import { isStorageConfigured } from "@/lib/env";
import { OFFER_CURRENCIES, OFFER_LIMITS, addDaysYmd, localYmd, offerTimezone } from "@/lib/offers";
import { OfferForm } from "@/components/dr/OfferForm";

export default async function NewOffer({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const user = await requireDr("business.write");
  const t = await getTranslations();
  const { business: businessId } = await searchParams;
  // Opened from "add advertisement" without a business: choose one of the businesses this person manages.
  // Registering a business is not done here; it lives in the account.
  if (!businessId) {
    const businesses = await prisma.business.findMany({
      where: { deletedAt: null, ...managedBusinessWhere(user) }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, name: true },
    });
    return (
      <>
        <h1 className="mb-6 text-2xl font-extrabold">{t("offerForm.newTitle")}</h1>
        <section aria-labelledby="choose-business" className="max-w-2xl rounded-[14px] border border-line bg-surface p-6" data-testid="offer-choose-business">
          {businesses.length === 0
            ? <>
                <p id="choose-business" className="mb-4 text-sm text-muted">{t("offerForm.needBusiness")}</p>
                <a href={`/${await getLocale()}/account#my-businesses`} className="inline-flex min-h-11 items-center rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand-text hover:bg-brand hover:text-brand-ink">{t("auth.myBusinesses")}</a>
              </>
            : <>
                <h2 id="choose-business" className="mb-3 text-lg font-bold">{t("offerForm.chooseBusiness")}</h2>
                <ul className="divide-y divide-line">
                  {businesses.map((b) => (
                    <li key={b.id}><Link href={`/dr/offers/new?business=${b.id}`} className="flex min-h-12 items-center py-2 font-semibold hover:text-brand-text"><bdi className="truncate">{b.name}</bdi></Link></li>
                  ))}
                </ul>
              </>}
        </section>
      </>
    );
  }
  // Only a business this person manages; anything else looks like a missing page.
  if (!(await canManageBusiness(user, businessId))) notFound();
  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
    select: { id: true, name: true, locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { countryCode: true } } },
  });
  if (!business) notFound();
  const today = localYmd(new Date(), offerTimezone(business.locations[0]?.countryCode));

  return (
    <>
      <nav className="mb-2 text-sm"><Link href={`/dr/businesses/${business.id}`} className="text-muted hover:text-ink"><bdi>{business.name}</bdi></Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{t("offerForm.newTitle")}</h1>
      <OfferForm
        initial={{ businessId: business.id, discountType: "none", startDate: today, endDate: addDaysYmd(today, 29) ?? today }}
        businessName={business.name} currencies={OFFER_CURRENCIES} limits={OFFER_LIMITS} storageReady={isStorageConfigured()}
      />
    </>
  );
}
