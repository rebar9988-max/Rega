"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Segmented About / Hours / Reviews selector of the business profile. Every panel is rendered on the server (so the
 * text is in the page for search engines and without JavaScript the first panel shows); only `hidden` changes here.
 * WAI-ARIA tabs pattern with arrow-key, Home and End navigation; the arrows follow the reading direction.
 */
export function ProfileTabs({ tabs, label }: { tabs: { key: string; label: string; panel: ReactNode }[]; label: string }) {
  const base = useId();
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
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
    <div data-testid="business-tabs">
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="grid rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab, i) => (
          <button key={tab.key} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${base}-tab-${tab.key}`}
            aria-selected={i === active} aria-controls={`${base}-panel-${tab.key}`} tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)} data-testid={`business-tab-${tab.key}`}
            className="min-h-11 min-w-0 truncate rounded-xl px-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-selected:bg-surface aria-selected:font-semibold aria-selected:text-brand-text aria-selected:shadow-sm">
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.key} role="tabpanel" id={`${base}-panel-${tab.key}`} aria-labelledby={`${base}-tab-${tab.key}`} hidden={i !== active} tabIndex={0}
          className="mt-3 rounded-2xl border border-line bg-surface p-5 shadow-sm focus-visible:outline-2 focus-visible:outline-brand" data-testid={`business-panel-${tab.key}`}>
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
