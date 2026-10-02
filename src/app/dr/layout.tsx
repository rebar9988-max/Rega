import "../globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/vazirmatn";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth-helpers";
import { can, isStaff } from "@/lib/rbac";
import { LOCALE_META, type Locale } from "@/i18n/locales";
import { Logo } from "@/components/ui/Logo";
import { ThemeScript } from "@/components/shell/ThemeScript";
import { DR_NAV } from "@/components/dr/nav";

export const metadata: Metadata = { metadataBase: new URL(`https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`), title: { default: "REGA Platform", template: "%s · REGA Platform" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DrLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const meta = LOCALE_META[locale];
  const [messages, t, user] = await Promise.all([getMessages(), getTranslations("dashboard"), currentUser().catch(() => null)]);
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent("/dr")}`);

  return (
    <html lang={meta.htmlLang} dir={meta.dir} suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body className="min-h-dvh">
        <NextIntlClientProvider messages={messages}>
          {!isStaff(user.role) ? (
            <main className="container-page py-24 text-center">
              <h1 className="mb-3 text-2xl font-extrabold">{t("title")}</h1>
              <p className="text-muted">{t("forbidden")}</p>
              <Link href={`/${locale}`} className="mt-6 inline-block font-semibold text-brand hover:underline">{t("back")}</Link>
            </main>
          ) : (
            <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
              <aside className="border-b border-line bg-surface md:border-b-0 md:border-e">
                <div className="flex items-center justify-between gap-4 p-4 md:block">
                  <Logo />
                  <p className="text-xs text-muted md:mt-4">{t("signed")}<br /><bdi dir="ltr" className="break-all font-semibold text-ink">{user.email}</bdi></p>
                </div>
                <nav aria-label={t("title")} className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
                  {DR_NAV.filter((i) => can(user.role, i.permission)).map((i) => (
                    <Link key={i.href} href={i.href} className="flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold hover:bg-surface-2">{t(i.key)}</Link>
                  ))}
                  <Link href={`/${locale}`} className="flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm text-muted hover:bg-surface-2">{t("back")}</Link>
                </nav>
              </aside>
              <main className="min-w-0 p-4 sm:p-8">{children}</main>
            </div>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
