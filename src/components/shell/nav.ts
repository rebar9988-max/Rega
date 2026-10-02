/** Navigation lists, generated from the section registry (src/config/sections.ts). Never list routes by hand here. */
import { footerSections, labelKeyOf, sectionsFor, type FooterGroup, type SectionDef } from "@/config/sections";

/** `key` maps to messages `nav.*`; `href` is locale-less (the locale-aware Link adds the prefix). */
export type NavItem = { key: string; href: string };

const toItem = (s: SectionDef): NavItem => ({ key: labelKeyOf(s), href: s.path || "/" });

export const headerNav = (): NavItem[] => sectionsFor("header").map(toItem);
export const mobileNav = (): NavItem[] => sectionsFor("mobile").map(toItem);
export const footerNav = (group: FooterGroup): NavItem[] => footerSections(group).map(toItem);
