import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="container-page py-24">
      <EmptyState title={t("notFoundTitle")} body={t("notFoundBody")} action={<ButtonLink href="/">{t("goHome")}</ButtonLink>} />
    </div>
  );
}
