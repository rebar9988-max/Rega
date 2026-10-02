import "../globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/vazirmatn";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";
import { ThemeScript } from "@/components/shell/ThemeScript";
import { LOCALES, LOCALE_META, isLocale } from "@/i18n/locales";
import { JsonLd } from "@/components/ui/JsonLd";
import { BRAND_NAME, organizationJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
  ],
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
    openGraph: { siteName: BRAND_NAME, title: t("title"), description: t("description"), locale: LOCALE_META[locale].htmlLang.replace("-", "_"), type: "website" },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
    formatDetection: { telephone: false },
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
  const [messages, t] = await Promise.all([getMessages(), getTranslations({ locale, namespace: "common" })]);
  const meta = LOCALE_META[locale];
  const tm = await getTranslations({ locale, namespace: "meta" });

  return (
    <html lang={meta.htmlLang} dir={meta.dir} suppressHydrationWarning>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
