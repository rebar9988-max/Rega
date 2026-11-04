import { getLocale, getTranslations } from "next-intl/server";
import { dirOf } from "@/i18n/locales";
import { auth } from "@/auth";
import NextLink from "next/link";
import { Link } from "@/i18n/routing";
import { HeaderLogo } from "@/components/ui/Logo";
import { SessionRenewal } from "@/features/auth/SessionRenewal";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { headerNav, mobileNav } from "./nav";

/** Owner banner composition; real controls over a decorative, non-interactive backdrop. */
export async function Header() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const contentDir = dirOf(locale);
  const signedIn = Boolean((await auth().catch(() => null))?.user);
  return (
    <header className="rega-header relative z-40 text-white">
      {signedIn && <SessionRenewal />}
      <div className="rega-header-art" aria-hidden="true" />
      <div dir="ltr" className="rega-header-inner">
        <div className="rega-header-row">
          <Link href="/" aria-label="ڕێگا REGA24" className="rega-header-brand"><HeaderLogo /></Link>
          <div className="rega-header-controls">
            <div className="rega-header-pill">
              <form action={`/${locale}/search`} role="search" aria-label={tc("search")} className="rega-header-search">
                <button type="submit" aria-label={tc("search")}><FigmaIcon name="search" className="size-6" /></button>
                <input name="q" type="search" aria-label={tc("search")} dir={contentDir} maxLength={200} />
              </form>
              <LanguageSwitcher />
            </div>
            <MobileNav items={mobileNav()} signedIn={signedIn} />
          </div>
        </div>
        <div className="rega-header-secondary" dir={contentDir}>
          <nav aria-label={t("primary")}><NavLinks dir={contentDir} items={headerNav()} /></nav>
          <div className="flex shrink-0 items-center gap-4 text-sm font-semibold">
            <Link href={signedIn ? "/account" : "/login"}>{signedIn ? t("account") : t("login")}</Link>
            {signedIn ? <NextLink href="/dr/businesses/new">{t("addAd")}</NextLink> : <Link href="/for-business">{t("addAd")}</Link>}
          </div>
        </div>
      </div>
    </header>
  );
}
