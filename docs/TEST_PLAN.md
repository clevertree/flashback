# Regression Test Plan

This document outlines the regression tests to cover critical server and client functionality.

## Server (Rust, TCP)

Scope:
- User list management: registering clients, broadcasting client lists, handling disconnects/timeouts.
- Chatroom relay: relaying chat messages to connected clients with correct metadata.

Tests:
1) Userlist: single client
- Start the server on an ephemeral port (or parse the bound port from stdout)
- Connect a client and send a `register` message
- Expect a `client_list` response that includes the registered client

2) Userlist: multiple clients and disconnect
- Connect two clients A and B
- Expect both to receive a `client_list` that includes A and B
- Close client B
- Expect next `client_list` update to include only A

3) Chat relay: two clients
- Connect A and B
- A sends `chat` on a channel
- B receives the `chat` with matching `{from_ip, from_port, channel, message}`

Notes:
- Messages are JSON, newline-delimited. Use `serde_json` for parsing in tests.
- Prefer binding server to port `0` and parse the bound port from stdout line `Address: 0.0.0.0:<port>`.

Implementation approach:
- Add integration tests under `server/tests/`.
- For now, keep them `#[ignore]` until we finalize the spawn/port plumbing; they document the acceptance criteria and are easy to enable.

## Client (Tauri/Next.js)

E2E: Use WebdriverIO + tauri-driver (Tauri-centered). Component tests may continue to use Cypress in isolation.

Scope:
- Temp file writing target: when saving/“open with OS”, `.part` is created in OS temp or configured `tempDir`.
- Streaming receive: progress updates beyond 0% using total-size fallbacks and finalization to selected path.
- Open with OS: after finalize, OS open is requested (via shell plugin) when `Open with OS` flow is used.
- In-app playback: after stream completes, the video player gets a playable `src` and starts if `autoPlayMedia` is true.

Tests:
1) Temp file path selection
- Mount `DccChatroom` with an incoming offer
- Mock `@tauri-apps/plugin-dialog.save` to return `C:\\Out\\video.mp4`
- Mock `@tauri-apps/api/path.tempDir` to return `C:\\Temp` (or set config `tempDir`)
- Click `Open with OS` to trigger `ensureSaveTarget`
- Assert `@tauri-apps/plugin-fs.removeFile` called on `C:\\Temp\\video.mp4.part`

2) Stream and save
- Mount `DccChatroom` with pending action `save`
- Send chunk messages through a mocked BroadcastChannel
- Assert transfer progress increments and finalization moves `.part` to final path

3) Open with OS
- Same as above but with `open` action; assert shell open/show called with final path

4) In-app playback
- Simulate completed stream URL, assert `VideoPlayerSection` receives the src

Implementation approach:
- Create Cypress component specs under `client/src/components/.../*.cy.tsx`.
- Mock Tauri modules using Cypress’s module stubbing and inject a simple BroadcastChannel shim for tests.

## Running tests

Server (after un-ignoring tests):
- cd server && cargo test

Client component tests:
- cd client && npm run cypress:component

This plan focuses on deterministic, automatable regressions for the critical data flows on both sides.