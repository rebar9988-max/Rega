import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, type Locale } from "@/config/locales";
import { Stars } from "@/components/ui/Stars";
import { moderateReview } from "./actions";

const STATUSES = ["pending", "approved", "rejected"] as const;

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireDr("review.moderate");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "pending";
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("reviews");
  const ts = await getTranslations("status");
  const rows = await prisma.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, rating: true, comment: true, locale: true, createdAt: true, business: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } } });
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">{t("adminTitle")}</h1>
      <nav aria-label={t("adminTitle")} className="mb-6 flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => <a key={s} href={`/dr/reviews?status=${s}`} aria-current={s === status ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full border px-3 font-semibold ${s === status ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>{ts(s)}</a>)}
      </nav>
      {rows.length === 0 ? <p className="text-muted">{t("adminEmpty")}</p> : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm" data-testid="review-row">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <a href={`/${locale}/business/${r.business.slug}`} className="font-bold hover:underline"><bdi>{r.business.name}</bdi></a>
                <time dateTime={r.createdAt.toISOString()} className="text-xs text-muted">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <p className="mb-1"><Stars value={r.rating} count={1} /></p>
              {r.comment && <p className="mb-2 whitespace-pre-line" dir="auto" lang={r.locale}>{r.comment}</p>}
              <p className="mb-3 text-xs text-muted"><bdi>{r.user?.name ?? "—"}</bdi> · <bdi dir="ltr">{r.user?.email}</bdi></p>
              <div className="flex gap-2">
                {status !== "approved" && <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approved" /><button type="submit" className={btn}>{t("approve")}</button></form>}
                {status !== "rejected" && <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="rejected" /><button type="submit" className={btn}>{t("reject")}</button></form>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
