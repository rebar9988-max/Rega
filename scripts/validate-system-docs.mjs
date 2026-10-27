#!/usr/bin/env node
// Backward-compatible CI entry point; no independent validation rules or network.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync(process.execPath, [fileURLToPath(new URL('./rega24-docs.mjs', import.meta.url)), '--check'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
