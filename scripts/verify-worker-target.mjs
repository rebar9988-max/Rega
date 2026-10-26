/** Read-only production gate: never recreate a retired Worker behind the canonical domains. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const domains = ["www.rega24.com", "rega24.com"];

/** @param {{accountId:string,apiToken:string,expectedWorker:string,fetcher?:typeof fetch}} options */
export async function verifyWorkerTarget({ accountId, apiToken, expectedWorker, fetcher = fetch }) {
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !apiToken || !/^[a-z0-9_-]{1,63}$/.test(expectedWorker))
    throw new Error("Worker target verification requires valid account, token and Wrangler name; deployment blocked.");
  await Promise.all(domains.map(async (hostname) => {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`);
    url.searchParams.set("hostname", hostname);
    let response;
    try {
      response = await fetcher(url, { headers: { Authorization: `Bearer ${apiToken}` }, redirect: "error", signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new Error(`Cannot verify live Worker target for ${hostname}; deployment blocked.`);
    }
    if (!response.ok) throw new Error(`Worker target verification HTTP ${response.status} for ${hostname}; deployment blocked.`);
    let body;
    try { body = await response.json(); } catch { throw new Error("Invalid Worker target response; deployment blocked."); }
    if (body.success !== true || !Array.isArray(body.result)) throw new Error("Invalid Worker target response; deployment blocked.");
    const matches = body.result.filter((item) => item && item.hostname === hostname && item.service === expectedWorker && item.environment === "production" && item.enabled !== false);
    if (matches.length !== 1) throw new Error(`Live Worker does not match Wrangler for ${hostname}; deployment blocked.`);
  }));
  return { worker: expectedWorker, domains };
}

async function main() {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const expectedWorker = config.match(/^\s*"name"\s*:\s*"([a-z0-9_-]+)"/m)?.[1] ?? "";
  const result = await verifyWorkerTarget({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "", apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "", expectedWorker });
  console.log(`Verified live production Worker target: ${JSON.stringify(result)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Worker target verification failed; deployment blocked.");
    process.exitCode = 1;
  });
}
