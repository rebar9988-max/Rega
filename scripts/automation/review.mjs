/** Trusted default-branch automation. Never execute logs, PR content or failed-head code. */
export function classify(text) {
  if (/quota|billing|payment required|spending limit/i.test(text)) return 'QUOTA_STOP';
  if (/vulnerab|npm audit|pip-audit/i.test(text)) return 'SECURITY_REVIEW';
  if (/ENOTFOUND|ECONNRESET|rate limit|timed out/i.test(text)) return 'INFRASTRUCTURE_REVIEW';
  return 'CODE_OR_CONFIGURATION_REVIEW';
}
const marker = '<!-- rega-engineering-recovery -->';
async function enqueue(api, owner, repo, incidents) {
  const issues = await api.issues.listForRepo({ owner, repo, state: 'open', creator: 'github-actions[bot]', per_page: 100 });
  const existing = issues.data.find(i => i.body?.startsWith(marker));
  let body = existing?.body || `${marker}\n## REGA24 recovery queue\n`;
  for (const { url, detail } of incidents) {
    if (!body.includes(url)) body += `\n\nRun: ${url}\n${detail}`;
  }
  if (body.length > 50000) throw new Error('Recovery queue capacity reached; preserve unresolved history and archive reviewed incidents manually');
  if (body === existing?.body) return;
  if (existing) await api.issues.update({ owner, repo, issue_number: existing.number, body });
  else if (incidents.length) await api.issues.create({ owner, repo, title: 'REGA24 engineering recovery queue', body });
}
export async function review({ github, context, core }) {
  const { owner, repo } = context.repo;
  if (`${owner}/${repo}` !== 'rebar9988-max/Rega' || context.payload.repository?.visibility !== 'public') {
    throw new Error('Identity/zero-cost gate failed');
  }
  const api = github.rest;
  const event = context.payload.workflow_run;
  const report = ['## ڕاپۆرتی ئەندازیاری REGA24', '', 'خەرجی زیادە: €0 بۆ runnerـی standard لە repositoryـی گشتی؛ هیچ APIـی AI بانگ نەکراوە.'];
  if (event) {
    if (event.repository?.full_name && event.repository.full_name !== `${owner}/${repo}`) throw new Error('Run repository mismatch');
    if (!['failure', 'timed_out', 'success'].includes(event.conclusion)) return;
    if (event.conclusion === 'success') {
      if (event.name !== 'Deploy to Cloudflare Workers' || event.head_branch !== 'main') return;
      // Public read-only readiness after deploy completion; does not attest deployed source/version.
      const response = await fetch('https://www.rega24.com/api/v1/health', { redirect: 'error', signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (!response.ok || body.ok !== true || body.checks?.databaseProvider !== 'd1') throw new Error('Post-deploy D1 health failed');
      report.push('پشکنینی تەندروستی دوای deploy: PASS (D1). ئەمە سەلماندنی وەشانی چالاک نییە.');
    } else {
      const { data } = await api.actions.listJobsForWorkflowRun({ owner, repo, run_id: event.id, per_page: 100 });
      const failed = data.jobs.filter(j => ['failure', 'timed_out'].includes(j.conclusion)).slice(0, 3);
      const classes = new Set();
      for (const job of failed) {
        let classification = 'LOG_UNAVAILABLE';
        try {
          const logs = await api.actions.downloadJobLogsForWorkflowRun({ owner, repo, job_id: job.id });
          // Never publish raw logs or arbitrary job/step names (they may contain secrets or prompt injection).
          if (typeof logs.data === 'string') classification = classify(logs.data.slice(0, 1000000));
        } catch { /* Missing/expired log access is explicitly reported, never treated as a pass. */ }
        classes.add(classification);
      }
      const prs = await api.pulls.list({ owner, repo, state: 'open', per_page: 100 });
      const fixing = prs.data.filter(p => p.head.ref === `automation/recovery-${event.id}`).map(p => p.number);
      const url = `https://github.com/${owner}/${repo}/actions/runs/${Number(event.id)}`;
      const detail = `Classification (heuristic, root cause requires verification): ${[...classes].join(', ') || 'NO_FAILED_JOB_VISIBLE'}\nRecovery PRs: ${fixing.join(', ') || 'none in first 100 open PRs'}\nRecovery: BLOCKED pending verified minimal correction in supported Codex session. No AI API, rerun, merge, deploy, secret or database write. QUOTA_STOP forbids further paid work. Continue with docs/AUTONOMOUS-ENGINEERING.md. Existing assignees retain ownership.`;
      await enqueue(api, owner, repo, [{ url, detail }]);
      report.push(`شکست تۆمار کرا: ${url}`, `پۆل: ${[...classes].join(', ')}`, 'چاککردنەوە: BLOCKED؛ پێویستی بە هۆکاری پشتڕاستکراوە هەیە.');
    }
  } else {
    const { data } = await api.actions.listWorkflowRunsForRepo({ owner, repo, per_page: 100, branch: 'main' });
    const completed = data.workflow_runs.filter(r => r.status === 'completed');
    const failed = completed.filter(r => ['failure', 'timed_out'].includes(r.conclusion));
    report.push(`CI reliability sample: ${completed.length} completed; ${failed.length} failed/timed out (latest 100 main runs; not full history).`);
    // GitHub concurrency can replace pending event runs. Reconcile missed main failures weekly.
    if (failed.length) await enqueue(api, owner, repo, failed.map(r => ({
      url: `https://github.com/${owner}/${repo}/actions/runs/${Number(r.id)}`,
      detail: 'Reconciled failure/time-out from latest 100 main runs. Root cause/log review pending in supported Codex session; no automatic retry.',
    })));
    const { data: branch } = await api.repos.getBranch({ owner, repo, branch: 'main' });
    report.push(`Branch protection: ${branch.protected ? 'enabled' : 'MISSING — owner security review required'}.`);
    report.push('Unit/D1/RTL/LTR/browser/Worker build: existing CI; full audit = dispatch CI separately. No duplicate E2E run here.');
  }
  await core.summary.addRaw(report.join('\n\n')).write();
}
