import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, review } from './review.mjs';
function fixture({ existing, conclusion = 'failure', visibility = 'public', logError = false } = {}) {
  const writes = [];
  const context = { repo: { owner: 'rebar9988-max', repo: 'Rega' }, payload: { repository: { visibility }, workflow_run: { id: 123, conclusion } } };
  const github = { rest: {
    actions: {
      listJobsForWorkflowRun: async () => ({ data: { jobs: [{ id: 2, conclusion: 'failure', name: 'PRIVATE-secret' }] } }),
      downloadJobLogsForWorkflowRun: async () => { if (logError) throw Error('denied'); return { data: 'PRIVATE-secret npm audit vulnerability' }; },
    },
    issues: {
      listForRepo: async () => ({ data: existing ? [existing] : [] }),
      create: async a => writes.push(a), update: async a => writes.push(a),
    },
    pulls: { list: async () => ({ data: [] }) },
  } };
  const core = { summary: { addRaw: () => ({ write: async () => {} }) } };
  return { github, context, core, writes };
}
test('quota overrides all other classifications', () => {
  assert.equal(classify('npm audit vulnerability and quota exceeded'), 'QUOTA_STOP');
  assert.equal(classify('ECONNRESET'), 'INFRASTRUCTURE_REVIEW');
  assert.equal(classify('assert failed'), 'CODE_OR_CONFIGURATION_REVIEW');
});
test('public issue contains classification and trusted URL, never raw log or job names', async () => {
  const f = fixture(); await review(f);
  assert.equal(f.writes.length, 1);
  assert.match(f.writes[0].body, /SECURITY_REVIEW/);
  assert.doesNotMatch(f.writes[0].body, /PRIVATE-secret/);
});
test('same run delivery does not create or update an issue twice', async () => {
  const f = fixture({ existing: { number: 8, body: '<!-- rega-engineering-recovery -->\nhttps://github.com/rebar9988-max/Rega/actions/runs/123' } });
  await review(f); assert.equal(f.writes.length, 0);
});
test('later run updates stable issue and preserves assignees', async () => {
  const f = fixture({ existing: { number: 8, body: '<!-- rega-engineering-recovery -->\nold evidence', assignees: [{ login: 'owner' }] } });
  await review(f); assert.equal(f.writes[0].issue_number, 8);
  assert.equal('assignees' in f.writes[0], false);
});
test('missing log access is not a successful diagnosis', async () => {
  const f = fixture({ logError: true }); await review(f); assert.match(f.writes[0].body, /LOG_UNAVAILABLE/);
});
test('private or wrong repository fails before API access', async () => {
  await assert.rejects(review(fixture({ visibility: 'private' })), /zero-cost/);
  const f = fixture(); f.context.repo.repo = 'wrong'; await assert.rejects(review(f), /Identity/);
});
test('successful non-deployment event never writes an issue', async () => {
  const f = fixture({ conclusion: 'success' }); await review(f); assert.equal(f.writes.length, 0);
});
test('appending later incident retains unresolved earlier evidence', async () => {
  const f = fixture({ existing: { number: 8, body: '<!-- rega-engineering-recovery -->\nprevious-run' } });
  await review(f); assert.match(f.writes[0].body, /previous-run/);
});
test('queue capacity fails closed without losing unresolved evidence', async () => {
  const f = fixture({ existing: { number: 8, body: '<!-- rega-engineering-recovery -->' + 'x'.repeat(50000) } });
  await assert.rejects(review(f), /capacity/); assert.equal(f.writes.length, 0);
});
test('scheduled reconciliation restores missed main failures to queue', async () => {
  const f = fixture(); delete f.context.payload.workflow_run;
  f.github.rest.actions.listWorkflowRunsForRepo = async () => ({ data: { workflow_runs: [{ id: 456, status: 'completed', conclusion: 'failure' }] } });
  f.github.rest.repos = { getBranch: async () => ({ data: { protected: false } }) };
  await review(f); assert.match(f.writes[0].body, /runs\/456/); assert.match(f.writes[0].body, /Reconciled/);
});
test('post-deployment wrong database provider fails readiness', async () => {
  const f = fixture({ conclusion: 'success' });
  Object.assign(f.context.payload.workflow_run, { name: 'Deploy to Cloudflare Workers', head_branch: 'main' });
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, checks: { databaseProvider: 'postgres' } }) });
  try { await assert.rejects(review(f), /D1 health/); } finally { globalThis.fetch = savedFetch; }
  assert.equal(f.writes.length, 0);
});
