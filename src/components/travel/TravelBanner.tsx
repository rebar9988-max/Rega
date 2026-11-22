import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

/**
 * Home Rega24Travel card. The owner artwork (public/travel/home-banner-clean.webp) keeps its 16:9 framing and the
 * "Rega24Travel" wordmark (a brand name, identical in every language). The language-dependent tagline and the
 * button label are real HTML text, so they follow the active locale and its RTL/LTR direction.
 */
export async function TravelBanner({ className = "" }: { className?: string }) {
  const t = await getTranslations("travel");
  return (
    <section className={className} aria-label="Rega24Travel">
      <div className="relative [container-type:inline-size]" data-testid="home-travel-banner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/travel/home-banner-clean.webp" alt="Rega24Travel" width={1536} height={864}
          loading="lazy" decoding="async" className="block h-auto w-full" />
        {/* Physical coordinates: the artwork's text column is on the left in every language. */}
        <p data-testid="home-travel-tagline"
          className="pointer-events-none absolute left-[4.6%] top-[38%] flex h-[15.5%] w-[47%] items-center justify-center text-center font-bold leading-[1.3] text-ink [text-wrap:balance]"
          style={{ fontSize: "clamp(11px, 3.05cqw, 1.9rem)" }}>
          {t("tagline")}
        </p>
        {/* The link is the 44px touch target; the visible pill inside matches the artwork's original button size. */}
        <Link href="/travel" data-testid="home-travel-cta"
          className="absolute left-[5.2%] top-[68.3%] flex h-[max(44px,11.2cqw)] w-[43.3%] -translate-y-1/2 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <span className="flex h-[11.2cqw] w-full items-center justify-center gap-[2.2cqw] rounded-full bg-gradient-to-b from-[#f2332d] via-[#e0150f] to-[#b50e0c] px-[2.4cqw] font-bold leading-[1.15] text-white shadow-[0_1.6cqw_2.6cqw_-1cqw_rgb(190_16_12/0.55),inset_0_1px_0_rgb(255_255_255/0.4)]"
            style={{ fontSize: "clamp(11px, 3.3cqw, 1.7rem)" }}>
            <span aria-hidden="true"
              className="grid aspect-square h-[78%] shrink-0 place-items-center rounded-full border-2 border-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                className="h-[52%] w-[52%] rtl:-scale-x-100"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
            <span className="sr-only">Rega24Travel — </span>
            <span className="min-w-0 text-center [text-wrap:balance]">{t("startCta")}</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
