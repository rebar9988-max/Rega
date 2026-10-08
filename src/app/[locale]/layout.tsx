import "../globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/vazirmatn";
import type { Metadata, Viewport } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";
import { BottomNav } from "@/components/shell/BottomNav";
import { ThemeScript } from "@/components/shell/ThemeScript";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import { LOCALES, LOCALE_META, isLocale } from "@/i18n/locales";
import { JsonLd } from "@/components/ui/JsonLd";
import { BRAND_NAME, SITE_ASSETS, organizationJsonLd } from "@/lib/seo";
import { currentUser } from "@/lib/auth-helpers";
import { PRIVATE_BETA } from "@/lib/private-beta";

/** Arabic-script face of design frame 204:912 (header + home page, via `.figma`). Self-hosted by next/font at build
 *  time: no request to Google at runtime, CSP unchanged. Not preloaded: the browser fetches it only for Arabic-script
 *  glyphs (unicode-range), so LTR pages never download it. */
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-noto-arabic", display: "swap", preload: false });

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const dynamic = "force-dynamic";

const PRIVATE_BETA_COPY: Record<string, { title: string; body: string; status: string }> = {
  ckb: { title: "ڕێگا لە ژێر کاردایە", body: "ئێستا پلاتفۆرمی REGA لە قۆناغی Private Beta ـدایە. کاتێک تەواو و ئامادە بوو، بۆ هەمووان دەکرێتەوە.", status: "Private Beta" },
  kmr: { title: "REGA hîn tê amadekirin", body: "Platforma REGA niha di qonaxa Private Beta de ye. Dema ku temam û amade bibe, dê ji bo hemûyan were vekirin.", status: "Private Beta" },
  de: { title: "REGA wird gerade fertiggestellt", body: "Die REGA-Plattform befindet sich derzeit in einer privaten Beta-Phase. Sobald alles fertig und geprüft ist, wird sie öffentlich geöffnet.", status: "Private Beta" },
  en: { title: "REGA is being prepared", body: "The REGA platform is currently in private beta. It will open publicly once the remaining work is complete and verified.", status: "Private Beta" },
  ar: { title: "منصة REGA قيد التجهيز", body: "منصة REGA حالياً في مرحلة تجريبية خاصة. سيتم فتحها للجميع بعد اكتمال العمل والتحقق منه.", status: "Private Beta" },
  tr: { title: "REGA hazırlanıyor", body: "REGA platformu şu anda özel beta aşamasındadır. Kalan çalışmalar tamamlanıp doğrulandıktan sonra herkese açılacaktır.", status: "Private Beta" },
  fa: { title: "REGA در حال آماده‌سازی است", body: "پلتفرم REGA اکنون در مرحله بتای خصوصی است. پس از تکمیل و بررسی نهایی، برای عموم باز خواهد شد.", status: "Private Beta" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const base = process.env.CANONICAL_HOST || "www.regaplatform.com";
  return {
    metadataBase: new URL(`https://${base}`),
    title: { default: t("title"), template: `%s · ${BRAND_NAME}` },
    description: t("description"),
    // Canonical/hreflang are set per page (pageMetadata): a layout-level canonical would be inherited by every page.
    icons: SITE_ASSETS.icons,
    manifest: SITE_ASSETS.manifest,
    openGraph: { siteName: BRAND_NAME, title: t("title"), description: t("description"), locale: LOCALE_META[locale].htmlLang.replace("-", "_"), type: "website", images: [SITE_ASSETS.ogImage] },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: [SITE_ASSETS.ogImage.url] },
    formatDetection: { telephone: false },
    robots: PRIVATE_BETA ? { index: false, follow: false } : undefined,
  };
}

/**
 * Namespaces used only by the management dashboard (/dr has its own layout with the full catalogue). They are left
 * out of the public pages' client payload: about 40% of the catalogue, serialized into every public HTML response.
 * Server components are unaffected (they read translations on the server).
 */
const DASHBOARD_ONLY = new Set(["dashboard", "bizForm", "svcForm", "catForm", "users", "team"]);
function publicMessages(messages: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(messages).filter(([ns]) => !DASHBOARD_ONLY.has(ns)));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const meta = LOCALE_META[locale];

  if (PRIVATE_BETA) {
    const user = await currentUser().catch(() => null);
    if (user?.role !== "SUPER_ADMIN") {
      const copy = PRIVATE_BETA_COPY[locale] ?? PRIVATE_BETA_COPY.en;
      return (
        <html lang={meta.htmlLang} dir={meta.dir} className={notoArabic.variable} suppressHydrationWarning>
          <head><ThemeScript /></head>
          <body className="min-h-dvh bg-surface-2 text-ink">
            <main className="grid min-h-dvh place-items-center px-5 py-12">
              <section className="w-full max-w-xl rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center shadow-card sm:p-12">
                <p dir="ltr" className="text-4xl font-black tracking-tight text-brand">REGA</p>
                <p className="mt-3 inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">{copy.status}</p>
                <h1 className="mt-6 text-2xl font-extrabold sm:text-3xl">{copy.title}</h1>
                <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">{copy.body}</p>
              </section>
            </main>
          </body>
        </html>
      );
    }
  }

  const [messages, t] = await Promise.all([getMessages(), getTranslations({ locale, namespace: "common" })]);
  const tm = await getTranslations({ locale, namespace: "meta" });

  return (
    <html lang={meta.htmlLang} dir={meta.dir} className={notoArabic.variable} suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50">
          {t("skipToContent")}
        </a>
        <JsonLd data={organizationJsonLd(locale, tm("description"))} />
        <NextIntlClientProvider messages={publicMessages(messages)}>
          <Header />
          <main id="main" className="flex-1">{children}</main>
          <Footer />
          <BottomNav />
        </NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
