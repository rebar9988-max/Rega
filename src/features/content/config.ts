/**
 * Content sections (jobs, events, guides) share one core (`Listing`) and differ only in this configuration and in
 * their typed details table. To add a section: a details table, an entry here, an entry in config/sections.ts with
 * `content: true`, translations, and a thin route per page (see docs/HOW-TO-EXTEND.md). Pure module.
 */
import type { Permission } from "@/lib/rbac";

export const CONTENT_SECTIONS = ["jobs", "events", "guides"] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

export type ContentConfig = {
  key: ContentSection;
  /** Permission needed to create and edit own entries in the dashboard. */
  write: Permission;
  /** Permission that publishes without moderation (everyone else submits for review). */
  publish: Permission;
  /** Entries belong to a Business (employer / organizer) the author manages. Staff may pick any business. */
  requiresBusiness: boolean;
  /** Public pages show the entry's business as employer / organizer. */
  showsBusiness: boolean;
  /** schema.org type of the detail page. */
  schemaType: "JobPosting" | "Event" | "Article";
};

export const CONTENT: Record<ContentSection, ContentConfig> = {
  jobs: { key: "jobs", write: "business.write", publish: "business.publish", requiresBusiness: true, showsBusiness: true, schemaType: "JobPosting" },
  events: { key: "events", write: "business.write", publish: "business.publish", requiresBusiness: false, showsBusiness: true, schemaType: "Event" },
  guides: { key: "guides", write: "content.write", publish: "content.write", requiresBusiness: false, showsBusiness: false, schemaType: "Article" },
};

export const isContentSection = (key: string): key is ContentSection => (CONTENT_SECTIONS as readonly string[]).includes(key);

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "mini_job", "apprenticeship", "internship", "freelance"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
