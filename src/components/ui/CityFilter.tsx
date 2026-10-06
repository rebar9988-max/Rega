"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = { id: string; label: string };

function searchText(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function CityFilter({ cities, value, allLabel, cityLabel, fieldClass }: { cities: Option[]; value?: string; allLabel: string; cityLabel: string; fieldClass: string }) {
  const root = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => cities.find((c) => c.id === value), [cities, value]);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const normalized = searchText(query);

  const matches = useMemo(() => {
    if (!normalized) return cities.slice(0, 12);
    const starts: Option[] = [];
    const contains: Option[] = [];
    for (const city of cities) {
      const label = searchText(city.label);
      if (label.startsWith(normalized)) starts.push(city);
      else if (label.includes(normalized)) contains.push(city);
      if (starts.length + contains.length >= 40) break;
    }
    return [...starts, ...contains].slice(0, 40);
  }, [cities, normalized]);

  const exact = useMemo(() => cities.find((c) => searchText(c.label) === normalized), [cities, normalized]);
  const currentId = exact?.id ?? (selected && query === selected.label ? selected.id : "");

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const choose = (city: Option) => {
    setQuery(city.label);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <label htmlFor="f-city-search" className="sr-only">{cityLabel}</label>
      <div className="relative">
        <input
          id="f-city-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="f-city-results"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder={allLabel}
          autoComplete="off"
          className={`${fieldClass} pe-10`}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted">⌄</span>
      </div>

      {open && (
        <div id="f-city-results" role="listbox" className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
          {!normalized && <div className="px-3 py-2 text-xs font-semibold text-muted">{allLabel}</div>}
          {matches.map((city) => (
            <button
              key={city.id}
              type="button"
              role="option"
              aria-selected={city.id === currentId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(city)}
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-start text-sm hover:bg-brand/10 focus:bg-brand/10 focus:outline-none"
            >
              {city.label}
            </button>
          ))}
          {normalized && matches.length === 0 && <div className="px-3 py-3 text-sm text-muted">{allLabel}</div>}
        </div>
      )}

      <select
        id="f-city"
        name="city"
        aria-label={cityLabel}
        value={currentId}
        onChange={(e) => {
          const city = cities.find((item) => item.id === e.target.value);
          setQuery(city?.label ?? "");
        }}
        className="sr-only"
        tabIndex={-1}
      >
        <option value="">{allLabel}</option>
        {cities.map((city) => <option key={city.id} value={city.id}>{city.label}</option>)}
      </select>
    </div>
  );
}
