import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { canManageBusiness } from "@/lib/business-access";
import { isStorageConfigured } from "@/lib/env";
import { OFFER_CURRENCIES, OFFER_LIMITS, addDaysYmd, localYmd, offerTimezone } from "@/lib/offers";
import { OfferForm } from "@/components/dr/OfferForm";

export default async function NewOffer({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const user = await requireDr("business.write");
  const t = await getTranslations();
  const { business: businessId } = await searchParams;
  // Only a business this person manages; anything else looks like a missing page.
  if (!businessId || !(await canManageBusiness(user, businessId))) notFound();
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
