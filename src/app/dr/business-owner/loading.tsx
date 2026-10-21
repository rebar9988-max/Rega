import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("common");
  return <p role="status" className="mx-auto max-w-3xl rounded-xl border border-line bg-surface p-6">{t("loading")}</p>;
}
