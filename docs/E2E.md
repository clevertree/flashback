Tauri-centered E2E tests with WebdriverIO + tauri-driver

Overview
- We use WebdriverIO with tauri-driver to automate the Tauri desktop app via the W3C WebDriver protocol.
- Tests support running two app instances (multiremote) so we can validate interactions through the real UI.
- We intentionally keep the setup explicit and opt-in to avoid breaking developer workflows when prerequisites are missing.

Why WebdriverIO (vs Selenium)
- Both Selenium and WebdriverIO can drive tauri-driver. We chose WebdriverIO for its first-class multiremote support, great TypeScript DX, and simpler local runner configuration.
- If you prefer Selenium bindings, the tauri-driver endpoint (host/port) is compatible; you can port the tests as needed.

Prerequisites
- Rust toolchain installed (to run the server from source).
- tauri-driver installed and running. Example (port 4551):
  tauri-driver --port 4551
- Either:
  - Build the Tauri app and set APP_PATH to the executable path, or
  - Use a runner (npm/yarn) to start `tauri dev` by setting TAURI_RUNNER and TAURI_RUNNER_ARGS.

Examples
- Built app binary (recommended for stability):
  set TAURI_DRIVER_PORT=4551
  set APP_PATH=C:\\Users\\kado\\dev\\flashback\\client\\src-tauri\\target\\debug\\client.exe
  cd client
  npx wdio run .\e2e\wdio.multiremote.conf.ts

- Using tauri dev:
  set TAURI_DRIVER_PORT=4551
  set TAURI_RUNNER=npm
  set TAURI_RUNNER_ARGS=["run","tauri:dev"]
  cd client
  npx wdio run .\e2e\wdio.multiremote.conf.ts

What the regression test does
- Spawns the Rust server on an ephemeral port and parses the bound port from stdout.
- Launches two Tauri client instances (A and B).
- Fills the connection form in both clients with 127.0.0.1 and the parsed port.
- Sends a chat message from A and verifies it appears in B.

Notes
- The test will automatically skip if APP_PATH/TAURI_RUNNER or TAURI_DRIVER_PORT are not provided.
- Running multiple `tauri dev` instances may reuse the same frontend dev server; this generally works but a built binary is more deterministic for E2E.
- For CI, prefer building the app in a prior step, starting tauri-driver as a service, then running `npm run e2e` in client.
