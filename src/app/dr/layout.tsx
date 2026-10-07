import "../globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/vazirmatn";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth-helpers";
import { can, canEnterDashboard } from "@/lib/rbac";
import { LOCALE_META, type Locale } from "@/i18n/locales";
import { Logo } from "@/components/ui/Logo";
import { ThemeScript } from "@/components/shell/ThemeScript";
import { DR_NAV, contentNav } from "@/components/dr/nav";
import { PRIVATE_BETA } from "@/lib/private-beta";

export const metadata: Metadata = { metadataBase: new URL(`https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`), title: { default: "REGA Platform", template: "%s · REGA Platform" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DrLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const meta = LOCALE_META[locale];
  const [messages, t, tn, user] = await Promise.all([getMessages(), getTranslations("dashboard"), getTranslations("nav"), currentUser().catch(() => null)]);
  if (PRIVATE_BETA && user?.role !== "SUPER_ADMIN") redirect("/owner-login?next=%2Fdr");
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent("/dr")}`);

  return (
    <html lang={meta.htmlLang} dir={meta.dir} suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body className="min-h-dvh">
        <NextIntlClientProvider messages={messages}>
          {!canEnterDashboard(user.role) ? (
            <main className="container-page py-24 text-center">
              <h1 className="mb-3 text-2xl font-extrabold">{t("title")}</h1>
              <p className="text-muted">{t("forbidden")}</p>
              <Link href={`/${locale}`} className="mt-6 inline-block font-semibold text-brand hover:underline">{t("back")}</Link>
            </main>
          ) : (
            <div className="min-h-dvh bg-bg md:grid md:grid-cols-[16rem_1fr]">
              <aside className="border-b border-line bg-surface md:min-h-dvh md:border-b-0 md:border-e">
                <div className="flex items-center justify-between gap-4 border-b border-line p-4 md:block md:p-5">
                  <Logo />
                  <p className="text-xs text-muted md:mt-4">{t("signed")}<br /><bdi dir="ltr" className="break-all font-semibold text-ink">{user.email}</bdi></p>
                </div>
                <nav aria-label={t("title")} className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-col md:px-3 md:py-4">
                  {DR_NAV.filter((i) => can(user.role, i.permission) && !(user.role === "BUSINESS_OWNER" && i.href === "/dr")).map((i) => (
                    <Link key={i.href} href={i.href} className="flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition hover:bg-brand-soft hover:text-brand">{t(i.key)}</Link>
                  ))}
                  {contentNav().filter((i) => can(user.role, i.permission)).map((i) => (
                    <Link key={i.href} href={i.href} className="flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition hover:bg-brand-soft hover:text-brand">{tn(i.key)}</Link>
                  ))}
                  <Link href={`/${locale}`} className="flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm text-muted hover:bg-surface-2">{t("back")}</Link>
                </nav>
              </aside>
              <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
