"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/locales";

type City = {
  id: string;
  nameEn: string;
  nameCkb?: string | null;
  nameKmr?: string | null;
  nameDe?: string | null;
  nameAr?: string | null;
  nameTr?: string | null;
  count: number;
};

type Props = {
  cities: City[];
  locale: Locale;
  activeCityId?: string;
  browseLabel: string;
  searchPlaceholder: string;
};

function localizeName(city: City, locale: Locale): string {
  const map: Record<string, string | null | undefined> = {
    ckb: city.nameCkb,
    kmr: city.nameKmr,
    de: city.nameDe,
    ar: city.nameAr,
    tr: city.nameTr,
    en: city.nameEn,
  };
  return (map[locale] || city.nameEn || "").trim();
}

function firstLetter(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "#";
  // Support Latin + Arabic-script first letters
  const ch = cleaned[0].toUpperCase();
  return ch;
}

export function CityBrowser({ cities, locale, activeCityId, browseLabel, searchPlaceholder }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => {
      const names = [c.nameEn, c.nameCkb, c.nameKmr, c.nameDe, c.nameAr, c.nameTr]
        .filter(Boolean)
        .map((n) => n!.toLowerCase());
      return names.some((n) => n.includes(q));
    });
  }, [cities, query]);

  const groups = useMemo(() => {
    const map = new Map<string, { city: City; label: string }[]>();
    for (const city of filtered) {
      const label = localizeName(city, locale);
      const letter = firstLetter(label);
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push({ city, label });
    }
    // Sort letters: Latin A-Z first, then Arabic-script, then #
    const keys = Array.from(map.keys()).sort((a, b) => {
      const isLatinA = /^[A-Z]$/.test(a);
      const isLatinB = /^[A-Z]$/.test(b);
      if (isLatinA && !isLatinB) return -1;
      if (!isLatinA && isLatinB) return 1;
      return a.localeCompare(b, locale === "ckb" || locale === "ar" ? "ckb" : "en");
    });
    return keys.map((letter) => ({
      letter,
      items: map.get(letter)!.sort((a, b) => a.label.localeCompare(b.label, locale === "ckb" || locale === "ar" ? "ckb" : "en")),
    }));
  }, [filtered, locale]);

  if (cities.length === 0) return null;

  return (
    <section aria-label={browseLabel} className="container-page mb-8">
      {/* Search */}
      <div className="mb-6">
        <label htmlFor="city-browser-search" className="sr-only">{searchPlaceholder}</label>
        <div className="relative max-w-md">
          <input
            id="city-browser-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="w-full min-h-11 rounded-xl border border-line bg-surface pe-10 ps-4 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
          />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted text-lg">⌕</span>
        </div>
        {query && (
          <p className="mt-2 text-sm text-muted">
            {filtered.length} / {cities.length}
          </p>
        )}
      </div>

      {/* Grouped grid */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">—</p>
      ) : (
        <div className="space-y-8">
          {groups.map(({ letter, items }) => (
            <div key={letter}>
              <h2 className="mb-3 inline-block border-b-2 border-brand/30 pb-1 text-lg font-bold text-brand">
                {letter}
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {items.map(({ city, label }) => {
                  const isActive = activeCityId === city.id;
                  return (
                    <li key={city.id}>
                      <Link
                        prefetch={false}
                        href={{ pathname: "/locations", query: { city: city.id } }}
                        aria-current={isActive ? "true" : undefined}
                        className={`card-lift flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition
                          ${isActive
                            ? "border-brand bg-brand-soft text-brand"
                            : "border-line bg-surface hover:border-brand/40 hover:bg-surface-2"
                          }`}
                      >
                        <span className="truncate">{label}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold
                          ${isActive ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted"}`}>
                          {city.count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
