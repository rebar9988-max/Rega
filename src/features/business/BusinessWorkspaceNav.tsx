import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { BUSINESS_HOME, BUSINESS_LIST, BUSINESS_NEW } from "./paths";

export async function BusinessWorkspaceNav({ locale }: { locale: string }) {
  const t = await getTranslations();
  const items = [
    [BUSINESS_HOME, "businessOwner.dashboard", "house"],
    [BUSINESS_LIST, "businessOwner.myBusinesses", "briefcase-business"],
    [BUSINESS_NEW, "businessOwner.addBusiness", "plus-square"],
    [`${BUSINESS_LIST}?status=pending`, "businessOwner.requests", "file-text"],
    [`/${locale}/account`, "auth.profile", "user"],
  ];
  return <header className="border-b border-line bg-surface">
    <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <Link href={`/${locale}`} aria-label="REGA Platform" className="shrink-0"><Logo className="max-[400px]:[&_img:first-child]:size-8 max-[400px]:[&_img:last-of-type]:h-4" /></Link>
      <div className="flex min-w-0 items-center gap-2">
        <LanguageSwitcher destination="/business-owner" />
        <Link href={`/${locale}/account`} aria-label={t("auth.profile")} className="grid size-11 shrink-0 place-items-center rounded-full border border-line hover:bg-brand-soft"><FigmaIcon name="user" className="size-5" /></Link>
      </div>
    </div>
    <nav aria-label={t("businessOwner.title")} className="mx-auto flex max-w-6xl flex-wrap gap-1 px-3 pb-3 sm:px-5">
      {items.map(([href, key, icon]) => <Link key={href} href={href} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-brand-soft hover:text-brand">
        <FigmaIcon name={icon} className="size-4 shrink-0" /><span>{t(key)}</span>
      </Link>)}
    </nav>
  </header>;
}
