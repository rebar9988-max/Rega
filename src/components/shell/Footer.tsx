import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/ui/Logo";
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
  const link = "inline-flex min-h-8 items-center text-muted hover:text-ink";
  // Columns and their links come from the section registry (config/sections.ts): no route is listed here.
  const groups = [
    { id: "explore", title: tf("explore"), items: footerNav("explore") },
    { id: "more", title: tc("group"), items: footerNav("more") },
    { id: "legal", title: tf("legal"), items: footerNav("legal") },
  ].filter((g) => g.items.length > 0).map((g) => ({ id: g.id, title: g.title, items: g.items.map((i) => ({ href: i.href, label: t(i.key) })) }));

  return (
    // Phones: one compact block (logo + tagline, one wrapped row of links, copyright). The main sections are already in
    // the bottom tab bar and the menu, so the "explore" column is desktop-only; About, contact and legal stay everywhere.
    <footer className="mt-8 border-t border-line bg-surface md:mt-12">
      <div className="container-page flex flex-col gap-2.5 py-4 md:flex-row md:items-center md:justify-between md:gap-8 md:py-5">
        <div className="flex items-center justify-between gap-3 md:block md:max-w-sm md:space-y-1.5">
          <Link href="/" className="inline-flex shrink-0 items-center rounded-lg" aria-label="ڕێگا REGA24" dir="ltr">
            <Logo compact />
          </Link>
          <p className="min-w-0 text-end text-xs text-muted md:text-start">{tf("tagline")}</p>
          {social.length > 0 && (
            <nav aria-label={tf("follow")} className="hidden md:block">
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
        <nav aria-label={tf("explore")} className="flex flex-wrap justify-center gap-x-4 text-xs md:grid md:grid-cols-3 md:justify-normal md:gap-x-8 md:gap-y-3">
          {groups.map((g) => (
            <div key={g.id} className={`min-w-0 ${g.id === "explore" ? "hidden md:block" : "contents md:block"}`}>
              <h2 className="sr-only text-xs font-bold text-ink md:not-sr-only md:mb-1">{g.title}</h2>
              {/* Long single words (German legal links) wrap instead of pushing the page sideways on narrow phones. */}
              <ul className="contents hyphens-auto [overflow-wrap:anywhere] md:block">
                {g.items.map((i) => <li key={i.href}><Link href={i.href} className={link}>{i.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      {/* Below md the fixed tab bar (BottomNav, 4rem + its raised search button) sits over the page end: reserve that
          space so the copyright line is never covered. */}
      <div className="border-t border-line py-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] text-center text-[11px] text-muted md:pb-3">
        <span className="me-2 font-bold tracking-wide text-brand-text">Beta</span>
        {tf("rights", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
