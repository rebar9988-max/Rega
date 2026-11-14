import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth-helpers";
import { managedBusinessWhere } from "@/lib/business-access";
import { publicVisibility } from "@/lib/business-publication";
import { localize } from "@/lib/content";
import { formatNumber, LOCALE_META, type Locale } from "@/i18n/locales";
import { Text } from "@/components/ui/Bidi";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/dr/StatusPill";
import { ConfirmAction } from "@/components/dr/ConfirmAction";
import { BusinessActionButton } from "@/components/dr/BusinessActionButton";
import { DrIcon } from "@/components/dr/icons";
import { deleteBusiness, updateBusiness } from "@/app/dr/businesses/actions";

const NAME_COLUMNS = { nameDe: true, nameCkb: true, nameKmr: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } as const;
const CITY_COLUMNS = { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true } as const;
/** Essential statuses only, in the order an owner cares about them. */
const SUMMARY = ["published", "pending", "draft", "archived"] as const;
const DOT: Record<string, string> = { published: "bg-[oklch(0.62_0.15_150)]", pending: "bg-sun", draft: "bg-muted/60", archived: "bg-brand/70" };

const base = "inline-flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-11 sm:flex-row sm:gap-1.5 sm:text-sm";
const action = `${base} bg-surface-2 text-ink hover:bg-line`;
const danger = `${base} bg-brand-soft text-brand-text hover:bg-brand/10`;

/**
 * The business owner's dashboard inside their account: their own businesses (membership-scoped), essential statuses and
 * the four everyday actions. Every action reuses the existing dashboard server actions, which re-check role, membership
 * and moderation rules on the server; editing opens the existing business editor.
 */
export async function OwnerBusinesses({ user, locale }: { user: Pick<SessionUser, "id" | "role">; locale: Locale }) {
  const t = await getTranslations();
  const rows = await prisma.business.findMany({
    where: { deletedAt: null, ...managedBusinessWhere(user) },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, status: true, verified: true, featured: true,
      logoUrl: true, archivedAt: true, deletedAt: true,
      category: { select: { sectionKey: true, isActive: true, deletedAt: true, ...NAME_COLUMNS } },
      locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { city: { select: CITY_COLUMNS } } },
    },
  });
  const pageLang = LOCALE_META[locale].htmlLang;
  const named = (row: Record<string, unknown> & { nameDe?: string | null; nameEn?: string | null }) => localize({ ...row, name: row.nameDe ?? row.nameEn }, "name", locale).text;
  const back = `/${locale}/account`;
  const counts = SUMMARY.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((c) => c.n > 0);
  const statusLabel = (s: string) => (s === "archived" ? t("businessVisibility.hidden") : t(`status.${s}`));

  return (
    <section aria-labelledby="my-businesses" className="space-y-4" data-testid="owner-businesses">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="my-businesses" className="text-xl font-extrabold text-ink">{t("auth.myListings")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("auth.businessCount", { count: formatNumber(rows.length, locale) })}</p>
        </div>
        <NextLink href="/dr/businesses/new" data-testid="add-business"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink shadow-card transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <DrIcon name="plus" className="size-[18px]" />{t("auth.addListing")}
        </NextLink>
      </div>

      {counts.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="status-summary">
          {counts.map(({ s, n }) => (
            <div key={s} className="rounded-xl border border-line bg-surface px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted"><span aria-hidden="true" className={`size-2 rounded-full ${DOT[s]}`} />{statusLabel(s)}</dt>
              <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-ink">{formatNumber(n, locale)}</dd>
            </div>
          ))}
        </dl>
      )}

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center" data-testid="owner-empty">
          <span aria-hidden="true" className="mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-brand-text"><DrIcon name="businesses" className="size-6" /></span>
          <p className="font-semibold text-ink">{t("auth.noBusinesses")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{t("auth.noBusinessesHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((b) => {
            const vis = publicVisibility(b);
            const hidden = b.status === "archived";
            const city = b.locations[0]?.city;
            const meta = [b.category ? named(b.category) : null, city ? localize({ ...city, name: city.nameEn }, "name", locale).text : null].filter(Boolean).join(" · ");
            return (
              <li key={b.id} data-testid="owner-business" data-status={b.status} className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={b.name} src={b.logoUrl} size="size-14" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="flex min-w-0 items-center gap-1.5">
                      {b.featured && <span className="text-brand-text"><DrIcon name="pin" className="size-4" /><span className="sr-only">{t("drAdmin.pinned")}</span></span>}
                      <span className="truncate text-base font-bold text-ink"><Text value={localize(b, "name", locale)} pageLang={pageLang} /></span>
                    </p>
                    {meta && <p className="truncate text-sm text-muted">{meta}</p>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill status={b.status} label={statusLabel(b.status)} testId="owner-status" />
                      {b.status === "published" && vis === "notPublic" && <span className="text-xs font-semibold text-brand-text">{t("businessVisibility.notPublic")}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-line pt-3.5">
                  <NextLink href={`/dr/businesses/${b.id}`} className={action} data-testid="owner-edit"><DrIcon name="edit" className="size-4 text-muted" />{t("bizForm.edit")}</NextLink>
                  {vis === "public" && (
                    <NextLink href={`/${locale}/business/${b.slug}`} className={action} data-testid="owner-view"><DrIcon name="view" className="size-4 text-muted" />{t("auth.view")}</NextLink>
                  )}
                  {hidden ? (
                    <form action={updateBusiness} className="flex flex-1">
                      <input type="hidden" name="id" value={b.id} /><input type="hidden" name="intent" value="restore" /><input type="hidden" name="back" value={back} />
                      <BusinessActionButton className={`${action} w-full`} testId="owner-unhide"><DrIcon name="view" className="size-4 text-muted" />{t("businessVisibility.unhide")}</BusinessActionButton>
                    </form>
                  ) : (
                    <ConfirmAction action={updateBusiness} fields={{ id: b.id, intent: "archive", back }} icon="hide" triggerTestId="owner-hide"
                      trigger={t("businessVisibility.hide")} triggerClassName={action}
                      title={t("drAdmin.hideTitle")} body={<><strong className="font-semibold text-ink"><bdi>{b.name}</bdi></strong> — {t("businessVisibility.confirmHide")}</>}
                      confirmLabel={t("businessVisibility.hide")} cancelLabel={t("common.cancel")} />
                  )}
                  <ConfirmAction action={deleteBusiness} fields={{ id: b.id, back }} icon="trash" tone="danger" triggerTestId="owner-delete"
                    trigger={t("drAdmin.delete")} triggerClassName={danger}
                    title={t("drAdmin.deleteTitle")} body={<><strong className="font-semibold text-ink"><bdi>{b.name}</bdi></strong> — {t("drAdmin.deleteBody")}</>}
                    confirmLabel={t("drAdmin.deleteConfirm")} cancelLabel={t("common.cancel")} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
