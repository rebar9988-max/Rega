/**
 * Optional official social profiles of a business (Instagram, Facebook, TikTok, Snapchat).
 * Pure (no I/O), so the form, the server action, the profile page and the tests all use the same rules.
 *
 * A person may paste a profile link or type a username ("@name"). Only https links on the platform's own domain are
 * stored, rebuilt from the parsed URL (no credentials, no port, no fragment); anything else is refused. The page
 * checks the stored value again before it shows a button, so a row edited elsewhere can never become a foreign link.
 */

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "snapchat"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const PLATFORM: Record<SocialPlatform, { title: string; hosts: string[]; profile: (handle: string) => string; handle: RegExp }> = {
  instagram: { title: "Instagram", hosts: ["instagram.com"], profile: (h) => `https://www.instagram.com/${h}`, handle: /^[A-Za-z0-9._]{1,30}$/ },
  facebook: { title: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], profile: (h) => `https://www.facebook.com/${h}`, handle: /^[A-Za-z0-9.]{5,50}$/ },
  tiktok: { title: "TikTok", hosts: ["tiktok.com"], profile: (h) => `https://www.tiktok.com/@${h}`, handle: /^[A-Za-z0-9._]{2,24}$/ },
  snapchat: { title: "Snapchat", hosts: ["snapchat.com"], profile: (h) => `https://www.snapchat.com/add/${h}`, handle: /^[A-Za-z][A-Za-z0-9._-]{2,14}$/ },
};

export const socialTitle = (platform: SocialPlatform) => PLATFORM[platform].title;

export type SocialResult = { ok: true; value: string } | { ok: false; reason: "empty" | "invalid" };

const onPlatform = (host: string, platform: SocialPlatform) =>
  PLATFORM[platform].hosts.some((h) => host === h || host.endsWith(`.${h}`));

/** Normalises a typed link or username to an https profile URL on the platform's own domain. */
export function normalizeSocial(platform: SocialPlatform, raw: string | null | undefined): SocialResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "empty" };
  if (value.length > 300) return { ok: false, reason: "invalid" };
  const handle = value.replace(/^@/, "");
  const looksLikeUrl = value.includes("/") || PLATFORM[platform].hosts.some((h) => value.toLowerCase().includes(h));
  if (!looksLikeUrl && PLATFORM[platform].handle.test(handle)) return { ok: true, value: PLATFORM[platform].profile(handle) };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return { ok: false, reason: "invalid" };
  const host = url.hostname.toLowerCase();
  if (!onPlatform(host, platform) || url.pathname.replace(/\/+$/, "") === "") return { ok: false, reason: "invalid" };
  return { ok: true, value: `https://${host}${url.pathname}${url.search}` };
}

/** The stored links of a business that are safe to show, in a fixed platform order. Empty when there are none. */
export function socialLinks(b: Partial<Record<SocialPlatform, string | null>>): { platform: SocialPlatform; title: string; url: string }[] {
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const stored = b[platform];
    if (!stored || !stored.startsWith("https://")) return [];
    const result = normalizeSocial(platform, stored);
    return result.ok ? [{ platform, title: PLATFORM[platform].title, url: result.value }] : [];
  });
}
