"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AddressResult } from "@/lib/address-result";
export function AddressSearch({ onSelect, country }: { onSelect: (result: AddressResult) => void; country?: string }) {
  const t = useTranslations("locationSearch");
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const revision = useRef(0);
  useEffect(() => {
    const version = ++revision.current;
    const controller = new AbortController();
    setResults([]); setActive(-1); setStatus("");
    if (query.trim().length < 3) return;
    const timer = setTimeout(async () => {
      setStatus(t("loading"));
      try {
        const params = new URLSearchParams({ q: query.trim(), ...(country ? { country } : {}) });
        const response = await fetch(`/api/v1/address?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (version !== revision.current) return;
        setResults(body.data); setStatus(body.data.length ? "" : t("empty"));
      } catch { if (!controller.signal.aborted && version === revision.current) setStatus(t("unavailable")); }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, country, t]);
  function select(result: AddressResult) { ++revision.current; setQuery(""); setResults([]); onSelect(result); }
  return <div className="relative rounded-2xl border border-line bg-surface p-3 shadow-card" data-testid="address-search">
    <label htmlFor={id} className="sr-only">{t("label")}</label>
    <input id={id} type="search" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={`${id}-results`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
      className="min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand" placeholder={t("label")} maxLength={160} value={query} onChange={e => setQuery(e.target.value)}
      onKeyDown={e => { if (e.key === "Escape") { ++revision.current; setResults([]); }
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && results.length) { e.preventDefault(); setActive(i => (i + (e.key === "ArrowDown" ? 1 : results.length - 1) + results.length) % results.length); }
        if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && results[active]) select(results[active]); }
      }} />
    <ul id={`${id}-results`} role="listbox" aria-label={t("label")} className="max-h-64 overflow-auto">
      {results.map((result, i) => <li key={`${result.lat}:${result.lng}:${i}`} id={`${id}-${i}`} role="option" aria-selected={i === active}>
        <button type="button" className={`min-h-12 w-full rounded-xl p-3 text-start text-sm hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand ${active === i ? "bg-brand-soft" : ""}`} onClick={() => select(result)}>{result.label}</button>
      </li>)}
    </ul>
    <p role="status" className="text-sm text-muted">{status}</p>
    <p className="mt-1 text-xs text-muted">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Photon</p>
  </div>;
}
