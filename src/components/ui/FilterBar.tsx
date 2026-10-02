import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/locales";
import { localizeText } from "@/lib/content";

type Option = { id: string; label: string };
type Props = {
  action: string;
  values: { q?: string; category?: string; city?: string; sort?: string; verified?: string };
  categories?: Option[];
  cities?: Option[];
  sorts?: string[];
  verified?: boolean;
  searchLabel: string;
};

const field = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";

/** Server-rendered GET form: filters live in the URL (shareable, crawlable, back-button friendly). */
export async function FilterBar({ action, values, categories, cities, sorts, verified, searchLabel }: Props) {
  const t = await getTranslations();
  const active = Boolean(values.q || values.category || values.city || values.verified);
  return (
    <form action={action} role="search" className="container-page mb-8">
      <div className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="f-q" className="sr-only">{searchLabel}</label>
          <input id="f-q" name="q" type="search" defaultValue={values.q} placeholder={searchLabel} autoComplete="off" className={`${field} w-full`} />
        </div>
        {categories && (
          <div>
            <label htmlFor="f-cat" className="sr-only">{t("services.category")}</label>
            <select id="f-cat" name="category" defaultValue={values.category ?? ""} className={`${field} w-full`}>
              <option value="">{t("list.allCategories")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}
        {cities && (
          <div>
            <label htmlFor="f-city" className="sr-only">{t("locations.city")}</label>
            <select id="f-city" name="city" defaultValue={values.city ?? ""} className={`${field} w-full`}>
              <option value="">{t("list.allCities")}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}
        {sorts && (
          <div>
            <label htmlFor="f-sort" className="sr-only">{t("list.sortBy")}</label>
            <select id="f-sort" name="sort" defaultValue={values.sort ?? sorts[0]} className={`${field} w-full`}>
              {sorts.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("list.apply")}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        {verified && (
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2">
            <input type="checkbox" name="verified" value="1" defaultChecked={values.verified === "1"} className="size-4 accent-[var(--brand)]" />
            {t("list.verifiedOnly")}
          </label>
        )}
        {active && <Link href={action} className="text-brand hover:underline">{t("list.reset")}</Link>}
      </div>
    </form>
  );
}

/** Helpers to turn taxonomy rows into localized <option>s. */
export async function categoryOptions<T extends { id: string; parentId: string | null }>(rows: T[]): Promise<Option[]> {
  const locale = (await getLocale()) as Locale;
  const byParent = (pid: string | null) => rows.filter((r) => r.parentId === pid);
  const out: Option[] = [];
  const walk = (pid: string | null, depth: number) => {
    for (const r of byParent(pid)) {
      out.push({ id: r.id, label: `${"— ".repeat(depth)}${localizeText(r, "name", locale)}` });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export async function cityOptions<T extends { id: string; nameEn: string }>(rows: T[]): Promise<Option[]> {
  const locale = (await getLocale()) as Locale;
  return rows.map((c) => ({ id: c.id, label: localizeText({ ...c, name: c.nameEn }, "name", locale) }));
}
