import { Link } from "@/i18n/routing";
import { localize, type Localized } from "@/lib/content";
import type { BusinessCardData } from "@/lib/data";
import type { Locale } from "@/i18n/locales";
import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Bidi";
import { FigmaIcon } from "./FigmaIcon";

/**
 * "Latest" card of design frame 204:912: 88px cover with the "new" badge, name, then city (with pin) and category.
 * Rows are written in reading order, so RTL renders exactly as the frame and LTR mirrors it. Without a cover photo a
 * branded panel with the business logo/initial is shown (never a stock photo that would misrepresent the business).
 * The frame's heart (favourites) is not shown: REGA has no favourites feature.
 */
export function LatestCard({ b, locale, pageLang, category, newLabel }: {
  b: BusinessCardData; locale: Locale; pageLang: string; category: Localized | null; newLabel: string;
}) {
  const name = localize(b, "name", locale);
  const city = b.locations[0]?.city;
  const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[8px] border border-line bg-surface shadow-[0_3px_12px_rgb(17_24_39/0.07)] transition-colors hover:border-brand/40">
      <div className="relative h-[88px] overflow-hidden bg-brand-soft">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverUrl} alt="" width={556} height={176} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--surface),var(--brand-soft))]">
            <Avatar name={name.text} src={b.logoUrl} size="size-12" />
          </div>
        )}
        <span className="absolute start-[10px] top-[10px] rounded-[4px] bg-brand px-2 py-1 text-[10px] font-bold text-white">{newLabel}</span>
      </div>
      <div className="flex flex-col gap-[3px] px-3 pb-[10px] pt-[9px]">
        <h3 className="truncate text-start text-[13px] font-bold leading-[inherit] text-ink">
          {/* Stretched link: whole card is clickable, one focus stop, one accessible name. */}
          <Link href={`/businesses/${b.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            <Text value={name} pageLang={pageLang} />
          </Link>
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 text-[10px] text-muted">
            <FigmaIcon name="map-pin" className="size-[11px] shrink-0" />
            <span className="truncate">{cityName ? <Text value={cityName} pageLang={pageLang} /> : null}</span>
          </span>
          {category && <span className="shrink-0 text-[10px] text-brand"><Text value={category} pageLang={pageLang} /></span>}
        </div>
      </div>
    </article>
  );
}
