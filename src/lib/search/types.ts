import type { Locale } from "@/config/locales";

/** One result of the platform search, whatever section it comes from. */
export type SearchHit = {
  /** Section key of the registry (config/sections.ts): "businesses", "services", later "jobs", "events", ... */
  section: string;
  id: string;
  title: string;
  subtitle?: string;
  /** Path with the locale prefix, e.g. /de/businesses/zagros-restaurant. */
  url: string;
  verified?: boolean;
  /** Ranking score: more matching question words = higher. */
  score: number;
  /** One line of grounding text for the AI prompt (names exactly as shown to users). */
  context: string;
};

export type ParsedQuery = {
  /** Question words with their spelling variants (see ai/query.ts). */
  terms: string[][];
  /** Wording asks for the best / highest rated. */
  best: boolean;
  /** Wording asks for verified listings. */
  verifiedOnly: boolean;
};

export type SearchRequest = { text: string; locale: Locale; limit?: number };

/** What a section contributes to search and to the REGA Assistant. Adding a section = adding one retriever. */
export interface SectionRetriever {
  /** Heading of this section's lines in the AI prompt (English; the model translates). */
  readonly promptHeading: string;
  retrieve(query: ParsedQuery, locale: Locale): Promise<SearchHit[]>;
}

/**
 * Search behind a small interface: today Postgres (substring search over the denormalized `searchText` columns with
 * trigram indexes); a Meilisearch/Typesense implementation can replace it without touching features or the assistant.
 */
export interface SearchService {
  search(request: SearchRequest): Promise<SearchHit[]>;
}
