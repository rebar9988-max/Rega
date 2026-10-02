import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatDate, type Locale } from "@/config/locales";
import { localizeText } from "@/lib/content";
import { VerifiedBadge } from "@/components/ui/Badge";
import type { ContentSection } from "./config";
import { textOf, type Entry } from "./queries";

/** Wall-clock times (see wallClock): shown as typed, never shifted into the visitor's time zone. */
export const formatWhen = (d: Date, locale: Locale, withTime = true) => formatDate(d, locale, { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), timeZone: "UTC" });

export async function EntryCard({ entry, section, locale }: { entry: Entry; section: ContentSection; locale: Locale }) {
  const t = await getTranslations("content");
  const text = textOf(entry, locale);
  if (!text) return null;
  const other = text.fallback ? LOCALE_META[text.locale] : null;
  const city = entry.city ? localizeText({ ...entry.city, name: entry.city.nameEn }, "name", locale) : null;
  const who = entry.business ? localizeText(entry.business, "name", locale) : null;
  const meta: string[] = [];
  if (who) meta.push(who);
  if (city) meta.push(city);
  if (entry.job) meta.push(t(`type_${entry.job.employmentType}` as never));
  if (entry.guide?.readMinutes) meta.push(t("readTime", { count: entry.guide.readMinutes }));

  return (
    <article className="relative flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-5 card-lift shadow-card hover:border-brand/40" data-testid="content-card">
      {entry.event && <p className="text-sm font-semibold text-brand"><time dateTime={entry.event.startsAt.toISOString().slice(0, 16)}>{formatWhen(entry.event.startsAt, locale)}</time></p>}
      <h2 className="text-base font-bold">
        <Link href={`/${section}/${entry.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
          <bdi lang={other?.htmlLang} dir={other?.dir}>{text.title}</bdi>
        </Link>
      </h2>
      {text.summary && <p className="line-clamp-3 text-sm text-muted"><bdi lang={other?.htmlLang} dir={other?.dir}>{text.summary}</bdi></p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted">
        {meta.map((m, i) => <span key={i}><bdi>{m}</bdi></span>)}
        {entry.verified && <VerifiedBadge />}
      </div>
    </article>
  );
}
