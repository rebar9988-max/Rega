import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/rbac";
import { formatNumber, type Locale } from "@/i18n/locales";

/** Metadata browser only: preserve bytes and existing upload/ownership workflows; no destructive bulk controls. */
export default async function MediaOffice({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireDr("media.read");
  const locale = await getLocale() as Locale;
  const t = await getTranslations("controlCenter");
  const sp = await searchParams;
  const page = Math.min(500, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const where = { deletedAt: null, ...(!isStaff(actor.role) ? { uploadedById: actor.id } : {}) };
  const [total, rows] = await Promise.all([prisma.media.count({ where }), prisma.media.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 30, take: 30, select: { id: true, mimeType: true, sizeBytes: true, width: true, height: true, createdAt: true,
      business: { select: { id: true, name: true } } } })]);
  return <>
    <h1 className="mb-2 text-2xl font-extrabold">{t("media")}</h1>
    <p className="mb-5 text-muted">{t("mediaHint")}</p>
    <p className="mb-4 font-semibold">{t("total")}: {formatNumber(total, locale)}</p>
    {rows.length ? <ul className="grid gap-3 sm:grid-cols-2">{rows.map(row => <li key={row.id} className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <p className="font-semibold"><bdi>{row.mimeType}</bdi> · {formatNumber(row.sizeBytes, locale)} B</p>
      {row.width && row.height ? <p className="text-sm text-muted"><bdi>{row.width} × {row.height}</bdi></p> : null}
      {row.business ? <Link href={`/admin/businesses/${row.business.id}`} className="inline-flex min-h-11 items-center break-words font-semibold text-brand underline">{row.business.name}</Link> : <p className="text-sm text-muted">{t("unassigned")}</p>}
      <time dateTime={row.createdAt.toISOString()} className="block text-sm text-muted">{row.createdAt.toISOString().slice(0, 10)}</time>
    </li>)}</ul> : <p className="text-muted">{t("emptyMedia")}</p>}
    <nav aria-label={t("pagination")} className="mt-5 flex gap-4">
      {page > 1 && <Link href={`/admin/media?page=${page - 1}`} className="inline-flex min-h-11 items-center font-semibold text-brand underline">{t("previous")}</Link>}
      {page * 30 < total && <Link href={`/admin/media?page=${page + 1}`} className="inline-flex min-h-11 items-center font-semibold text-brand underline">{t("next")}</Link>}
    </nav>
  </>;
}
