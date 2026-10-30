import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import type { Locale } from "@/i18n/locales";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { Ltr } from "@/components/ui/Bidi";
import { PageHeader } from "@/components/ui/PageHeader";
import NextLink from "next/link";
import { prisma } from "@/lib/db";
import { emailEnabled } from "@/lib/email";
import { atLeast, canEnterDashboard } from "@/lib/rbac";
import { ResendVerification } from "@/features/auth/AuthForms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/account", title: t("auth.accountTitle"), description: await pageDescription(locale as Locale, "account"), noindex: true });
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth().catch(() => null);
  if (!session?.user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);
  const t = await getTranslations();
  const u = session.user;
  const row = await prisma.user.findFirst({ where: { id: u.id, deletedAt: null }, select: { emailVerified: true } }).catch(() => null);
  const unverified = row !== null && row.emailVerified === null && !atLeast(u.role, "EMPLOYEE");

  async function logout() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  return (
    <>
      <PageHeader title={t("auth.accountTitle")} />
      <div className="container-page">
        {u.role === "BUSINESS_OWNER" && <nav aria-label={t("dashboard.title")} className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <NextLink href="/dr/businesses" className="rega-card flex min-h-[105px] items-center p-5 text-lg font-bold hover:text-brand-text">{t("auth.myListings")}</NextLink>
          <NextLink href="/dr/businesses?status=pending" className="rega-card flex min-h-[105px] items-center p-5 text-lg font-bold hover:text-brand-text">{t("status.pending")}</NextLink>
          <a href="#profile" className="rega-card flex min-h-[105px] items-center p-5 text-lg font-bold hover:text-brand-text">{t("auth.profile")}</a>
          <form action={logout} className="rega-card flex"><button type="submit" className="min-h-[105px] w-full p-5 text-start text-lg font-bold hover:text-brand-text">{t("auth.signOut")}</button></form>
        </nav>}

        <section aria-labelledby="profile" className={`space-y-4 rounded-[14px] border border-line bg-surface p-6 ${u.role === "BUSINESS_OWNER" ? "min-h-[420px]" : "mx-auto max-w-md"}`}>
          <h2 id="profile" className="text-lg font-bold">{t("auth.profile")}</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted">{t("auth.name")}</dt><dd className="font-semibold">{u.name ?? "—"}</dd></div>
            <div><dt className="text-muted">{t("auth.email")}</dt><dd className="font-semibold"><Ltr>{u.email}</Ltr></dd></div>
            <div><dt className="text-muted">{t("auth.role")}</dt><dd className="font-semibold">{t(`roles.${u.role}`)}</dd></div>
          </dl>
          {unverified && <ResendVerification unavailable={!emailEnabled()} />}
          {canEnterDashboard(u.role) && u.role !== "BUSINESS_OWNER" && <NextLink href="/dr" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold hover:bg-surface-2">{t("nav.dashboard")}</NextLink>}
          {u.role !== "BUSINESS_OWNER" && <form action={logout}><button type="submit" className="min-h-11 w-full rounded-xl border border-line text-sm font-semibold hover:bg-surface-2">{t("auth.signOut")}</button></form>}
        </section>
      </div>
    </>
  );
}
