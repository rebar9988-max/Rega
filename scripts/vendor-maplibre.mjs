// Copies MapLibre's web-worker files (same version as the bundled library) to public/vendor/maplibre so the map
// loads its worker from our own origin: no CDN, and the Content-Security-Policy stays 'self'.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("maplibre-gl/package.json"));
const out = join(process.cwd(), "public", "vendor", "maplibre");
mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(pkg, "dist", file), join(out, file));
copyFileSync(join(pkg, "LICENSE.txt"), join(out, "LICENSE.txt"));
console.log("maplibre worker files copied to public/vendor/maplibre");
