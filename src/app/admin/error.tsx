"use client";

import { useTranslations } from "next-intl";

export default function DrError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
      <p className="mb-4 font-semibold">{t("dashboard.noPermission")}</p>
      <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-line px-5 text-sm font-semibold hover:bg-surface-2">{t("common.retry")}</button>
    </div>
  );
}
