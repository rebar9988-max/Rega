import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { LogoMark } from "@/components/ui/Logo";
import { Link } from "@/i18n/routing";
import { isLocale } from "@/config/locales";
import { safeRelativePath } from "@/features/auth/oauth-core";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/auth", title: t("chooseTitle"), description: t("chooseLead"), noindex: true });
}

const primary = "flex min-h-14 w-full items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-brand-ink hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const secondary = "flex min-h-14 w-full items-center justify-center rounded-xl border border-line bg-surface px-4 text-base font-semibold text-ink transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** "Log in or create an account": the two ways in, side by side, for a visitor who has not decided yet. */
export default async function AuthChooserPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  const { next: rawNext } = await searchParams;
  setRequestLocale(locale);
  const next = safeRelativePath(rawNext);
  if ((await auth().catch(() => null))?.user) redirect(next ?? `/${locale}/account`);
  const t = await getTranslations("auth");
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><LogoMark className="size-20" /></div>
        <div className="space-y-3">
          <h1 className="rega-display text-3xl sm:text-4xl">{t("chooseTitle")}</h1>
          <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-brand" />
          <p className="text-sm leading-7 text-muted sm:text-base">{t("chooseLead")}</p>
        </div>
        <div className="space-y-3" data-testid="auth-chooser">
          <Link href={`/login${query}`} className={primary}>{t("chooseLogin")}</Link>
          <Link href={`/register${query}`} className={secondary}>{t("chooseRegister")}</Link>
        </div>
      </div>
    </div>
  );
}
