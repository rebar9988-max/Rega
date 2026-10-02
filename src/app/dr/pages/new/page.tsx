import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { PageForm } from "../PageForm";

export default async function NewPage() {
  await requireDr("content.write");
  const t = await getTranslations("cms");
  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/pages" className="text-muted hover:text-ink">{t("title")}</Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{t("new")}</h1>
      <PageForm initial={{}} />
    </>
  );
}
