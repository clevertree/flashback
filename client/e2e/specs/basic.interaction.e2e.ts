import { expect } from 'chai'
import { spawnServer } from '../utils/spawnServer'
import { spawnSync } from 'node:child_process'

// TODO(e2e-types): This spec still has TypeScript typing rough edges related to WebdriverIO multiremote and the
// global `browser` type. We currently rely on type casts to WebdriverIO.MultiRemoteBrowser for getInstance calls.
// Follow-up: refine types by installing/updating @wdio/types and configuring tsconfig/test types, or by introducing
// a typed helper wrapper to safely obtain instances A/B without casts.
// Reference: docs/E2E.md and docs/TEST_PLAN.md for the intended multiremote flow.

// WDIO multiremote provides two instances: browserA and browserB (names driven by capabilities keys).
// In TypeScript with multiremote, the global "browser" is a MultiRemoteBrowser, but we can access instances via
// browser.getInstance('A') / browser.getInstance('B').

function skipIfNotReady() {
  const hasAppPath = !!process.env.APP_PATH || !!process.env.TAURI_RUNNER
  const driverPort = process.env.TAURI_DRIVER_PORT || '4551'
  if (!hasAppPath) return `Missing APP_PATH or TAURI_RUNNER env; set up tauri-driver to launch the app.`
  if (!driverPort) return `Missing TAURI_DRIVER_PORT.`
  // Ensure Rust cargo is available to run the server used by tests
  try {
    const cargoCmd = process.platform === 'win32' ? 'cargo.exe' : 'cargo'
    const res = spawnSync(cargoCmd, ['--version'], { stdio: 'ignore' })
    if (res.status !== 0) return 'Rust cargo not found; install Rust toolchain to run server for E2E tests.'
  } catch {
    return 'Rust cargo not found; install Rust toolchain to run server for E2E tests.'
  }
  return ''
}

describe('E2E: server + two Tauri clients basic chat', () => {
  let server: Awaited<ReturnType<typeof spawnServer>> | null = null

  before(async function () {
    const reason = skipIfNotReady()
    if (reason) this.skip()
    server = await spawnServer()
  })

  after(async () => {
    try { server?.kill() } catch {}
  })

  it('connects A and B, and relays a chat message', async function () {
    if (!server) return this.skip()

    const A = await (browser as WebdriverIO.MultiRemoteBrowser).getInstance('A')
    const B = await (browser as WebdriverIO.MultiRemoteBrowser).getInstance('B')

    const serverIp = '127.0.0.1'
    const serverPort = String(server.port)

    // Connection form: fill and connect in both clients
    // We select inputs by placeholder text and click the Connect button by its label
    const fillAndConnect = async (drv: WebdriverIO.Browser) => {
      const ipInput = await drv.$("input[placeholder='Server IP']")
      const portInput = await drv.$("input[placeholder='Server Port']")
      const clientPortInput = await drv.$("input[placeholder='Your Port']")
      await ipInput.setValue(serverIp)
      await portInput.setValue(serverPort)
      // client port is auto-randomized by app; leave as-is
      const connectBtn = await drv.$("button=Connect")
      await connectBtn.click()
      // Wait for chat section to appear
      await (await drv.$('#chat')).waitForExist({ timeout: 20000 })
    }

    await fillAndConnect(A)
    await fillAndConnect(B)

    // In A, send a message in #general
    const msg = `hello from A ${Date.now()}`
    const inputA = await A.$("#chat input[placeholder*='Message #general']")
    await inputA.setValue(msg)
    const sendBtnA = await A.$("#chat button=Send")
    await sendBtnA.click()

    // In B, expect the message to appear
    const messageInB = await B.$(`//section[@id='chat']//p[contains(., ${JSON.stringify(msg)})]`)
    await messageInB.waitForExist({ timeout: 15000 })
    expect(await messageInB.isExisting()).to.equal(true)
  })
})
