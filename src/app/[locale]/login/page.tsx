import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/i18n/locales";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { auth, signIn } from "@/auth";
import { allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  return pageMetadata({ locale: locale as Locale, path: "/login", title: t("auth.loginTitle"), description: t("meta.description"), noindex: true });
}

/** Only same-site relative paths may be used as a post-login destination (blocks open redirects). */
function safeNext(value: FormDataEntryValue | string | undefined | null, locale: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : `/${locale}/account`;
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string; next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, next } = await searchParams;
  const t = await getTranslations();
  const session = await auth().catch(() => null);
  if (session?.user) redirect(safeNext(next, locale));

  async function login(formData: FormData) {
    "use server";
    const ip = clientIp(await headers());
    const target = safeNext(formData.get("next"), locale);
    if (!(await allowShared("LOGIN_LIMITER", `login-ip:${ip}`, 30, 15 * 60_000))) redirect(`/${locale}/login?error=rate`);
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
        </form>
      </div>
    </>
  );
}
