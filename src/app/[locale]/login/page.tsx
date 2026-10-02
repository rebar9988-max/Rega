import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import type { Locale } from "@/i18n/locales";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { auth, signIn } from "@/auth";
import { allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/login", title: t("auth.loginTitle"), description: await pageDescription(locale as Locale, "login"), noindex: true });
}

/** Only same-site relative paths may be used as a post-login destination (blocks open redirects). */
function safeNext(value: FormDataEntryValue | string | undefined | null, locale: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : `/${locale}/account`;
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; next?: string; registered?: string; reset?: string; verified?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, next, registered, reset, verified } = await searchParams;
  const banner = registered ? "bannerRegistered" : reset ? "bannerReset" : verified ? "bannerVerified" : null;
  const t = await getTranslations();
  const session = await auth().catch(() => null);
  if (session?.user) redirect(safeNext(next, locale));

  async function login(formData: FormData) {
    "use server";
    const ip = clientIp(await headers());
    const target = safeNext(formData.get("next"), locale);
    if (!(await allowShared("LOGIN_LIMITER", `login-ip:${ip}`, Number(process.env.AUTH_LOGIN_ATTEMPTS ?? 10) * 3, 15 * 60_000))) redirect(`/${locale}/login?error=rate`);
    try {
      await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirect: false });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/${locale}/login?error=1${next ? `&next=${encodeURIComponent(target)}` : ""}`);
      throw e;
    }
    redirect(target);
  }

  const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand";
  return (
    <>
      <PageHeader title={t("auth.loginTitle")} />
      <div className="container-page">
        <form action={login} className="mx-auto max-w-md space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card">
          {banner && !error && <p role="status" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(`auth.${banner}`)}</p>}
          {error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{error === "rate" ? t("auth.tooMany") : t("auth.invalid")}</p>}
          <input type="hidden" name="next" value={next ?? ""} />
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold">{t("auth.email")}</label>
            <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={`${field} text-start`} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold">{t("auth.password")}</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" dir="ltr" className={`${field} text-start`} />
          </div>
          <button type="submit" className="min-h-11 w-full rounded-xl bg-brand text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("auth.signIn")}</button>
          <p className="text-center text-sm"><Link href="/forgot-password" className="font-semibold text-brand underline">{t("auth.forgot")}</Link></p>
          <p className="text-center text-sm text-muted">{t("auth.noAccount")} <Link href="/register" className="font-semibold text-brand underline">{t("auth.createAccount")}</Link></p>
        </form>
      </div>
    </>
  );
}
