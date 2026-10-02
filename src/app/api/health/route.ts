/** GET /api/health — short alias of /api/v1/health (same report), for uptime monitors. */
export { GET } from "../v1/health/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
