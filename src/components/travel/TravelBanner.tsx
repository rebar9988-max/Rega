import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export async function TravelBanner({ className = "" }: { className?: string }) {
  const t = await getTranslations("travel");
  return (
    <section className={className} aria-label="Rega24Travel">
      <div className="relative" data-testid="home-travel-banner">
        {/* Keep the owner-supplied artwork intact, including its 16:9 framing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/travel/home-banner.jpeg" alt={t("tagline")} width={1536} height={864}
          loading="lazy" decoding="async" className="block h-auto w-full" />
        {/* Physical coordinates follow the painted button in both RTL and LTR. */}
        <Link href="/travel" data-testid="home-travel-cta"
          className="absolute left-[5.2%] top-[68.3%] h-[20%] min-h-11 w-[43.2%] -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <span className="sr-only">Rega24Travel — {t("startCta")}</span>
        </Link>
      </div>
    </section>
  );
}
