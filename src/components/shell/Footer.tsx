import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LogoMark } from "@/components/ui/Logo";
import { NAV_ITEMS } from "./nav";
import { SOCIAL_DISPLAY_NAME, socialProfiles } from "@/lib/seo";

const SOCIAL_LABEL = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", x: "X", telegram: "Telegram", whatsapp: "WhatsApp" } as const;

/**
 * Site footer (rendered once by the locale layout, on every page). Navigation only: it links to sections and to
 * /contact, but never repeats their content, so it stays compact on every page and on phones.
 */
export async function Footer() {
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const tc = await getTranslations("contact");
  const social = socialProfiles();
  const explore = NAV_ITEMS.filter((i) => i.key !== "ai");
  const link = "inline-flex min-h-9 items-center text-muted hover:text-ink md:min-h-8";
  const groups = [
    { title: tf("explore"), items: explore.map((i) => ({ href: i.href, label: t(i.key) })) },
    { title: tc("group"), items: [{ href: "/ai", label: t("ai") }, { href: "/about", label: tf("about") }] },
    { title: tf("contact"), items: [{ href: "/contact", label: tc("title") }] },
  ];

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-page flex flex-col gap-5 py-6 md:flex-row md:items-start md:justify-between md:gap-10 md:py-8">
        <div className="max-w-xs space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 font-bold" aria-label="REGA Platform">
            <LogoMark className="size-8" />
            <span dir="ltr">REGA Platform</span>
          </Link>
          <p className="text-xs text-muted">{tf("tagline")}</p>
          {social.length > 0 && (
            <nav aria-label={tf("follow")}>
              <ul className="flex flex-wrap gap-x-4 text-xs">
                {social.map((p) => (
                  <li key={p.key}>
                    <a href={p.url} rel="me noopener noreferrer" target="_blank" aria-label={`${SOCIAL_DISPLAY_NAME} — ${SOCIAL_LABEL[p.key]}`} className="inline-flex min-h-9 items-center font-semibold text-muted hover:text-ink">{SOCIAL_LABEL[p.key]}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <nav aria-label={tf("explore")} className="grid grid-cols-3 gap-x-6 gap-y-4 text-sm md:gap-x-12">
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="mb-1 text-xs font-bold text-ink">{g.title}</h2>
              <ul className={g.items.length > 2 ? "md:grid md:grid-cols-2 md:gap-x-6" : undefined}>
                {g.items.map((i) => <li key={i.href}><Link href={i.href} className={link}>{i.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        {tf("rights", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
