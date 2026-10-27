// Read-only first-cutover gate. Never freezes production, changes data, or deploys.
import { pathToFileURL } from "node:url";
export const D1_ID = "728f792d-37b6-49f8-abc1-e81512219f7d";
export async function d1ReleaseReady(sha, env = process.env, request = fetch) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? "") || env.CLOUDFLARE_ACCOUNT_ID !== "ee07860dbb8e61ff6915758785baf89a" || !env.CLOUDFLARE_API_TOKEN) throw new Error("Invalid REGA release identity");
  const call = async (path, body) => {
    const r = await request(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) return null;
    const json = await r.json();
    return json.success === true ? json.result : null;
  };
  const settings = await call("/workers/scripts/rega24/settings");
  if (!settings || !Array.isArray(settings.bindings)) throw new Error("Current REGA settings could not be verified");
  const activeD1 = settings.bindings.some(b => b.name === "REGA_DATABASE_PROVIDER" && b.text === "d1") && settings.bindings.some(b => b.name === "DB" && b.type === "d1" && b.id === D1_ID);
  if (activeD1) return true; // Subsequent releases use the already active database.
  const result = await call(`/d1/database/${D1_ID}/query`, { sql: 'SELECT releaseSha,ready,allTablesMatch,foreignKeyViolations FROM "_RegaCutover" WHERE id=1' });
  const row = result?.[0]?.results?.[0];
  return row?.releaseSha === sha && row.ready === 1 && row.allTablesMatch === 1 && row.foreignKeyViolations === 0;
}
async function main() {
  const until = Date.now() + Number(process.env.D1_CUTOVER_WAIT_MS || 0);
  try {
    for (;;) {
      if (await d1ReleaseReady(process.env.RELEASE_SHA)) { console.log("D1 release readiness verified."); break; }
      if (Date.now() >= until) throw new Error("Verified final snapshot has not been marked ready for this exact release");
      console.log("D1 cutover pending; production release remains blocked.");
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  } catch {
    console.error("Release blocked: D1 final snapshot readiness unavailable or does not match this release. No deployment performed.");
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
