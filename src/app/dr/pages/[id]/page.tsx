import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { PageForm } from "../PageForm";

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireDr("content.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations("cms");
  const locale = await getLocale();
  const page = await prisma.page.findUnique({ where: { id }, include: { translations: true } });
  if (!page) notFound();
  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/pages" className="text-muted hover:text-ink">{t("title")}</Link></nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("edit")}: <bdi dir="ltr">/p/{page.slug}</bdi></h1>
        {page.status === "published" && <Link href={`/${locale}/p/${page.slug}`} className="text-sm font-semibold text-brand hover:underline">{t("view")}</Link>}
      </div>
      {sp.saved && <p role="status" className="mb-4 rounded-xl bg-[oklch(0.95_0.05_150)] px-4 py-3 text-sm font-semibold text-[oklch(0.35_0.1_150)]">{t("saved")}</p>}
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t("errorSlug")}</p>}
      <PageForm initial={{ id: page.id, slug: page.slug, status: page.status, sortOrder: page.sortOrder, translations: Object.fromEntries(page.translations.map((x) => [x.locale, { title: x.title, body: x.body, metaDescription: x.metaDescription }])) }} />
    </>
  );
}
