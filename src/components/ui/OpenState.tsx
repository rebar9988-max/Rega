"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { isOpenNow } from "@/lib/geo";
import { Chip } from "@/components/ui/Badge";

/**
 * "Open" / "Closed" right now, computed in the browser in the location's own timezone, so a cached page never shows
 * a stale state. Renders nothing until mounted, and nothing when the hours are unknown.
 */
export function OpenState({ hours, countryCode }: { hours: unknown; countryCode: string }) {
  const t = useTranslations("nearby");
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOpen(isOpenNow(hours, countryCode));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours, countryCode]);
  if (open === null) return null;
  return <p className="mt-3" data-testid="open-state"><Chip>{open ? t("open") : t("closed")}</Chip></p>;
}
