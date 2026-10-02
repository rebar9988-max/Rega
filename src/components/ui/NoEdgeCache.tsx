import { NO_STORE_MARKER } from "@/lib/edge-cache";

/**
 * Rendered by a public page that had to fall back to an empty state because its data could not be loaded. The edge
 * cache (src/lib/edge-cache.ts) then sends this render to the visitor without storing it. Invisible; no visual effect.
 */
export function NoEdgeCache() {
  return <meta name={NO_STORE_MARKER} content="1" />;
}
