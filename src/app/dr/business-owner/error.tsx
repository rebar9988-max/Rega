"use client";
import { useTranslations } from "next-intl";

export default function BusinessError({ reset }: { reset: () => void }) {
  const t = useTranslations();
  return <div role="alert" className="rega-card mx-auto max-w-md space-y-4 p-6 text-center">
    <p>{t("forms.failed")}</p>
    <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-line px-5 font-semibold hover:bg-surface-2">{t("common.retry")}</button>
  </div>;
}
