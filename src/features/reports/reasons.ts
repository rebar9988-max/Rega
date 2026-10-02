export const REPORT_REASONS = ["illegal", "misleading", "spam", "copyright", "privacy", "other"] as const;

/** Which kind of record a reported URL points at (for moderators): /xx/businesses/<slug> -> business, ... */
export function reportKind(url: string): { kind: string; targetId: string | null } {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean);
    const [, section, slug] = path;
    if ((section === "business" || section === "businesses") && slug) return { kind: "business", targetId: slug };
    if (section === "services" && slug) return { kind: "service", targetId: path.slice(2).join("/") };
    if ((section === "jobs" || section === "events" || section === "guides") && slug) return { kind: section.slice(0, -1), targetId: slug };
    return { kind: "page", targetId: null };
  } catch {
    return { kind: "other", targetId: null };
  }
}

