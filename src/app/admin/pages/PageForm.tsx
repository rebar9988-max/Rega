import { getTranslations } from "next-intl/server";
import { LOCALES, LOCALE_META, localeSuffix } from "@/config/locales";
import { savePageAction } from "./actions";

const input = "min-h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";

export type PageInitial = { id?: string; slug?: string; status?: string; sortOrder?: number; translations?: Record<string, { title: string; body: string; metaDescription: string | null }> };

/** Server-rendered form: one title / body / meta description per configured language (a new language appears automatically). */
export async function PageForm({ initial }: { initial: PageInitial }) {
  const t = await getTranslations("cms");
  const ts = await getTranslations("status");
  return (
    <form action={savePageAction} className="max-w-3xl space-y-6" data-testid="page-form">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("slug")}<input name="slug" required maxLength={80} dir="ltr" defaultValue={initial.slug} placeholder="about-story" className={input} /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("status")}
          <select name="status" defaultValue={initial.status ?? "draft"} className={input}>{(["draft", "published", "archived"] as const).map((s) => <option key={s} value={s}>{ts(s)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("sortOrder")}<input name="sortOrder" type="number" min={0} dir="ltr" defaultValue={initial.sortOrder ?? 0} className={input} /></label>
      </div>
      {LOCALES.map((l) => {
        const tr = initial.translations?.[l];
        const s = localeSuffix(l);
        return (
          <fieldset key={l} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-5" lang={LOCALE_META[l].htmlLang}>
            <legend className="px-1 text-base font-bold">{LOCALE_META[l].nativeName}</legend>
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("titleLabel")}<input name={`title${s}`} maxLength={200} dir={LOCALE_META[l].dir} defaultValue={tr?.title} className={input} /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("bodyLabel")}<textarea name={`body${s}`} rows={8} maxLength={50000} dir={LOCALE_META[l].dir} defaultValue={tr?.body} className={`${input} py-2`} /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("metaLabel")}<input name={`meta${s}`} maxLength={300} dir={LOCALE_META[l].dir} defaultValue={tr?.metaDescription ?? ""} className={input} /></label>
          </fieldset>
        );
      })}
      <p className="text-xs text-muted">{t("bodyHint")}</p>
      <button type="submit" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("save")}</button>
    </form>
  );
}
