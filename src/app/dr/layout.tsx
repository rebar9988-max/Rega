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
import { NotificationBell } from "@/features/admin-notifications/NotificationBell";
import { getAdminNotifications } from "@/features/admin-notifications/sources";
import { visibleKinds } from "@/features/admin-notifications/build";
import { log } from "@/lib/logger";

export const metadata: Metadata = { metadataBase: new URL(`https://${process.env.CANONICAL_HOST || "www.rega24.com"}`), icons: SITE_ASSETS.icons, title: { default: "Rega24", template: "%s · Rega24" }, robots: { index: false, follow: false } };
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
        <body className="min-h-dvh"><SignInForm passwordHref={PRIVATE_BETA ? "/owner-login?next=%2Fdr" : `/${locale}/login?next=${encodeURIComponent("/dr")}`} /></body>
      </html>
    );
  }
  if (PRIVATE_BETA && user?.role !== "SUPER_ADMIN") redirect("/owner-login?next=%2Fdr");
  // A revoked account can still have a cached session: it reaches the existing forbidden state below
  // rather than bouncing between /dr and login (login sends an already signed-in session back to /dr).

  // Work waiting in the existing queues, only the kinds this role may handle; a failed count never breaks the dashboard.
  const showBell = Boolean(user && canEnterDashboard(user.role) && visibleKinds(user.role).length > 0);
  const notifications = showBell
    ? (await getAdminNotifications(user!.role).catch((error: unknown) => { log.error("dr.notifications.failed", { error: String(error) }); return []; }))
      .map((n) => ({ ...n, label: t(`notif_${n.kind}`, { count: n.count }) }))
    : [];

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
              <Link href={`/${locale}`} className="mt-6 inline-block font-semibold text-brand-text hover:underline">{t("back")}</Link>
            </main>
          ) : (
            <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
              <DrSidebar
                items={[
                  ...DR_NAV.filter((i) => can(user.role, i.permission) && !(user.role === "BUSINESS_OWNER" && i.href === "/dr"))
                    .map((i): DrNavItem => ({ href: i.href, label: t(i.key), icon: i.icon, group: i.group })),
                  ...contentNav().filter((i) => can(user.role, i.permission))
                    .map((i): DrNavItem => ({ href: i.href, label: tn(i.key), icon: "content", group: "content" })),
                ]}
                groups={DR_NAV_GROUPS.map((g): [string, string] => [g, ta(`group_${g}`)])}
                email={user.email}
                labels={{ nav: t("title"), menu: ta("menu"), close: ta("closeMenu"), signedIn: t("signed"), site: t("back") }}
                siteHref={`/${locale}`}
              />
              <main className="mx-auto w-full min-w-0 max-w-[90rem] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
                {showBell && (
                  <div className="mb-4 flex justify-end" data-testid="dr-topbar">
                    <NotificationBell items={notifications} labels={{ title: t("notifications"), empty: t("notificationsEmpty") }} />
                  </div>
                )}
                {children}
              </main>
            </div>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
