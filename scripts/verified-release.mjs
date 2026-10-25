// Same exact-commit CI gate for both production services, including manual fallbacks. No secrets in output.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const project = JSON.parse(readFileSync(new URL('../src/config/project.json', import.meta.url), 'utf8'));
const repo = project.repository;
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES || repo !== 'rebar9988-max/Rega' || process.env.GITHUB_REPOSITORY !== repo || process.env.CLOUDFLARE_ACCOUNT_ID !== project.cloudflareAccountId || !process.env.GITHUB_TOKEN || !/^[a-f0-9]{40}$/.test(sha)) {
  console.error('Release blocked: verified REGA repository and protected GitHub authorization required.');
  process.exit(1);
}
try {
  const head = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, {
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!head.ok || (await head.json()).object?.sha !== sha) throw new Error('Commit is no longer current main');
  let verified = false;
  for (let page = 1; page <= 5; page++) {
    const url = new URL(`https://api.github.com/repos/${repo}/actions/workflows/ci.yml/runs`);
    url.search = new URLSearchParams({ head_sha: sha, branch: 'main', status: 'completed', per_page: '100', page: String(page) }).toString();
    const response = await fetch(url, { headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('CI verification unavailable');
    const runs = (await response.json()).workflow_runs;
    if (!Array.isArray(runs)) throw new Error('Invalid CI response');
    verified = runs.some(run => run.head_sha === sha && run.head_branch === 'main' && run.head_repository?.full_name === repo && run.conclusion === 'success' && ['push', 'workflow_dispatch'].includes(run.event));
    if (verified || runs.length < 100) break;
  }
  if (!verified) throw new Error('No successful main CI for this commit');
  console.log(`Release gate passed: ${repo} main CI verified ${sha}.`);
} catch {
  console.error('Release blocked: successful CI for this exact main commit could not be verified. No deployment authorized.');
  process.exit(1);
}
