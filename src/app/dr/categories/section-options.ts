import "server-only";
import { getTranslations } from "next-intl/server";
import { SECTIONS, labelKeyOf } from "@/config/sections";

export async function sectionOptions() {
  const t = await getTranslations("nav");
  // Categories organise businesses (and their services) and the content sections; pure pages (about, contact, ...) have none.
  return SECTIONS.filter((s) => s.key === "businesses" || (s as { content?: boolean }).content).map((s) => ({ key: s.key, label: t(labelKeyOf(s)) }));
}
