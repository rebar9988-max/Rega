import "../globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/vazirmatn";
import type { Metadata } from "next";
import { SITE_ASSETS } from "@/lib/seo";
import { ThemeScript } from "@/components/shell/ThemeScript";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`),
  title: "REGA Owner Login",
  icons: SITE_ASSETS.icons,
  robots: { index: false, follow: false },
};

export default function OwnerLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ckb" dir="rtl" suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body className="min-h-dvh bg-surface-2 text-ink">{children}</body>
    </html>
  );
}
