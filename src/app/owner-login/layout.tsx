import "../globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/vazirmatn";
import type { Metadata } from "next";
import { ThemeScript } from "@/components/shell/ThemeScript";

export const metadata: Metadata = {
  title: "REGA Owner Login",
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
