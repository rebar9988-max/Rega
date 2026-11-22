import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { Link } from "@/i18n/routing";
import { SessionRenewal } from "@/features/auth/SessionRenewal";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { HeaderFrame } from "./HeaderFrame";
import { MobileNav } from "./MobileNav";
import { footerNav, headerNav, mobileNav } from "./nav";

export async function Header() {
  const [t, th] = await Promise.all([getTranslations("nav"), getTranslations("home")]);
  const user = (await auth().catch(() => null))?.user;
  const signedIn = Boolean(user);
  const adHref = signedIn && can(user?.role, "business.write") ? "/dr/offers/new" : null;
  const items = mobileNav();
  const paths = new Set(items.map((item) => item.href));

  return (
    <HeaderFrame
      homeControls={
        <>
          <a href="#home-latest" className="rega-reference-updates" aria-label={th("popularBusinesses")}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></svg>
          </a>
          <div className="rega-header-pill rega-reference-language"><LanguageSwitcher variant="reference" /></div>
        </>
      }
      account={
        <Link href={signedIn ? "/account" : "/login"} className="rega-reference-account" aria-label={signedIn ? t("account") : t("login")}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="9" r="3" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></svg>
        </Link>
      }
      menu={<MobileNav items={items} homeItems={headerNav().filter((item) => !paths.has(item.href))} legal={footerNav("legal")} signedIn={signedIn} adHref={adHref} />}
    >
      {signedIn && <SessionRenewal />}
    </HeaderFrame>
  );
}
