#!/usr/bin/env node
// Backward-compatible command. One generator owns both JSON and Markdown views.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync(process.execPath, [fileURLToPath(new URL('./rega24-docs.mjs', import.meta.url)), process.argv.includes('--check') ? '--check' : '--write'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
