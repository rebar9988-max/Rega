"use client";

import { useMemo, useState } from "react";

type Option = { id: string; label: string };

export function CityFilter({ cities, value, allLabel, cityLabel, fieldClass }: { cities: Option[]; value?: string; allLabel: string; cityLabel: string; fieldClass: string }) {
  const selected = useMemo(() => cities.find((c) => c.id === value), [cities, value]);
  const [query, setQuery] = useState(selected?.label ?? "");
  const normalized = query.trim().toLocaleLowerCase();
  const matches = normalized ? cities.filter((c) => c.label.toLocaleLowerCase().includes(normalized)).slice(0, 40) : cities.slice(0, 40);
  const exact = cities.find((c) => c.label.toLocaleLowerCase() === normalized);
  return (
    <div className="relative">
      <label htmlFor="f-city-search" className="sr-only">{cityLabel}</label>
      <input id="f-city-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={allLabel} autoComplete="off" className={fieldClass} list="f-city-options" />
      <input type="hidden" name="city" value={exact?.id ?? (selected && query === selected.label ? selected.id : "")} />
      <datalist id="f-city-options">{matches.map((c) => <option key={c.id} value={c.label} />)}</datalist>
      <select id="f-city" value={exact?.id ?? (selected && query === selected.label ? selected.id : "")} onChange={(e) => { const c = cities.find((x) => x.id === e.target.value); setQuery(c?.label ?? ""); }} className="sr-only" tabIndex={-1} aria-hidden="true">
        <option value="">{allLabel}</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </div>
  );
}
