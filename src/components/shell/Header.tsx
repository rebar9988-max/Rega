import { getLocale, getTranslations } from "next-intl/server";
import { dirOf } from "@/i18n/locales";
import { auth } from "@/auth";
import NextLink from "next/link";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/ui/Logo";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { headerNav, mobileNav } from "./nav";

/**
 * REGA public header.
 * Visual direction: approved red/white concept - calm white chrome, official logo, restrained red selected/action states.
 * Direction is kept physically stable while localized text follows the page direction.
 */
export async function Header() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const contentDir = dirOf(await getLocale());
  const signedIn = Boolean((await auth().catch(() => null))?.user);
  const accountHref = signedIn ? "/account" : "/login";
  const addClass = "hidden min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-[13px] font-bold text-brand-ink shadow-sm transition hover:bg-brand-hover xl:inline-flex";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 text-ink backdrop-blur">
      <div dir="ltr" className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="REGA Platform" className="shrink-0 rounded-xl">
          <span className="inline-flex items-center gap-2">
            <Logo className="[&>span:last-child]:hidden" />
            <span className="rounded-full border border-brand/20 bg-brand-soft px-2 py-0.5 text-[9px] font-extrabold tracking-[0.12em] text-brand" aria-label="Beta">BETA</span>
          </span>
        </Link>

        <nav aria-label={t("primary")} className="hidden h-full xl:block">
          <NavLinks dir={contentDir} items={headerNav()} />
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/search" aria-label={tc("search")} className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-brand-soft hover:text-brand xl:hidden">
            <FigmaIcon name="search" className="size-5" />
          </Link>
          <Link href={accountHref} className="hidden min-h-10 w-28 items-center justify-center gap-2 rounded-xl border border-line px-3 text-[12px] font-semibold text-ink transition hover:border-brand hover:text-brand sm:flex">
            <FigmaIcon name="user" className="size-4 shrink-0" />
            <span dir={contentDir}>{signedIn ? t("account") : t("login")}</span>
          </Link>
          {signedIn
            ? <NextLink href="/dr/businesses/new" className={addClass}><span dir={contentDir}>{t("addAd")}</span></NextLink>
            : <Link href="/for-business" className={addClass}><span dir={contentDir}>{t("addAd")}</span></Link>}
          {/* Physical edge anchor: localized account/action labels must not move the switcher. */}
          <LanguageSwitcher />
          <MobileNav items={mobileNav()} />
        </div>
      </div>
    </header>
  );
}
