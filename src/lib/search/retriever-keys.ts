/**
 * Sections that have a search retriever (see postgres.ts). A section flagged `assistant: true` in the registry must be
 * listed here once its retriever exists; tests/config.test.ts fails otherwise, so a new section cannot silently be
 * missing from search and from REGA Assistant.
 */
export const RETRIEVER_KEYS = ["businesses", "services", "jobs", "events", "guides"] as const;
export type RetrieverKey = (typeof RETRIEVER_KEYS)[number];
