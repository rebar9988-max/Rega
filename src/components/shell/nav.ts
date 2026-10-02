/** Single source of truth for primary navigation. `key` maps to messages `nav.*`. */
export const NAV_ITEMS = [
  { key: "businesses", href: "/businesses" },
  { key: "services", href: "/services" },
  { key: "locations", href: "/locations" },
  { key: "nearby", href: "/nearby" },
  { key: "ai", href: "/ai" },
] as const;
