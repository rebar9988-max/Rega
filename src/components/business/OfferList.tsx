"use client";

/**
 * Running offers on a business profile. The server only sends offers that are running when the page is rendered, but
 * public pages are cached for a few minutes (and longer while they refresh), so this list also checks the real time in
 * the browser and drops an offer the moment its last day is over (or when it has not started yet). An offer is never
 * shown with a "was" price or a computed discount: only the discount the business declared.
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency, formatDate, formatNumber, type Locale } from "@/config/locales";

export type PublicOffer = {
  id: string; title: string; description: string | null; imageUrl: string | null;
  discountType: string; discountValue: number | null; currency: string | null;
  /** ISO instants: running from `startsAt` (inclusive) until `endsAt` (exclusive). */
  startsAt: string; endsAt: string;
};

export function OfferList({ offers, serverNow, timeZone }: { offers: PublicOffer[]; serverNow: string; timeZone: string }) {
  const t = useTranslations("offers");
  const locale = useLocale() as Locale;
  const [now, setNow] = useState(() => Date.parse(serverNow));

  // Right after hydration (a cached page may be minutes old) and then every 30 seconds.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, []);

  const running = offers.filter((o) => Date.parse(o.startsAt) <= now && now < Date.parse(o.endsAt));
  if (running.length === 0) return null;

  return (
    <section aria-labelledby="offers" data-testid="business-offers">
      <h2 id="offers" className="mb-3 text-xl font-bold">{t("title")}</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {running.map((o) => {
          const discount = o.discountValue == null ? null
            : o.discountType === "percent" ? t("percentOff", { value: formatNumber(o.discountValue / 100, locale, { style: "percent", maximumFractionDigits: 0 }) })
            : o.discountType === "amount" ? t("amountOff", { value: formatCurrency(o.discountValue, locale, o.currency ?? undefined) })
            : null;
          // The stored end is the start of the day after the last day.
          const lastDay = formatDate(new Date(Date.parse(o.endsAt) - 1), locale, { timeZone });
          return (
            <li key={o.id} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card" data-testid="offer">
              {o.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.imageUrl} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover" />
              )}
              <div className="space-y-2 p-4">
                {discount && <p className="inline-block rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-text" data-testid="offer-discount">{discount}</p>}
                <h3 className="font-bold"><bdi>{o.title}</bdi></h3>
                {o.description && <p className="whitespace-pre-line text-sm leading-6 text-muted"><bdi>{o.description}</bdi></p>}
                <p className="text-xs text-muted">{t("validUntil", { date: lastDay })}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
