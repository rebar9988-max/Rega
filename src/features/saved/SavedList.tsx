"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Bidi";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { buttonClass } from "@/components/ui/Button";
import { clearSavedBusinesses, getSavedBusinesses, getServerSavedBusinesses, removeSavedBusiness, subscribeSavedBusinesses } from "@/lib/saved-store";
import { SAVED_MAX } from "@/lib/saved-businesses";

type City = { nameEn: string } & Record<string, unknown>;
type Row = Record<string, unknown> & {
  slug: string; logoUrl: string | null;
  locations: { city: City | null }[];
};

export type SavedLabels = {
  loading: string; empty: string; browse: string; remove: string; clearAll: string; error: string; retry: string; unavailable: string;
};

/**
 * The visitor's saved businesses, read from this browser and looked up in the public businesses API (published
 * records only, in saved order). Businesses that are no longer public are counted, not shown.
 */
export function SavedList({ locale, pageLang, labels }: { locale: Locale; pageLang: string; labels: SavedLabels }) {
  const slugs = useSyncExternalStore(subscribeSavedBusinesses, getSavedBusinesses, getServerSavedBusinesses);
  const hydrated = useSyncExternalStore(subscribeSavedBusinesses, () => true, () => false);
  const key = slugs.join(",");
  const [state, setState] = useState<{ key: string; rows: Row[] | null; failed: boolean }>({ key: "", rows: null, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ slugs: key, perPage: String(SAVED_MAX) });
    fetch(`/api/v1/businesses?${query}`, { headers: { accept: "application/json" }, signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as { ok?: boolean; data?: Row[] };
        if (!res.ok || !body.ok || !Array.isArray(body.data)) throw new Error("saved lookup");
        setState({ key, rows: body.data, failed: false });
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name !== "AbortError") setState({ key, rows: null, failed: true });
      });
    return () => controller.abort();
  }, [key, attempt]);

  if (!hydrated) return <p className="text-sm text-muted">{labels.loading}</p>;

  if (slugs.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center shadow-card" data-testid="saved-empty">
        <FigmaIcon name="bookmark" className="mx-auto size-8 text-brand-text" />
        <p className="mt-3 text-muted">{labels.empty}</p>
        <Link href="/businesses" className={buttonClass("primary", "mt-4 min-h-11 px-5")}>{labels.browse}</Link>
      </div>
    );
  }

  const current = state.key === key ? state : { rows: null, failed: false };
  if (current.failed) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <p>{labels.error}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={buttonClass("secondary", "mt-3 min-h-11 px-4")}>{labels.retry}</button>
      </div>
    );
  }
  if (!current.rows) return <p className="text-sm text-muted" role="status">{labels.loading}</p>;

  const bySlug = new Map(current.rows.map((r) => [r.slug, r]));
  const rows = slugs.map((s) => bySlug.get(s)).filter((r): r is Row => Boolean(r));
  const missing = slugs.length - rows.length;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="saved-list">
        {rows.map((b) => {
          const name = localize(b, "name", locale);
          const city = b.locations[0]?.city;
          const cityName = city ? localize({ ...city, name: city.nameEn }, "name", locale) : null;
          return (
            <li key={b.slug} className="rega-card flex items-center gap-3 p-3">
              <Avatar name={name.text} src={b.logoUrl} size="size-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">
                  <Link href={`/business/${b.slug}`} className="truncate hover:underline"><Text value={name} pageLang={pageLang} /></Link>
                </p>
                {cityName && (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted">
                    <FigmaIcon name="map-pin" className="size-4 shrink-0 text-brand-text" /><Text value={cityName} pageLang={pageLang} />
                  </p>
                )}
              </div>
              <button type="button" onClick={() => removeSavedBusiness(b.slug)} className={buttonClass("secondary", "min-h-11 shrink-0 px-3 text-sm")}
                aria-label={`${labels.remove} – ${name.text}`}>
                {labels.remove}
              </button>
            </li>
          );
        })}
      </ul>
      {missing > 0 && <p className="text-sm text-muted">{labels.unavailable.replace("{count}", String(missing))}</p>}
      <div>
        <button type="button" onClick={clearSavedBusinesses} className={buttonClass("secondary", "min-h-11 px-4 text-sm")}>{labels.clearAll}</button>
      </div>
    </div>
  );
}
