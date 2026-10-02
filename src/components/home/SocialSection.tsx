/**
 * Homepage "stay connected" section: REGA's official Facebook, Instagram and TikTok profiles.
 * URLs come only from configuration (SOCIAL_*_URL, validated in lib/seo.ts); a platform without a configured URL
 * is not shown, and without any the section is not rendered. Icons are the official brand marks from the
 * simple-icons library (CC0, sourced from the brands' own asset pages), drawn in each brand's colour on white.
 */
import { getTranslations } from "next-intl/server";
import { siFacebook, siInstagram, siTiktok, type SimpleIcon } from "simple-icons";
import { socialProfiles, type SocialKey } from "@/lib/seo";

const PLATFORMS: { key: SocialKey; icon: SimpleIcon }[] = [
  { key: "facebook", icon: siFacebook },
  { key: "instagram", icon: siInstagram },
  { key: "tiktok", icon: siTiktok },
];

export async function SocialSection() {
  const profiles = socialProfiles();
  const items = PLATFORMS.flatMap((p) => {
    const url = profiles.find((s) => s.key === p.key)?.url;
    return url ? [{ ...p, url }] : [];
  });
  if (items.length === 0) return null;
  const t = await getTranslations("home");

  return (
    <section aria-labelledby="home-social" className="mt-12" data-testid="social-section">
      <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 id="home-social" className="text-xl font-extrabold sm:text-2xl">{t("socialTitle")}</h2>
          <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-brand" />
          <p className="mt-3 text-sm text-muted sm:text-base">{t("socialText")}</p>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap lg:flex-nowrap">
          {items.map(({ key, icon, url }) => (
            <li key={key}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("socialAria", { platform: icon.title })}
                className="flex min-h-12 flex-col items-center gap-2 rounded-xl border border-line bg-bg px-3 py-3 text-sm font-bold transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 active:translate-y-0 active:scale-[0.98] sm:flex-row sm:px-4 sm:py-2.5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white">
                  <svg viewBox="0 0 24 24" className="size-5" fill={`#${icon.hex}`} aria-hidden="true"><path d={icon.path} /></svg>
                </span>
                <span dir="ltr">{icon.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
