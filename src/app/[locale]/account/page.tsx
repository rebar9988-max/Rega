import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import type { Locale } from "@/i18n/locales";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { Ltr } from "@/components/ui/Bidi";
import NextLink from "next/link";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { emailEnabled } from "@/lib/email";
import { atLeast, canEnterDashboard } from "@/lib/rbac";
import { ResendVerification } from "@/features/auth/AuthForms";
import { OwnerBusinesses } from "@/features/account/OwnerBusinesses";
import { DrIcon } from "@/components/dr/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/account", title: t("auth.accountTitle"), description: await pageDescription(locale as Locale, "account"), noindex: true });
}

type Tab = "business" | "profile" | "security";
const NOTICES = ["hidden", "shown", "restoredPending", "restoredDraft", "denied", "deleted", "unchanged"] as const;

/** Small line icons for the account navigation (the dashboard icon set has no person / shield / key / document). */
const PATHS = {
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  security: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  key: "M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5",
} as const;
function Icon({ name, className = "size-5" }: { name: keyof typeof PATHS; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={PATHS[name]} /></svg>;
}

const row = "flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand";
const rowIcon = "grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink";

export default async function AccountPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; visibility?: string; item?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth().catch(() => null);
  if (!session?.user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);
  const t = await getTranslations();
  const sp = await searchParams;
  const u = session.user;
  const owner = u.role === "BUSINESS_OWNER";
  const row0 = await prisma.user.findFirst({ where: { id: u.id, deletedAt: null }, select: { emailVerified: true } }).catch(() => null);
  const unverified = row0 !== null && row0.emailVerified === null && !atLeast(u.role, "EMPLOYEE");

  // One feature, one place: owners land on their businesses; everyone has profile and security.
  const tabs: Tab[] = owner ? ["business", "profile", "security"] : ["profile", "security"];
  const tab: Tab = tabs.find((x) => x === sp.tab) ?? tabs[0];
  const tabLabel: Record<Tab, string> = { business: t("auth.myListings"), profile: t("auth.profile"), security: t("auth.tabSecurity") };
  const notice = owner && tab === "business" ? NOTICES.find((n) => n === sp.visibility) : undefined;
  const initial = Array.from((u.name ?? u.email ?? "•").trim())[0]?.toUpperCase() ?? "•";

  async function logout() {
    "use server";
    await signOut({ redirectTo: `/${locale}` });
  }

  return (
    <div className="container-page max-w-4xl pb-12 pt-6 sm:pt-8">
      <header className="flex items-center gap-4 rounded-[20px] bg-[linear-gradient(135deg,var(--brand-deep),var(--brand))] p-5 text-white shadow-card sm:p-6">
        <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-white text-2xl font-extrabold text-brand-text sm:size-16">{initial}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("auth.accountTitle")}</h1>
          <p className="mt-1 truncate text-sm font-medium">{u.name ? <>{u.name} · </> : null}{t(`roles.${u.role}`)}</p>
          <p className="truncate text-sm"><Ltr>{u.email}</Ltr></p>
        </div>
      </header>

      <nav aria-label={t("auth.accountTitle")} className="mt-4 rounded-2xl border border-line bg-surface p-1" data-testid="account-tabs">
        <ul className={`grid gap-1 ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {tabs.map((x) => (
            <li key={x}>
              <NextLink href={`/${locale}/account?tab=${x}`} aria-current={x === tab ? "page" : undefined} data-testid={`tab-${x}`}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-row sm:gap-2 sm:text-sm ${x === tab ? "bg-brand text-brand-ink shadow-card" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
                {x === "business" ? <DrIcon name="businesses" className="size-[18px]" /> : <Icon name={x} className="size-[18px]" />}
                <span>{tabLabel[x]}</span>
              </NextLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5">
        {notice && (
          <p role={notice === "denied" ? "alert" : "status"} data-testid="account-notice" data-notice={notice}
            className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${notice === "denied" ? "border-brand/30 bg-brand-soft text-ink" : "border-[oklch(0.62_0.15_150)]/30 bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]"}`}>
            <DrIcon name={notice === "denied" ? "alert" : "check"} className="size-[18px] shrink-0" />
            {notice === "deleted" ? t("auth.deletedNotice") : notice === "unchanged" ? t("drAdmin.notice_unchanged") : t(`businessVisibility.notice_${notice}`)}
          </p>
        )}

        {tab === "business" && <OwnerBusinesses user={u} locale={locale as Locale} />}

        {tab === "profile" && (
          <section aria-labelledby="profile" className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="profile" className="text-lg font-bold">{t("auth.profile")}</h2>
            <dl className="divide-y divide-line text-sm">
              <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted">{t("auth.name")}</dt><dd className="font-semibold">{u.name ?? "—"}</dd></div>
              <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted">{t("auth.email")}</dt><dd className="min-w-0 break-all font-semibold"><Ltr>{u.email}</Ltr></dd></div>
              <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted">{t("auth.role")}</dt><dd className="font-semibold">{t(`roles.${u.role}`)}</dd></div>
            </dl>
            {canEnterDashboard(u.role) && !owner && <NextLink href="/dr" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold hover:bg-surface-2">{t("nav.dashboard")}</NextLink>}
          </section>
        )}

        {tab === "security" && (
          <section aria-labelledby="security" className="space-y-4">
            <h2 id="security" className="sr-only">{t("auth.tabSecurity")}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              <li className="flex min-h-16 items-center gap-3 px-4 py-3" data-testid="email-status">
                <span className={rowIcon}>{unverified ? <DrIcon name="alert" className="size-5 text-brand-text" /> : <DrIcon name="check" className="size-5 text-[oklch(0.45_0.12_150)]" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{unverified ? t("auth.unverified") : t("auth.verified")}</p>
                  <p className="truncate text-sm text-muted"><Ltr>{u.email}</Ltr></p>
                </div>
              </li>
              <li><Link href="/forgot-password" className={row}>
                <span className={rowIcon}><Icon name="key" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{t("auth.changePassword")}</span><span className="block text-sm text-muted">{t("auth.changePasswordHint")}</span></span>
                <DrIcon name="chevron" className="size-4 text-muted rtl:rotate-180" />
              </Link></li>
              <li><Link href="/privacy" className={row}>
                <span className={rowIcon}><Icon name="doc" /></span><span className="min-w-0 flex-1 font-semibold">{t("nav.privacy")}</span>
                <DrIcon name="chevron" className="size-4 text-muted rtl:rotate-180" />
              </Link></li>
              <li><Link href="/terms" className={row}>
                <span className={rowIcon}><Icon name="doc" /></span><span className="min-w-0 flex-1 font-semibold">{t("nav.terms")}</span>
                <DrIcon name="chevron" className="size-4 text-muted rtl:rotate-180" />
              </Link></li>
            </ul>
            {unverified && <div className="rounded-2xl border border-line bg-surface p-4"><ResendVerification unavailable={!emailEnabled()} /></div>}
            <form action={logout}>
              <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-bold text-brand-text transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <DrIcon name="logout" className="size-[18px]" />{t("auth.signOut")}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
