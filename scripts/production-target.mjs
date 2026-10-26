// Read-only fail-closed control-plane check. Never recreate a missing/renamed production Worker.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function verifyProductionTarget(project, env = process.env, request = fetch) {
  if (project.repository !== 'rebar9988-max/Rega' || env.CLOUDFLARE_ACCOUNT_ID !== project.cloudflareAccountId || !env.CLOUDFLARE_API_TOKEN) {
    throw new Error('Protected REGA account authorization required');
  }
  const get = async path => {
    const response = await request(`https://api.cloudflare.com/client/v4/accounts/${project.cloudflareAccountId}${path}`, {
      headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Production target verification unavailable');
    const body = await response.json();
    if (body.success !== true || !Array.isArray(body.result)) throw new Error('Invalid production target response');
    return body.result;
  };
  const workers = await get('/workers/scripts');
  if (!project.webWorkerTag || !workers.some(w => w.id === project.webWorker && w.tag === project.webWorkerTag)
    || !workers.some(w => w.id === project.aiWorker)) throw new Error('Existing production services do not match manifest');
  const domains = await get('/workers/domains');
  for (const host of [project.canonicalHost, project.apexHost]) {
    const matches = domains.filter(d => d.hostname === host);
    if (matches.length !== 1 || matches[0].service !== project.webWorker || matches[0].environment !== 'production') {
      throw new Error('Official domain ownership does not match manifest');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const project = JSON.parse(readFileSync(new URL('../src/config/project.json', import.meta.url), 'utf8'));
    await verifyProductionTarget(project);
    console.log('Production target verified: existing REGA Worker tag and both official domains match manifest.');
  } catch {
    console.error('Release blocked: live production ownership could not be verified. No resource creation or mutation authorized.');
    process.exitCode = 1;
  }
}
