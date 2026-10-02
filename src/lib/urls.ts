/** Only http(s) URLs may be rendered as links: blocks javascript:/data: URLs from user-generated content. */
export function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Keeps digits and a leading "+", so a tel: link cannot carry anything else. */
export function safeTel(value?: string | null): string | null {
  const cleaned = (value ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned.length >= 5 ? cleaned : null;
}
