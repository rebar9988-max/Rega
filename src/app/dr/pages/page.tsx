import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { fallbackChain, type Locale } from "@/config/locales";

export default async function PagesAdmin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireDr("content.write");
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("cms");
  const ts = await getTranslations("status");
  const pages = await prisma.page.findMany({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], include: { translations: { select: { locale: true, title: true } } } });
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <Link href="/dr/pages/new" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover">+ {t("new")}</Link>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted">{t("intro")}</p>
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(sp.error === "slug" ? "errorSlug" : "errorInvalid")}</p>}
      {pages.length === 0 ? <p className="text-muted">{t("empty")}</p> : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {pages.map((p) => {
            const title = [locale, ...fallbackChain(locale)].map((l) => p.translations.find((x) => x.locale === l)?.title).find(Boolean) ?? p.slug;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span><bdi className="font-semibold">{title}</bdi> <span className="text-xs text-muted" dir="ltr">/p/{p.slug}</span></span>
                <span className="flex items-center gap-3"><span className="text-muted">{ts(p.status as "draft")} · {p.translations.length}</span><Link href={`/dr/pages/${p.id}`} className="font-semibold text-brand hover:underline">{t("edit")}</Link></span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
