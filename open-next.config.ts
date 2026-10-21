import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig(),
  // `npm run build` itself runs opennextjs-cloudflare, so point OpenNext at the plain Next.js build
  // (otherwise it would call `npm run build` again and recurse).
  buildCommand: "node scripts/prepare-worker-build.mjs && npx next build --webpack",
};

export default config;
