import { getLocale, getTranslations } from "next-intl/server";
import { dirOf } from "@/i18n/locales";
import { auth } from "@/auth";
import NextLink from "next/link";
import { Link } from "@/i18n/routing";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { NavLinks } from "./NavLinks";
import { headerNav, mobileNav } from "./nav";

/** Typed "R REGA" wordmark of design frame 204:912 (Inter Black, brand red). */
function Wordmark() {
  return (
    <span className="inline-flex items-center gap-[7px] text-brand" dir="ltr" aria-hidden="true">
      <span className="flex h-[26px] w-[36px] items-center justify-center text-[27px] font-black italic leading-[normal]">R</span>
      <span className="text-[28px] font-black leading-[normal]">REGA</span>
    </span>
  );
}

/**
 * Header of design frame 204:912: wordmark left, primary navigation centred, language / login / call to action right.
 * The chrome keeps one physical layout in every language (dir="ltr"), so the language switcher never changes place;
 * only the TEXT inside follows the page direction (contentDir). The items beside the switcher have fixed widths for
 * the same reason. Below xl the navigation, login and call to action move into the menu sheet (MobileNav).
 */
export async function Header() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const contentDir = dirOf(await getLocale());
  // Auth must never take the public site down: no session (or a misconfigured secret) = signed out.
  const signedIn = Boolean((await auth().catch(() => null))?.user);
  const accountHref = signedIn ? "/account" : "/login";
  // "Add listing": logged out -> the for-business page (benefits, free, register); logged in -> the listing editor.
  const addAdClass = "hidden h-[46px] w-[125px] items-center justify-center whitespace-nowrap rounded-[8px] bg-brand text-[13px] font-bold text-brand-ink transition-colors hover:bg-brand-hover xl:flex";
  return (
    <header className="figma sticky top-0 z-40 border-b border-line bg-surface text-ink">
      <div dir="ltr" className="flex h-[4.5rem] w-full items-center justify-between gap-2 px-4 sm:px-6 xl:h-[94px] xl:px-[34px]">
        <Link href="/" aria-label="REGA Platform" className="shrink-0 rounded-lg"><Wordmark /></Link>
        <nav aria-label={t("primary")} className="hidden h-full xl:block">
          <NavLinks dir={contentDir} items={headerNav()} />
        </nav>
        <div className="flex items-center gap-0.5 sm:gap-1 xl:gap-5">
          <Link href="/search" aria-label={tc("search")} className="grid size-11 place-items-center rounded-xl max-[359px]:hidden hover:bg-brand-soft hover:text-brand xl:hidden">
            <FigmaIcon name="search" className="size-5" />
          </Link>
          <LanguageSwitcher />
          <Link href={accountHref} className="hidden min-h-11 w-[88px] items-center justify-end gap-[6px] whitespace-nowrap text-[12px] font-semibold text-ink hover:text-brand sm:flex">
            <span dir={contentDir}>{signedIn ? t("account") : t("login")}</span>
            <FigmaIcon name="user" className="size-4 shrink-0" />
          </Link>
          {signedIn
            ? <NextLink href="/dr/businesses/new" className={addAdClass}><span dir={contentDir}>{t("addAd")}</span></NextLink>
            : <Link href="/for-business" className={addAdClass}><span dir={contentDir}>{t("addAd")}</span></Link>}
          <span className="xl:hidden"><ThemeToggle label={tc("toggleTheme")} /></span>
          <MobileNav items={mobileNav()} />
        </div>
      </div>
    </header>
  );
}
