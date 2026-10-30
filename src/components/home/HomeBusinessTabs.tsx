"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { openStatus } from "@/lib/geo";
import { FigmaIcon } from "@/components/home/FigmaIcon";

export type TabItem = { id: string; node: ReactNode; hours?: { value: unknown; countryCode: string; regionSlug?: string | null } };
export type BusinessTab = { key: string; label: string; icon: string; items: TabItem[]; openOnly?: boolean };

/**
 * Featured / Open now / Top rated / New filters of the reference. Every panel is rendered on the server from real
 * records; "Open now" keeps only the cards whose stored hours say open at this moment, computed in the browser (a
 * cached page never shows a stale state). Without JavaScript the first panel is shown. WAI-ARIA tabs pattern with
 * arrow-key, Home and End navigation; the arrows follow the reading direction.
 */
export function HomeBusinessTabs({ tabs, label, emptyLabel }: { tabs: BusinessTab[]; label: string; emptyLabel: string }) {
  const base = useId();
  const [active, setActive] = useState(0);
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const ids = new Set<string>();
      for (const tab of tabs) for (const item of tab.items) {
        if (!item.hours) continue;
        const s = openStatus(item.hours.value, item.hours.countryCode, now, undefined, item.hours.regionSlug).status;
        if (s === "OPEN" || s === "CLOSING_SOON") ids.add(item.id);
      }
      setOpenIds(ids);
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [tabs]);

  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key as "ArrowRight" | "ArrowLeft"];
    if (step) { e.preventDefault(); select(active + step); }
    else if (e.key === "Home") { e.preventDefault(); select(0); }
    else if (e.key === "End") { e.preventDefault(); select(tabs.length - 1); }
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="rh-tabs" onKeyDown={onKey}>
        {tabs.map((tab, i) => (
          <button key={tab.key} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${base}-tab-${tab.key}`}
            aria-selected={i === active} aria-controls={`${base}-panel-${tab.key}`} tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)} className="rh-tab">
            <FigmaIcon name={tab.icon} className="size-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => {
        const items = tab.openOnly ? tab.items.filter((item) => openIds?.has(item.id)) : tab.items;
        return (
          <div key={tab.key} role="tabpanel" id={`${base}-panel-${tab.key}`} aria-labelledby={`${base}-tab-${tab.key}`} hidden={i !== active} className="rh-tabpanel">
            {items.length > 0
              ? <ul className="rh-bizgrid">{items.map((item) => <li key={item.id} className="rh-bizcell">{item.node}</li>)}</ul>
              : <p className="rh-tab-empty">{emptyLabel}</p>}
          </div>
        );
      })}
    </div>
  );
}
