"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, type Locale } from "@/config/locales";
import { openStatus, type OpenStatusResult } from "@/lib/geo";
import { Chip } from "@/components/ui/Badge";

/**
 * "Open" / "Closing soon" / "Opens soon" / "Closed" / "Temporarily closed" right now, with the next closing or opening
 * time, today's public holiday and special hours, computed in the browser in the location's own timezone and calendar,
 * so a cached page never shows a stale state. Renders nothing until mounted, and nothing when the hours are unknown.
 */
export function OpenState({ hours, countryCode, regionSlug, className = "mt-3" }: { hours: unknown; countryCode: string; regionSlug?: string | null; className?: string }) {
  const t = useTranslations("nearby");
  const tDays = useTranslations("days");
  const locale = useLocale() as Locale;
  const [state, setState] = useState<OpenStatusResult | null>(null);
  useEffect(() => {
    const update = () => setState(openStatus(hours, countryCode, new Date(), undefined, regionSlug));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours, countryCode, regionSlug]);
  if (!state || state.status === "HOURS_UNKNOWN") return null;
  const open = state.status === "OPEN" || state.status === "CLOSING_SOON";
  const label = { OPEN: t("open"), CLOSING_SOON: t("closingSoon"), OPENS_SOON: t("opensSoon"), CLOSED: t("closed"), TEMPORARILY_CLOSED: t("temporarilyClosed") }[state.status];
  const next = state.next;
  // Times are stored as 24-hour "HH:MM"; kept left-to-right inside RTL text.
  const time = next ? `⁦${next.time}⁩` : "";
  // The next opening is later today when the wait does not reach back past local midnight.
  const today = next ? Number(next.time.slice(0, 2)) * 60 + Number(next.time.slice(3)) - next.inMinutes >= 0 : false;
  const date = next ? formatDate(`${next.date}T00:00:00Z`, locale, { timeZone: "UTC" }) : "";
  const detail = !next ? null
    : open ? t("closesAt", { time })
    : today ? t("opensAt", { time })
    // More than a week away (a long closure): the date says more than a weekday.
    : next.inMinutes > 6 * 1440 ? t("opensOnDate", { date, time })
    : t("opensOn", { day: tDays(next.day), time });
  const notes = [
    state.holiday ? t("holidayToday", { name: state.holiday.names[locale] }) : null,
    state.exception && state.exception.hours !== "closed" ? t("specialHoursToday") : null,
  ].filter(Boolean);
  return (
    <div className={className}>
      <p data-testid="open-state" data-status={state.status}><Chip>{detail ? <>{label} · {detail}</> : label}</Chip></p>
      {(notes.length > 0 || state.exception?.reason) && (
        <p className="mt-1 text-xs text-muted" data-testid="open-state-note">
          {notes.join(" · ")}
          {state.exception?.reason && <>{notes.length > 0 && " · "}<bdi>{state.exception.reason}</bdi></>}
        </p>
      )}
    </div>
  );
}
