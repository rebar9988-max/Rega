import project from "@/config/project.json";
import "../globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/vazirmatn";
import type { Metadata } from "next";
import { SITE_ASSETS } from "@/lib/seo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { currentAccount, currentUser } from "@/lib/auth-helpers";
import { can, canEnterDashboard } from "@/lib/rbac";
import { LOCALE_META, type Locale } from "@/i18n/locales";
import { ThemeScript } from "@/components/shell/ThemeScript";
import { DR_NAV, DR_NAV_GROUPS, contentNav } from "@/components/dr/nav";
import { DrSidebar, type DrNavItem } from "@/components/dr/DrSidebar";
import { PRIVATE_BETA } from "@/lib/private-beta";
import { SessionRenewal } from "@/features/auth/SessionRenewal";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { metadataBase: new URL(`https://${process.env.CANONICAL_HOST || project.canonicalHost}`), icons: SITE_ASSETS.icons, title: { default: "REGA24", template: "%s · REGA24" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DrLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const meta = LOCALE_META[locale];
  const [messages, t, tn, ta, user] = await Promise.all([getMessages(), getTranslations("dashboard"), getTranslations("nav"), getTranslations("drAdmin"), currentAccount().catch(() => null)]);
  const signedIn = user ?? (await currentUser().catch(() => null));
  // Signed out: sign in here, with a code to the address on the account. /owner-login keeps its
  // password form, so an e-mail outage never locks the dashboard.
  if (!signedIn) {
    return (
      <html lang={meta.htmlLang} dir={meta.dir} suppressHydrationWarning>
        <head><ThemeScript /></head>
        <body className="min-h-dvh"><SignInForm passwordHref={PRIVATE_BETA ? "/owner-login?next=%2Fadmin" : `/${locale}/login?next=${encodeURIComponent("/admin")}`} /></body>
      </html>
    );
  }
  if (PRIVATE_BETA && user?.role !== "SUPER_ADMIN") redirect("/owner-login?next=%2Fadmin");
  // A revoked account can still have a cached session: it reaches the existing forbidden state below
  // rather than bouncing between /dr and login (login sends an already signed-in session back to /dr).

  return (
    <html lang={meta.htmlLang} dir={meta.dir} suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body className="min-h-dvh">
        <SessionRenewal />
        <NextIntlClientProvider messages={messages}>
          {!user || !canEnterDashboard(user.role) ? (
            <main className="container-page py-24 text-center">
              <h1 className="mb-3 text-2xl font-extrabold">{t("title")}</h1>
              <p className="text-muted">{t("forbidden")}</p>
              <Link href={`/${locale}`} className="mt-6 inline-block font-semibold text-brand hover:underline">{t("back")}</Link>
            </main>
          ) : (
            <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
              <DrSidebar
                items={[
                  ...DR_NAV.filter((i) => can(user.role, i.permission) && !(user.role === "BUSINESS_OWNER" && i.href === "/admin"))
                    .map((i): DrNavItem => ({ href: i.href, label: t(i.key), icon: i.icon, group: i.group })),
                  ...contentNav().filter((i) => can(user.role, i.permission))
                    .map((i): DrNavItem => ({ href: i.href, label: tn(i.key), icon: "content", group: "content" })),
                ]}
                groups={DR_NAV_GROUPS.map((g): [string, string] => [g, ta(`group_${g}`)])}
                email={user.email}
                labels={{ nav: t("title"), menu: ta("menu"), close: ta("closeMenu"), signedIn: t("signed"), site: t("back") }}
                siteHref={`/${locale}`}
              />
              <main className="mx-auto w-full min-w-0 max-w-[90rem] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
            </div>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
