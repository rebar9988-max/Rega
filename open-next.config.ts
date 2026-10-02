import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig(),
  // `npm run build` itself runs opennextjs-cloudflare, so point OpenNext at the plain Next.js build
  // (otherwise it would call `npm run build` again and recurse).
  buildCommand: "npx next build",
};

export default config;
