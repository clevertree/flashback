import type { Options } from '@wdio/types'
import path from 'node:path'
import { createRequire } from 'node:module'

// TODO(e2e-types): Capabilities typing is currently using `any` inside tauriCaps to work around gaps in WDIO v9
// multiremote + tauri-driver typing. Tighten these types and validate against actual capabilities once the E2E
// environment is stabilized. Consider extracting a shared type for 'tauri:options'.

// NOTE: This is a scaffold for running Tauri E2E tests via tauri-driver using WebdriverIO multiremote.
// It is intentionally conservative: if prerequisites are not available (driver/app), tests should be skipped.
//
// Prerequisites (documented in docs/e2e.md):
// - Install tauri-driver binary and have it running (e.g., `tauri-driver --port 4551`)
// - Or configure WDIO service that starts tauri-driver (community solutions exist)
// - Build the Tauri app or use `tauri dev` runner
//
// You can point to a built app binary via APP_PATH env var. On Windows, that might look like:
//   APP_PATH="C:\\Users\\kado\\dev\\flashback\\client\\src-tauri\\target\\debug\\client.exe"
// Alternatively, you can instruct tauri-driver to run `npm run tauri:dev` via TAURI_RUNNER env vars (see docs).

const TAURI_DRIVER_HOST = process.env.TAURI_DRIVER_HOST || '127.0.0.1'
const TAURI_DRIVER_PORT = Number(process.env.TAURI_DRIVER_PORT || 4551)
const APP_PATH = process.env.APP_PATH || ''

// Helper: Tauri capabilities understood by tauri-driver
function tauriCaps(instanceName: string) {
  // Build W3C compliant WebDriver capabilities for multiremote usage in WDIO v9
  const alwaysMatch: any = {
    browserName: 'wry',
    'tauri:options': {
      application: APP_PATH, // if empty, tests should skip in spec
      args: [],
      cwd: path.resolve(__dirname, '..', '..'),
      // You can also pass runner and runnerArgs if you prefer to use `tauri dev` instead of a built binary
      runner: process.env.TAURI_RUNNER || '',
      runnerArgs: process.env.TAURI_RUNNER_ARGS ? JSON.parse(process.env.TAURI_RUNNER_ARGS) : [],
      env: {
        NODE_ENV: 'test',
      },
      // Windows-only: provide unique data dir per instance if needed
      instanceName,
    },
  }

  return {
    capabilities: {
      // WDIO expects a W3C caps structure when using the WebDriver protocol in multiremote
      alwaysMatch,
      firstMatch: [{}],
    },
  } as any
}

export const config = {
  runner: 'local',
  specs: [
    path.resolve(__dirname, 'specs', 'basic.interaction.e2e.ts'),
  ],
  maxInstances: 1,
  logLevel: 'info',
  framework: 'mocha',
  mochaOpts: {
    timeout: 120000,
    require: [createRequire(import.meta.url).resolve('ts-node/register')],
  },
  reporters: ['spec'],
  automationProtocol: 'webdriver',
  hostname: TAURI_DRIVER_HOST,
  port: TAURI_DRIVER_PORT,
  path: '/',
  outputDir: path.resolve(__dirname, '..', '..', 'wdio-logs'),
  services: [], // Intentionally empty; see docs/e2e.md for running tauri-driver separately
  capabilities: {
    A: tauriCaps('A'),
    B: tauriCaps('B'),
  },
}

export default config
