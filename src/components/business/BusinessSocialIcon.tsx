import { siFacebook, siInstagram, siTiktok, siSnapchat } from "simple-icons";
import type { BusinessSocialPlatform } from "@/lib/business-social";

const icons = { facebook: siFacebook, instagram: siInstagram, tiktok: siTiktok, snapchat: siSnapchat };
export const BUSINESS_SOCIAL_LABELS = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", snapchat: "Snapchat" } as const;

/** Existing Simple Icons artwork, using the shared neutral foreground. */
export function BusinessSocialIcon({ platform }: { platform: BusinessSocialPlatform }) {
  return <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true"><path d={icons[platform].path} /></svg>;
}
