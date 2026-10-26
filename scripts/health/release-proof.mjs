// Existing public endpoints and control-plane reads only. No inference, email, login or data mutations.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { verifyProductionTarget } from '../production-target.mjs';

export async function verifyRelease(project, sha, env = process.env, request = fetch) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release identity');
  await verifyProductionTarget(project, env, request);
  const api = async path => {
    const r = await request(`https://api.cloudflare.com/client/v4/accounts/${project.cloudflareAccountId}/workers/scripts/${project.webWorker}${path}`, {
      redirect: 'error', headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error('Version verification unavailable');
    const body = await r.json();
    if (body.success !== true) throw new Error('Invalid version response');
    return body.result;
  };
  const deployment = (await api('/deployments')).deployments?.[0];
  if (deployment?.versions?.length !== 1 || deployment.versions[0].percentage !== 100) throw new Error('Incomplete rollout');
  const versionId = deployment.versions[0].version_id;
  const version = await api(`/versions/${versionId}`);
  if (version.annotations?.['workers/tag'] !== sha) throw new Error('Active version does not match source');
  const base = `https://${project.canonicalHost}`;
  const health = await request(`${base}/api/v1/health`, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!health.ok) throw new Error('Health unavailable');
  const report = await health.json();
  if (report.ok !== true || report.sourceSha !== sha || report.checks?.database !== 'ok' || report.checks?.databaseTargetMatchesManifest !== true) throw new Error('Release health or database ownership mismatch');
  const publicPage = await request(`${base}/en`, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (publicPage.status !== 200) throw new Error('Canonical page unavailable');
  for (const [url, status, host, path] of [
    [`https://${project.apexHost}/en?rega24_verify=1`, 301, project.canonicalHost, '/en'],
    [`${base}/dr?rega24_verify=1`, 308, project.canonicalHost, project.adminPath],
  ]) {
    const response = await request(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    const location = response.headers.get('location');
    if (!location || response.status !== status) throw new Error('Compatibility redirect unavailable');
    const destination = new URL(location, url);
    if (destination.protocol !== 'https:' || destination.hostname !== host || destination.pathname !== path || destination.searchParams.get('rega24_verify') !== '1') throw new Error('Redirect destination mismatch');
  }
  const admin = await request(`${base}${project.adminPath}`, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  const html = await admin.text();
  if (admin.status !== 200 || !html.includes('data-dr-sign-in') || html.includes('<aside')) throw new Error('Anonymous admin boundary mismatch');
  return { sha, deploymentId: deployment.id, versionId, allocation: 100, canonicalHost: project.canonicalHost,
    checks: ['source tag', 'database health', 'canonical 200', 'apex 301', 'legacy admin 308', 'anonymous admin sign-in'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const project = JSON.parse(readFileSync(new URL('../../src/config/project.json', import.meta.url), 'utf8'));
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  let evidence;
  for (let attempt = 0; attempt < 6; attempt++) {
    try { evidence = await verifyRelease(project, sha); break; }
    catch { if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 5000)); }
  }
  if (evidence) console.log(JSON.stringify(evidence));
  else { console.error('Production verification failed: inspect active version and scoped rollback before declaring release success. No secret/body output.'); process.exitCode = 1; }
}
