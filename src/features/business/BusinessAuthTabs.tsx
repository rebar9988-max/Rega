import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export async function BusinessAuthTabs({ next, active }: { next: string; active: "login" | "register" }) {
  const t = await getTranslations();
  return <div className="space-y-6">
    <div className="text-center">
      <p className="mb-2 text-sm font-bold text-brand" lang="en" dir="ltr">REGA Business</p>
      <h1 className="text-2xl font-extrabold">{t("businessOwner.title")}</h1>
      <p className="mt-2 text-sm leading-7 text-muted">{t("businessOwner.authLead")}</p>
    </div>
    <nav aria-label={t("businessOwner.title")} className="grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-center text-sm font-bold">
      {(["login", "register"] as const).map((tab) => <Link key={tab} href={`/${tab}?next=${encodeURIComponent(next)}`}
        aria-current={active === tab ? "page" : undefined}
        className={`flex min-h-12 items-center justify-center rounded-lg px-2 ${active === tab ? "border-b-2 border-brand bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`}>
        {t(tab === "login" ? "auth.signIn" : "auth.createAccount")}
      </Link>)}
    </nav>
  </div>;
}
