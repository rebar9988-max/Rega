import "server-only";
import { notFound } from "next/navigation";
import { sectionEnabled } from "@/config/sections";
import { isContentSection, type ContentSection } from "@/features/content/config";

/** The `[section]` segment of the dashboard routes: a content section that is switched on, else 404. */
export function contentSection(param: string): ContentSection {
  if (!isContentSection(param) || !sectionEnabled(param)) notFound();
  return param;
}
