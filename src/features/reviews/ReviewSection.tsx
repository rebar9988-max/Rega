import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import { Stars } from "@/components/ui/Stars";
import { isEnabled } from "@/lib/flags";
import { formatDate, LOCALE_META, type Locale } from "@/config/locales";
import { approvedReviews, ownReview } from "./queries";
import { ReviewForm } from "./ReviewForm";

/** Reviews of a business: approved reviews, the form for signed-in users, a sign-in prompt for guests, a report link per review. */
export async function ReviewSection({ businessId, businessSlug }: { businessId: string; businessSlug: string }) {
  if (!(await isEnabled("public.reviews"))) return null;
  const t = await getTranslations("reviews");
  const locale = (await getLocale()) as Locale;
  const session = await auth().catch(() => null);
  const [reviews, own] = await Promise.all([approvedReviews(businessId), session?.user?.id ? ownReview(businessId, session.user.id) : Promise.resolve(null)]);
  const base = `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}/${locale}/business/${businessSlug}`;
  return (
    <section aria-labelledby="reviews" data-testid="reviews">
      <h2 id="reviews" className="mb-3 text-xl font-bold">{t("title")}</h2>
      {reviews.length === 0 ? <p className="mb-4 text-muted">{t("none")}</p> : (
        <ul className="mb-4 space-y-3">
          {reviews.map((r) => (
            <li key={r.id} id={`review-${r.id}`} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm" data-testid="review">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <Stars value={r.rating} count={1} />
                <span className="text-xs text-muted"><bdi>{r.user?.name ?? "—"}</bdi> · {formatDate(r.createdAt, locale)}</span>
              </div>
              {r.comment && <p className="whitespace-pre-line text-pretty" lang={LOCALE_META[(r.locale as Locale) in LOCALE_META ? (r.locale as Locale) : locale].htmlLang} dir="auto">{r.comment}</p>}
              <Link href={{ pathname: "/report", query: { url: `${base}#review-${r.id}` } }} rel="nofollow" className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-muted underline hover:text-ink">{t("report")}</Link>
            </li>
          ))}
        </ul>
      )}
      {session?.user ? <ReviewForm businessId={businessId} initial={own} /> : (
        <p className="text-sm"><Link href={{ pathname: "/login", query: { next: `/${locale}/business/${businessSlug}#reviews` } }} className="font-semibold text-brand underline">{t("signIn")}</Link></p>
      )}
    </section>
  );
}
