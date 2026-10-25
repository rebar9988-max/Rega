// DOCS_ONLY_SKIP: one allowlist shared by both production service workflows. No network or secrets.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export function docsOnly(paths) {
  return paths.length > 0 && paths.every(path => path.endsWith('.md') || path.startsWith('docs/') || [
    'scripts/generate-system-inventory.mjs', 'scripts/validate-system-docs.mjs', 'scripts/rega24-docs.mjs',
    '.github/workflows/deploy.yml', '.github/workflows/ci.yml',
  ].includes(path));
}
if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
let skip = false;
if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD^'], { stdio: 'ignore' });
    const paths = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    // An empty diff (including some merge commits) is deliberately not skipped.
    skip = docsOnly(paths);
  } catch { /* Uncertain scope must continue through full release verification. */ }
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `skip=${skip}\n`);
console.log(`DOCS_ONLY_SKIP=${skip}`);
}
