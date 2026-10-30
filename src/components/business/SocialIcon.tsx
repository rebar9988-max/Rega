/**
 * Official brand mark of a business social profile (simple-icons, CC0), in the brand's colour on a white disc;
 * Snapchat's ghost is drawn black on its yellow, as the brand shows it. Decorative: the link or label names the platform.
 */
import { siFacebook, siInstagram, siSnapchat, siTiktok, type SimpleIcon } from "simple-icons";
import type { SocialPlatform } from "@/lib/social-links";

export const SOCIAL_ICONS: Readonly<Record<SocialPlatform, SimpleIcon>> = { facebook: siFacebook, instagram: siInstagram, tiktok: siTiktok, snapchat: siSnapchat };

export function SocialIcon({ platform, className = "size-10" }: { platform: SocialPlatform; className?: string }) {
  const icon = SOCIAL_ICONS[platform];
  const snap = platform === "snapchat";
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full border border-line ${snap ? "bg-[#FFFC00]" : "bg-white"} ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[55%]" fill={snap ? "#000" : `#${icon.hex}`}><path d={icon.path} /></svg>
    </span>
  );
}
