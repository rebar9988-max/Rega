import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { ReactNode } from "react";

export type Crumb = { label: ReactNode; href?: string };

export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = await getTranslations("common");
  return (
    <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="rtl-flip">›</span>}
            {c.href ? <Link href={c.href} className="hover:text-ink hover:underline">{c.label}</Link> : <span aria-current="page" className="text-ink">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export async function PageHeader({ title, subtitle, crumbs }: { title: ReactNode; subtitle?: ReactNode; crumbs?: Crumb[] }) {
  return (
    <header className="container-page pb-6 pt-9 sm:pt-12">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <h1 className="rega-display text-3xl sm:text-4xl">{title}</h1>
      <span aria-hidden="true" className="mt-4 block h-1 w-10 rounded-full bg-brand" />
      {subtitle && <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">{subtitle}</p>}
    </header>
  );
}
