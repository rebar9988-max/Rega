import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type Props = { page: number; pages: number; pathname: string; params: Record<string, string | undefined> };

function href(pathname: string, params: Props["params"], page: number) {
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v) query[k] = v;
  if (page > 1) query.page = String(page);
  return { pathname, query };
}

/** Plain links: crawlable, works without JS, keeps all active filters. */
export function Pagination({ page, pages, pathname, params }: Props) {
  const t = useTranslations("common");
  if (pages <= 1) return null;
  const cls = "inline-flex min-h-11 items-center gap-1 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2";
  return (
    <nav aria-label={t("page")} className="mt-10 flex items-center justify-between gap-3">
      {page > 1 ? <Link rel="prev" href={href(pathname, params, page - 1)} className={cls}><span aria-hidden="true" className="rtl-flip">‹</span>{t("previous")}</Link> : <span />}
      <span className="text-sm text-muted">{t("page")} {page} {t("of")} {pages}</span>
      {page < pages ? <Link rel="next" href={href(pathname, params, page + 1)} className={cls}>{t("next")}<span aria-hidden="true" className="rtl-flip">›</span></Link> : <span />}
    </nav>
  );
}
