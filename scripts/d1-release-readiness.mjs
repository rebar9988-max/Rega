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
  // The deploy token already reads Workers settings. A separate operator verifies the real
  // D1 hashes and issues this attestation, avoiding an extra database permission on CI.
  const variable = name => settings.bindings.find(b => b.name === name && b.type === "plain_text")?.text;
  if (variable("REGA_ISOLATED_PREVIEW") !== "1") return false;
  const nonce = variable("REGA_D1_FREEZE_NONCE");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nonce ?? "")) return false;
  let proof;
  try { proof = JSON.parse(variable("REGA_D1_CUTOVER_PROOF") ?? "null"); } catch { return false; }
  const hash = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  const frozen = Date.parse(proof?.sourceFrozenAt), verified = Date.parse(proof?.verifiedAt), now = Date.now();
  return proof?.version === 1 && proof.project === "REGA" && proof.releaseSha === sha && proof.databaseId === D1_ID && proof.freezeNonce === nonce
    && proof.ready === true && proof.allTablesMatch === true && proof.foreignKeyViolations === 0 && proof.tableCount === 36
    && Number.isSafeInteger(proof.totalRows) && proof.totalRows > 0 && hash(proof.sourceFingerprintSha256) && hash(proof.typedManifestSha256) && hash(proof.backupSha256)
    && Number.isFinite(frozen) && Number.isFinite(verified) && verified - frozen >= 120_000 && now - verified >= -60_000 && now - verified <= 900_000;
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
