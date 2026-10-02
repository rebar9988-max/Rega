import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { mobileNav } from "@/components/shell/nav";

/** 404 inside the shell: a search box and the main sections (from the section registry), so nobody is stranded. */
export default async function NotFound() {
  const t = await getTranslations("errors");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("search");
  const tc = await getTranslations("common");
  return (
    <div className="container-page py-16">
      <EmptyState title={t("notFoundTitle")} body={t("notFoundBody")} action={<ButtonLink href="/">{t("goHome")}</ButtonLink>} />
      <form role="search" action="/search" className="mx-auto mt-8 flex max-w-md gap-2">
        <label htmlFor="nf-q" className="sr-only">{ts("placeholder")}</label>
        <input id="nf-q" name="q" type="search" maxLength={120} placeholder={ts("placeholder")} autoComplete="off" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand" />
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{tc("search")}</button>
      </form>
      <nav aria-label={tn("primary")} className="mx-auto mt-6 max-w-md">
        <ul className="flex flex-wrap justify-center gap-2">
          {mobileNav().map((i) => (
            <li key={i.key}><Link href={i.href} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">{tn(i.key)}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
