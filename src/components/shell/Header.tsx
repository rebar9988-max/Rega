import { getLocale, getTranslations } from "next-intl/server";
import { dirOf } from "@/i18n/locales";
import { auth } from "@/auth";
import NextLink from "next/link";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/ui/Logo";
import { SessionRenewal } from "@/features/auth/SessionRenewal";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { headerNav, mobileNav } from "./nav";

/**
 * REGA public header.
 * Visual direction: owner reference v2 (2026-10-30) - deep red chrome in the official logo's own shades, white
 * navigation and the bright logo red for the add-business action; the same bar on phones and desktops.
 * Direction is kept physically stable while localized text follows the page direction.
 */
export async function Header() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const contentDir = dirOf(await getLocale());
  const signedIn = Boolean((await auth().catch(() => null))?.user);
  const accountHref = signedIn ? "/account" : "/login";
  const addClass = "hidden min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-[13px] font-bold text-brand-ink shadow-[0_8px_20px_-8px_var(--brand-glow)] ring-1 ring-white/15 transition hover:bg-brand-hover xl:inline-flex";

  return (
    <header className="rega-header sticky top-0 z-40 text-white">
      {signedIn && <SessionRenewal />}
      {/* Below 360 px (320 px phones) the row would not fit: slightly less padding and no search icon (search stays in the bottom bar). */}
      <div dir="ltr" className="mx-auto flex h-[76px] lg:h-[88px] w-full max-w-[1440px] items-center justify-between gap-3 px-3 min-[360px]:px-4 sm:px-6 lg:px-14">
        <Link href="/" aria-label="ڕێگا REGA24" className="shrink-0 rounded-xl">
          <Logo inverse />
        </Link>

        <nav aria-label={t("primary")} className="hidden h-full xl:block">
          <NavLinks dir={contentDir} items={headerNav()} />
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/search" aria-label={tc("search")} className="hidden size-10 min-[360px]:grid place-items-center rounded-xl text-white transition hover:bg-white/10 xl:hidden">
            <FigmaIcon name="search" className="size-5" />
          </Link>
          <Link href={accountHref} className="hidden min-h-10 items-center justify-center gap-2 rounded-full border border-white/35 bg-white/5 px-4 text-[13px] font-semibold text-white transition hover:bg-white/15 sm:flex">
            <FigmaIcon name="user" className="size-4 shrink-0" />
            <span dir={contentDir}>{signedIn ? t("account") : t("login")}</span>
          </Link>
          {signedIn
            ? <NextLink href="/dr/businesses/new" className={addClass}><FigmaIcon name="plus" className="size-4 shrink-0" /><span dir={contentDir}>{t("addAd")}</span></NextLink>
            : <Link href="/for-business" className={addClass}><FigmaIcon name="plus" className="size-4 shrink-0" /><span dir={contentDir}>{t("addAd")}</span></Link>}
          {/* Physical edge anchor: localized account/action labels must not move the switcher. */}
          <LanguageSwitcher />
          <MobileNav items={mobileNav()} />
        </div>
      </div>
    </header>
  );
}
