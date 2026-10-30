import { useId } from "react";
import { siFacebook, siInstagram, siSnapchat, siTiktok, type SimpleIcon } from "simple-icons";
import type { SocialPlatform } from "@/lib/social-links";

/**
 * Official brand marks (simple-icons, CC0, from the brands' own asset pages), each in its brand's own colours on a
 * white tile so they stay recognisable in light and dark mode: Instagram's gradient, Facebook blue, the TikTok note
 * with its cyan/red offset, and the Snapchat ghost on Snapchat yellow.
 */
const ICON: Record<SocialPlatform, SimpleIcon> = { instagram: siInstagram, facebook: siFacebook, tiktok: siTiktok, snapchat: siSnapchat };

function BrandMark({ platform }: { platform: SocialPlatform }) {
  const gradient = useId();
  const { path } = ICON[platform];
  if (platform === "instagram") return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <defs>
        <radialGradient id={gradient} cx="0.3" cy="1.07" r="1.2">
          <stop offset="0" stopColor="#fdf497" /><stop offset="0.1" stopColor="#fdf497" /><stop offset="0.5" stopColor="#fd5949" />
          <stop offset="0.68" stopColor="#d6249f" /><stop offset="1" stopColor="#285aeb" />
        </radialGradient>
      </defs>
      <path d={path} fill={`url(#${gradient})`} />
    </svg>
  );
  if (platform === "tiktok") return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path d={path} fill="#25F4EE" transform="translate(-0.7 -0.7)" />
      <path d={path} fill="#FE2C55" transform="translate(0.7 0.7)" />
      <path d={path} fill="#000000" />
    </svg>
  );
  if (platform === "snapchat") return (
    <span className="grid size-full place-items-center rounded-[inherit] bg-[#FFFC00]">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path d={path} fill="#000000" /></svg>
    </span>
  );
  return <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path d={path} fill={`#${ICON[platform].hex}`} /></svg>;
}

/** Row of the business's own social profiles; renders only the platforms it was given (never an empty row). */
export function SocialLinks({ links, label, ariaLabel }: {
  links: { platform: SocialPlatform; title: string; url: string }[];
  label: string;
  ariaLabel: (title: string) => string;
}) {
  if (links.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2" data-testid="business-social">
      {links.map(({ platform, title, url }) => (
        <li key={platform}>
          <a href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={ariaLabel(title)} data-testid={`social-link-${platform}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pe-3 ps-1.5 text-sm font-semibold transition hover:border-brand/40 hover:bg-surface-2 motion-safe:active:scale-[.98]">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white"><BrandMark platform={platform} /></span>
            <span dir="ltr">{title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
