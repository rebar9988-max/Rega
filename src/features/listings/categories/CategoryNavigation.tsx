import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getCategories } from "@/lib/data";
import { localizeText } from "@/lib/content";
import { formatNumber, type Locale } from "@/i18n/locales";

/** Route-owned scope; category pages never submit another primary category through a hidden filter. */
export async function CategoryNavigation({
  categoryId, showCounts = true,
}: {
  categoryId?: string; showCounts?: boolean;
}) {
  const categories = await getCategories(),
    locale = (await getLocale()) as Locale,
    t = await getTranslations();
  const current = categories.find((c) => c.id === categoryId);
  const parent = current?.parentId
    ? categories.find((c) => c.id === current.parentId)
    : undefined;
  const children = current
    ? categories.filter((c) => c.parentId === current.id)
    : categories.filter((c) => !c.parentId);
  const choices = children.length
    ? children
    : categories.filter((c) => c.parentId === (current?.parentId ?? null));
  return (
    <nav
      aria-label={t("services.category")}
      data-testid="category-navigation"
      className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-3 sm:p-4"
    >
      <ul className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <li className="shrink-0">
          <Link
            href="/businesses"
            aria-current={!current ? "page" : undefined}
            className={`inline-flex min-h-12 items-center rounded-xl border px-3 text-sm font-semibold ${!current ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}
          >
            {t("list.allCategories")}
          </Link>
        </li>
        {parent && (
          <li className="shrink-0">
            <Link
              href={`/businesses/${parent.slug}`}
              className="inline-flex min-h-12 items-center rounded-xl border border-line px-3 text-sm font-semibold"
            >
              {localizeText({ ...parent, name: parent.nameDe }, "name", locale)}
            </Link>
          </li>
        )}
        {choices.map((c) => (
          <li key={c.id} className="shrink-0">
            <Link
              href={`/businesses/${c.slug}`}
              aria-current={current?.id === c.id ? "page" : undefined}
              className={`inline-flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${current?.id === c.id ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand hover:text-brand"}`}
            >
              {localizeText({ ...c, name: c.nameDe }, "name", locale)}
              {showCounts && <span className="rounded-lg bg-surface-2 px-1.5 text-xs text-muted">
                {formatNumber(c.count, locale)}
              </span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
