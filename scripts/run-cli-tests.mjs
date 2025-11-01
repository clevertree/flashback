#!/usr/bin/env node

/**
 * CLI E2E Test Runner
 * Runs __tests__/cli-e2e.mjs directly using Node.js with Jest
 * Supports both mock and live server testing
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFile = path.join(__dirname, '../__tests__/cli-e2e.test.mjs');
const useLive = process.env.USE_LIVE_KALEIDO === 'true';

console.log(`\n📋 Running CLI E2E Tests ${useLive ? '(LIVE MODE)' : '(MOCK MODE)'}\n`);

const jestArgs = [
  '--testMatch',
  '**/__tests__/cli-e2e.mjs',
  '--testTimeout=30000',
  '--detectOpenHandles',
  '--forceExit',
];

if (process.env.VERBOSE) {
  jestArgs.push('--verbose');
}

const child = spawn('npx', ['jest', ...jestArgs], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--experimental-vm-modules --no-warnings',
  },
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Failed to run tests:', error);
  process.exit(1);
});
