import "server-only";
import { prisma } from "@/lib/db";
import type { Locale } from "@/config/locales";
import { localizeText } from "@/lib/content";
import type { SearchHit, SectionRetriever } from "@/lib/search/types";
import type { ContentSection } from "./config";
import { entrySelect, publicWhere, textOf } from "./queries";
import { wallClock } from "./pure";

const HEADING: Record<ContentSection, string> = { jobs: "JOBS", events: "EVENTS", guides: "GUIDES" };

/**
 * Search / assistant retriever of a content section: published, live entries whose text contains a question word.
 * Only stored facts go into the grounding line (employer, city, dates, venue); nothing is invented or inferred.
 */
export function contentRetriever(section: ContentSection): SectionRetriever {
  return {
    promptHeading: HEADING[section],
    async retrieve({ terms }, locale: Locale) {
      if (terms.length === 0) return [];
      const rows = await prisma.listing.findMany({
        where: { ...publicWhere(section, {}), OR: terms.flat().map((v) => ({ searchText: { contains: v } })) },
        select: { ...entrySelect, searchText: true },
        take: 40,
        orderBy: section === "events" ? { event: { startsAt: "asc" } } : { publishedAt: "desc" },
      });
      return rows
        .map((r) => ({ r, n: terms.filter((vs) => vs.some((v) => r.searchText.includes(v))).length }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 8)
        .map<SearchHit>(({ r, n }) => {
          const text = textOf(r, locale);
          const title = text?.title ?? r.slug;
          const where = r.city ? localizeText({ ...r.city, name: r.city.nameEn }, "name", locale) : "";
          const who = r.business ? localizeText(r.business, "name", locale) : "";
          const url = `/${locale}/${section}/${r.slug}`;
          const facts = [
            who,
            where,
            r.job ? r.job.employmentType.replace("_", " ") : "",
            r.event ? `${wallClock(r.event.startsAt).replace("T", " ")}${r.event.venue ? ` at ${r.event.venue}` : ""}` : "",
            section === "guides" ? text?.summary ?? "" : "",
          ].filter(Boolean);
          return { section, id: r.id, title, subtitle: [who, where].filter(Boolean).join(" · ") || undefined, url, verified: r.verified, score: n, context: `- ${title}${facts.length ? ` — ${facts.join(" — ")}` : ""} — link: ${url}` };
        });
    },
  };
}
