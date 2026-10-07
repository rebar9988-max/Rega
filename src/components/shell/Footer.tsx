import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LogoMark } from "@/components/ui/Logo";
import { footerNav } from "./nav";
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
  const link = "inline-flex min-h-9 items-center text-muted hover:text-ink md:min-h-8";
  // Columns and their links come from the section registry (config/sections.ts): no route is listed here.
  const groups = [
    { title: tf("explore"), items: footerNav("explore") },
    { title: tc("group"), items: footerNav("more") },
    { title: tf("legal"), items: footerNav("legal") },
  ].filter((g) => g.items.length > 0).map((g) => ({ title: g.title, items: g.items.map((i) => ({ href: i.href, label: t(i.key) })) }));

  return (
    <footer className="mt-12 border-t border-line bg-surface">
      <div className="container-page flex flex-col gap-5 py-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="max-w-sm space-y-1.5">
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
        <nav aria-label={tf("explore")} className="grid grid-cols-3 gap-x-5 gap-y-3 text-xs sm:gap-x-8">
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="mb-1 text-xs font-bold text-ink">{g.title}</h2>
              <ul>
                {g.items.map((i) => <li key={i.href}><Link href={i.href} className={link}>{i.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-line py-3 text-center text-[11px] text-muted">
        {tf("rights", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
