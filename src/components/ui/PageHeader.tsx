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
    <header className="container-page pt-10 pb-6">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
      <span aria-hidden="true" className="mt-3 block h-1 w-12 rounded-full bg-brand" />
      {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
    </header>
  );
}
