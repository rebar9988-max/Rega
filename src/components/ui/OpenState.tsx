"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { openStatus, type OpenStatusResult } from "@/lib/geo";
import { Chip } from "@/components/ui/Badge";

/**
 * "Open" / "Closing soon" / "Opens soon" / "Closed" right now, with the next closing or opening time, computed in the
 * browser in the location's own timezone, so a cached page never shows a stale state. Renders nothing until mounted,
 * and nothing when the hours are unknown.
 */
export function OpenState({ hours, countryCode, className = "mt-3" }: { hours: unknown; countryCode: string; className?: string }) {
  const t = useTranslations("nearby");
  const tDays = useTranslations("days");
  const [state, setState] = useState<OpenStatusResult | null>(null);
  useEffect(() => {
    const update = () => setState(openStatus(hours, countryCode));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours, countryCode]);
  if (!state || state.status === "HOURS_UNKNOWN") return null;
  const open = state.status === "OPEN" || state.status === "CLOSING_SOON";
  const label = { OPEN: t("open"), CLOSING_SOON: t("closingSoon"), OPENS_SOON: t("opensSoon"), CLOSED: t("closed") }[state.status];
  const next = state.next;
  // Times are stored as 24-hour "HH:MM"; kept left-to-right inside RTL text.
  const time = next ? `\u2066${next.time}\u2069` : "";
  // The next opening is later today when the wait does not reach back past local midnight.
  const today = next ? Number(next.time.slice(0, 2)) * 60 + Number(next.time.slice(3)) - next.inMinutes >= 0 : false;
  const detail = !next ? null : open ? t("closesAt", { time }) : today ? t("opensAt", { time }) : t("opensOn", { day: tDays(next.day), time });
  return (
    <p className={className} data-testid="open-state" data-status={state.status}>
      <Chip>{detail ? <>{label} · {detail}</> : label}</Chip>
    </p>
  );
}
