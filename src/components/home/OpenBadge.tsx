"use client";

import { useEffect, useState } from "react";
import { openStatus } from "@/lib/geo";

/** True when the stored hours say the place is open right now (in its own timezone); null until mounted or unknown. */
export function useOpenNow(hours: unknown, countryCode: string, regionSlug?: string | null) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => {
      const s = openStatus(hours, countryCode, new Date(), undefined, regionSlug).status;
      setOpen(s === "HOURS_UNKNOWN" ? null : s === "OPEN" || s === "CLOSING_SOON");
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours, countryCode, regionSlug]);
  return open;
}

/**
 * Green "Open now" pill of the reference card. Computed in the browser from the stored hours, so a cached page never
 * shows a stale state; renders nothing while closed, unknown or before hydration (never a guessed status).
 */
export function OpenBadge({ hours, countryCode, regionSlug, label, className = "rh-open" }: { hours: unknown; countryCode: string; regionSlug?: string | null; label: string; className?: string }) {
  const open = useOpenNow(hours, countryCode, regionSlug);
  return open ? <span className={className} data-testid="open-badge">{label}</span> : null;
}
