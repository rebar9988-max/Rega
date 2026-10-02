import type { MetadataRoute } from "next";
import { BRAND_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: "REGA",
    description: "REGA Platform (ڕێگا): businesses, services and locations.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#dc0201",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
