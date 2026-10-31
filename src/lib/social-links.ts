/**
 * Optional public social profiles of a business (Facebook, Instagram, TikTok, Snapchat) and its optional website.
 * Pure (no I/O): the form, the server action, the profile page and the tests use the same rules.
 *
 * A profile link is stored only after `normalizeSocialUrl` accepted it, and it is rebuilt from its parts: only https,
 * only the platform's own hosts (exact match, so "facebook.com.evil.example" or "evilfacebook.com" never pass), no
 * user name/password, no port, no fragment and a plain path. Whatever else a person typed never reaches the link.
 */

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "snapchat"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
/** Business column per platform. */
export const SOCIAL_FIELD = { facebook: "facebookUrl", instagram: "instagramUrl", tiktok: "tiktokUrl", snapchat: "snapchatUrl" } as const satisfies Record<SocialPlatform, string>;
export type SocialField = (typeof SOCIAL_FIELD)[SocialPlatform];

type Rule = {
  /** Accepted host -> host stored in the link. */
  hosts: Readonly<Record<string, string>>;
  /** Link built from a bare handle ("@name" or "name"). */
  handle: (name: string) => string;
};

const RULES: Readonly<Record<SocialPlatform, Rule>> = {
  facebook: {
    hosts: { "facebook.com": "www.facebook.com", "www.facebook.com": "www.facebook.com", "m.facebook.com": "www.facebook.com", "web.facebook.com": "www.facebook.com", "fb.com": "www.facebook.com", "www.fb.com": "www.facebook.com" },
    handle: (n) => `https://www.facebook.com/${n}`,
  },
  instagram: {
    hosts: { "instagram.com": "www.instagram.com", "www.instagram.com": "www.instagram.com", "m.instagram.com": "www.instagram.com" },
    handle: (n) => `https://www.instagram.com/${n}`,
  },
  tiktok: {
    hosts: { "tiktok.com": "www.tiktok.com", "www.tiktok.com": "www.tiktok.com", "m.tiktok.com": "www.tiktok.com", "vm.tiktok.com": "vm.tiktok.com", "vt.tiktok.com": "vt.tiktok.com" },
    handle: (n) => `https://www.tiktok.com/@${n}`,
  },
  snapchat: {
    hosts: { "snapchat.com": "www.snapchat.com", "www.snapchat.com": "www.snapchat.com", "story.snapchat.com": "story.snapchat.com" },
    handle: (n) => `https://www.snapchat.com/add/${n}`,
  },
};

export type LinkResult = { ok: true; value: string | null } | { ok: false };

const HANDLE = /^@?([A-Za-z0-9._-]{1,60})$/;
/** Path segments of a public profile: letters, digits and the few marks profile names use; no "..", no encoded slashes. */
const SEGMENT = /^(?!\.{1,2}$)[\p{L}\p{N}._~@+-]{1,100}$/u;
const MAX = 300;

/**
 * "" -> null (not given). A profile URL of the platform (with or without "https://"), or a bare handle, -> canonical
 * https link. Anything else (another site, a lookalike domain, javascript:, credentials, a port, the bare home page) -> not ok.
 */
export function normalizeSocialUrl(platform: SocialPlatform, input: string | null | undefined): LinkResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > MAX || /[\s<>"'`\\]/.test(raw)) return { ok: false };
  const rule = RULES[platform];
  const handle = HANDLE.exec(raw);
  // "@name" is always a handle; "name" too unless it looks like a host name ("name.com" is read as a URL).
  if (handle && (raw.startsWith("@") || !raw.includes("."))) return { ok: true, value: rule.handle(handle[1]) };

  // A scheme other than http(s) is never accepted; a missing scheme means https.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return { ok: false };
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return { ok: false }; }
  if (url.username || url.password || url.port) return { ok: false };
  const host = rule.hosts[url.hostname.toLowerCase()];
  if (!host) return { ok: false };
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 4 || !segments.every((s) => SEGMENT.test(decodeSafe(s)))) return { ok: false };
  // Script endpoints (e.g. Facebook's l.php link redirector) are not profiles; only profile.php?id= is.
  if (segments.some((seg, i) => /\.php$/i.test(seg) && !(platform === "facebook" && i === 0 && seg === "profile.php"))) return { ok: false };
  // Facebook pages without a user name are addressed as profile.php?id=<digits>; every other query string is dropped.
  const id = url.searchParams.get("id");
  const query = platform === "facebook" && segments.length === 1 && segments[0] === "profile.php"
    ? (id && /^\d{1,30}$/.test(id) ? `?id=${id}` : null)
    : "";
  if (query === null) return { ok: false };
  const value = `https://${host}/${segments.map((s) => encodeURIComponent(decodeSafe(s)).replace(/%40/g, "@")).join("/")}${query}`;
  return value.length <= MAX ? { ok: true, value } : { ok: false };
}

function decodeSafe(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded.includes("/") ? "\u0000" : decoded;
  } catch { return "\u0000"; }
}

/**
 * Optional business website: "" -> null; "example.com" or "http(s)://example.com/…" -> an http(s) URL (https added when
 * no scheme was typed). Only public host names: no credentials, no other scheme, no IP-less single-label host.
 */
export function normalizeWebsite(input: string | null | undefined): LinkResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > MAX || /[\s<>"'`\\]/.test(raw)) return { ok: false };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return { ok: false };
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return { ok: false }; }
  if (url.username || url.password) return { ok: false };
  const host = url.hostname.toLowerCase();
  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(host)) return { ok: false };
  const value = url.toString();
  return value.length <= MAX ? { ok: true, value } : { ok: false };
}

/** Saved profile links that may be shown (each re-checked, so a stored value that fails today is simply not shown). */
export function socialLinks(b: Partial<Record<SocialField, string | null>>): { platform: SocialPlatform; url: string }[] {
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const r = normalizeSocialUrl(platform, b[SOCIAL_FIELD[platform]] ?? "");
    return r.ok && r.value ? [{ platform, url: r.value }] : [];
  });
}
