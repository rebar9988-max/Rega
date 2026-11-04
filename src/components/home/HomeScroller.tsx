"use client";

import { useRef, type ReactNode } from "react";
import { FigmaIcon } from "@/components/home/FigmaIcon";

/**
 * Horizontal row of the reference's "Explore by category": native scrolling and snap (touch, trackpad, keyboard via
 * the links), plus the round "next" button on wider screens. The button scrolls in the reading direction.
 */
export function HomeScroller({ children, nextLabel, className = "" }: { children: ReactNode; nextLabel: string; className?: string }) {
  const row = useRef<HTMLDivElement>(null);
  const next = () => {
    const el = row.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 4;
    if (atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <div className={`rh-scroller ${className}`}>
      <div ref={row} className="rh-scroll-row">{children}</div>
      <button type="button" onClick={next} aria-label={nextLabel} className="rh-scroll-next">
        <FigmaIcon name="chevron-right" className="rtl-flip size-6" />
      </button>
    </div>
  );
}
