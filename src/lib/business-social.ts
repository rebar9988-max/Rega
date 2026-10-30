/** One account-link contract shared by the business editor, server validation and public profile. */
export const BUSINESS_SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "snapchat"] as const;
export type BusinessSocialPlatform = (typeof BUSINESS_SOCIAL_PLATFORMS)[number];
export const BUSINESS_SOCIAL_FIELDS = {
  facebook: "facebookUrl", instagram: "instagramUrl", tiktok: "tiktokUrl", snapchat: "snapchatUrl",
} as const;
export const BUSINESS_SOCIAL_FIELD_NAMES = ["facebookUrl", "instagramUrl", "tiktokUrl", "snapchatUrl"] as const;
export type BusinessSocialField = (typeof BUSINESS_SOCIAL_FIELD_NAMES)[number];
export type BusinessSocialLinks = Record<BusinessSocialField, string | null>;
export const BUSINESS_SOCIAL_MAX_LENGTH = 500;
const HOSTS: Record<BusinessSocialPlatform, readonly string[]> = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  snapchat: ["snapchat.com", "www.snapchat.com"],
};
const FACEBOOK_RESERVED = new Set(["l.php", "login", "login.php", "logout.php", "share", "sharer", "sharer.php", "dialog", "plugins", "watch", "reel", "reels", "stories", "photo", "photo.php", "help", "privacy", "policies", "settings", "recover", "checkpoint", "groups", "events", "marketplace", "gaming", "business", "ads", "developers", "search", "redirect", "flx", "r.php"]);
const INSTAGRAM_RESERVED = new Set(["accounts", "explore", "direct", "p", "reel", "reels", "stories", "about", "legal", "developer", "web", "challenge", "oauth"]);

/**
 * Parse exact hosts and account paths, never substring-match a hostname. Account identity is preserved;
 * tracking queries and fragments are removed. Facebook's numeric profile.php?id= form keeps its id.
 * Empty means remove; undefined is handled separately by the optional server schema (partial update).
 */
export function normalizeBusinessSocialUrl(platform: BusinessSocialPlatform, input: unknown):
  { ok: true; value: string | null } | { ok: false } {
  if (input === null) return { ok: true, value: null };
  if (typeof input !== "string" || input.length > BUSINESS_SOCIAL_MAX_LENGTH) return { ok: false };
  const value = input.trim();
  if (!value) return { ok: true, value: null };
  // WHATWG URL repairs backslashes and removes control characters: reject those before parsing.
  if (!/^https:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return { ok: false };
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !HOSTS[platform].includes(url.hostname)) return { ok: false };
    const path = decodeURIComponent(url.pathname);
    const parts = path.split("/").filter(Boolean);
    // Encoded separators, repeated separators and dot-segment repair cannot disguise a profile path.
    if (/%(?:2f|5c|2e)/i.test(value.split("?")[0]) || url.pathname.includes("//") || /(?:^|\/)\.\.?(?:\/|$)/.test(value.slice(value.indexOf("://") + 3))) return { ok: false };
    let account = false;
    let profileId: string | null = null;
    if (platform === "instagram") account = parts.length === 1 && /^[a-zA-Z0-9._]{1,30}$/.test(parts[0]) && !INSTAGRAM_RESERVED.has(parts[0].toLowerCase());
    if (platform === "tiktok") account = parts.length === 1 && /^@[a-zA-Z0-9._]{1,24}$/.test(parts[0]);
    if (platform === "snapchat") account = parts.length === 2 && parts[0] === "add" && /^[a-zA-Z][a-zA-Z0-9._-]{1,29}$/.test(parts[1]);
    if (platform === "facebook") {
      if (path === "/profile.php") {
        profileId = url.searchParams.get("id");
        account = Boolean(profileId && /^[0-9]{1,30}$/.test(profileId) && url.searchParams.getAll("id").length === 1);
      } else {
        account = (parts.length === 1 && /^[a-zA-Z0-9.\-]{1,100}$/.test(parts[0]) && !parts[0].toLowerCase().endsWith(".php") && !FACEBOOK_RESERVED.has(parts[0].toLowerCase())) ||
          (parts.length === 3 && ["people", "pages"].includes(parts[0]) && /^[a-zA-Z0-9.\-]{1,100}$/.test(parts[1]) && /^[0-9]{1,30}$/.test(parts[2]));
      }
    }
    if (!account) return { ok: false };
    url.hash = "";
    url.search = "";
    if (profileId) url.searchParams.set("id", profileId);
    return { ok: true, value: url.href };
  } catch { return { ok: false }; }
}
