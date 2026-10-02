"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  return (
    <div className="container-page py-24">
      <EmptyState title={t("serverTitle")} body={t("serverBody")} action={<Button onClick={reset}>{tc("retry")}</Button>} />
    </div>
  );
}
