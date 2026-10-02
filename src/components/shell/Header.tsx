import { getLocale, getTranslations } from "next-intl/server";
import { dirOf } from "@/i18n/locales";
import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { NavLinks } from "./NavLinks";

export async function Header() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const contentDir = dirOf(await getLocale());
  // Auth must never take the public site down: no session (or a misconfigured secret) = signed out.
  const signedIn = Boolean((await auth().catch(() => null))?.user);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      {/* The header chrome keeps one physical layout in every language (logo left, tools right) so the language
          switcher never changes place; only the TEXT inside it follows the page direction (contentDir). */}
      <div dir="ltr" className="container-page flex h-[4.5rem] items-center gap-2 lg:h-20" style={{ maxWidth: "80rem" }}>
        <Link href="/" aria-label="REGA Platform" className="me-2 shrink-0 rounded-lg xl:me-4"><Logo /></Link>
        <nav aria-label={t("primary")} className="hidden xl:block">
          <NavLinks dir={contentDir} />
        </nav>
        <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
          <Link href="/search" aria-label={tc("search")} className="grid size-11 place-items-center rounded-xl max-[359px]:hidden hover:bg-brand-soft hover:text-brand">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          </Link>
          <Link href={signedIn ? "/account" : "/login"} dir={contentDir} className="hidden min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink shadow-[0_6px_16px_-8px_var(--brand)] transition-colors hover:bg-brand-hover sm:flex">{signedIn ? t("account") : t("login")}</Link>
          <LanguageSwitcher />
          <ThemeToggle label={tc("toggleTheme")} />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
