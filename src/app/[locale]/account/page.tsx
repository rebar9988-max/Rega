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
import { canEnterDashboard } from "@/lib/rbac";
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
  const unverified = row !== null && row.emailVerified === null && emailEnabled();

  async function logout() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  return (
    <>
      <PageHeader title={t("auth.accountTitle")} />
      <div className="container-page">
        <section aria-labelledby="profile" className="mx-auto max-w-md space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card">
          <h2 id="profile" className="text-lg font-bold">{t("auth.profile")}</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted">{t("auth.name")}</dt><dd className="font-semibold">{u.name ?? "—"}</dd></div>
            <div><dt className="text-muted">{t("auth.email")}</dt><dd className="font-semibold"><Ltr>{u.email}</Ltr></dd></div>
            <div><dt className="text-muted">{t("auth.role")}</dt><dd className="font-semibold">{t(`roles.${u.role}`)}</dd></div>
          </dl>
          {unverified && <ResendVerification />}
          {u.role === "BUSINESS_OWNER" && <NextLink href="/dr/businesses" className="flex min-h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("auth.myListings")}</NextLink>}
          {canEnterDashboard(u.role) && u.role !== "BUSINESS_OWNER" && <NextLink href="/dr" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold hover:bg-surface-2">{t("nav.dashboard")}</NextLink>}
          <form action={logout}><button type="submit" className="min-h-11 w-full rounded-xl border border-line text-sm font-semibold hover:bg-surface-2">{t("auth.signOut")}</button></form>
        </section>
      </div>
    </>
  );
}
