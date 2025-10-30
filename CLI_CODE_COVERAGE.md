# CLI Command Code Coverage Analysis

**Goal:** Track which CLI commands are actually tested/used by the UI codebase to identify code coverage gaps.

---

## CLI Commands Defined (in `src-tauri/src/cli/commands.rs`)

| Command | Enum Variant | Purpose | Coverage Status |
|---------|--------------|---------|-----------------|
| `gen-key` | `GenKey` | Generate new key/certificate | ❌ **NOT COVERED** |
| `gen-cert` | `GenCert` | Self-signed cert (deprecated) | ❌ **NOT COVERED** |
| `set-cert-path` | `SetCertPath` | Set certificate path | ❌ **NOT COVERED** |
| `print-cert` | `PrintCert` | Print certificate | ❌ **NOT COVERED** |
| `start-listener` | `StartListener` | Start peer listener | ❌ **NOT COVERED** |
| `api-register` | `ApiRegister` | Register with server | ❌ **NOT COVERED** |
| `api-ready` | `ApiReady` | Announce ready socket | ❌ **NOT COVERED** |
| `api-lookup` | `ApiLookup` | Lookup peers | ❌ **NOT COVERED** |
| `connect-peer` | `ConnectPeer` | Connect to peer | ❌ **NOT COVERED** |
| `send-client` | `SendClient` | Send message to peer | ❌ **NOT COVERED** |
| `allow` | `Allow` | Allow peer request | ❌ **NOT COVERED** |
| `allow auto` | `AllowAuto` | Enable auto-allow | ❌ **NOT COVERED** |
| `deny` | `Deny` | Deny peer request | ❌ **NOT COVERED** |
| `help` | `Help` | Show help | ❌ **NOT COVERED** |
| `exit` | `Exit` | Exit CLI | ❌ **NOT COVERED** |

**CLI Command Coverage:** 0/15 (0%)

> **Note:** The CLI commands are parsed and defined in `src/cli/commands.rs`, but the parsing logic (`CliCommand::parse()`) is **NOT being called by the UI code**. The UI uses Tauri commands instead (see below).

---

## Tauri Commands Exposed to UI (in `src-tauri/src/main.rs`)

These are the actual functions accessible from the frontend via `invoke()`:

| Tauri Command | Maps to CLI | UI Usage | Coverage Status |
|----------------|-------------|----------|-----------------|
| `connect_to_server` | (server connection) | KeySection | ✅ **COVERED** |
| `ui_load_private_key` | `gen-key` related | KeySection | ✅ **COVERED** |
| `ui_generate_user_keys_and_cert` | `gen-key` | KeySection | ✅ **COVERED** |
| `api_register` | `api-register` | ServerSection | ✅ **COVERED** |
| `api_register_json` | `api-register` | ServerSection | ✅ **COVERED** |
| `api_ready` | `api-ready` | BroadcastSection | ✅ **COVERED** |
| `api_lookup` | `api-lookup` | BroadcastSection | ✅ **COVERED** |
| `request_client_list` | (network) | ClientsList | ✅ **COVERED** |
| `connect_to_peer` | `connect-peer` | DccChatroom | ✅ **COVERED** |
| `send_chat_message` | (server chat) | ChatSection | ✅ **COVERED** |
| `peer_send_dcc_chat` | `send-client` | DccChatroom | ✅ **COVERED** |
| `peer_send_dcc_request` | (peer request) | DccChatroom | ✅ **COVERED** |
| `peer_send_dcc_opened` | (acknowledge) | DccChatroom | ✅ **COVERED** |
| `peer_send_file_offer` | `file_offer` | DccChatroom | ✅ **COVERED** |
| `peer_send_file_accept` | `file_accept` | DccChatroom | ✅ **COVERED** |
| `peer_send_file_chunk` | `file_chunk` | DccChatroom | ✅ **COVERED** |
| `peer_send_file_cancel` | `file_cancel` | DccChatroom | ✅ **COVERED** |
| `get_clients` | (internal) | (state) | ✅ **COVERED** |

**Tauri Command Coverage:** 18/18 (100%)

---

## Architecture Issue: CLI Commands Not Used by UI

**Current State:**
- ✅ Tauri commands (main.rs) are fully covered by UI
- ❌ CLI commands (cli/commands.rs) are **NOT** being called by UI code
- ❌ CLI commands are only used when running in CLI mode (`--cli` flag in main())

**Problem:** 
- The CLI command parsing logic has 15 defined commands but **zero direct usage from the UI**
- UI code calls Tauri IPC commands instead (which is correct), but doesn't instantiate `CliCommand` enum
- This means if bugs are introduced in CLI parsing, the UI won't catch them

**Solution Options:**

### Option A: Full UI Coverage of CLI Commands
Write tests in the UI (e2e or unit) that exercise each `CliCommand` variant via the CLI binary directly:
- Test each command with valid/invalid args
- Verify correct Tauri command is invoked for each
- Ensures parity between CLI and UI code paths

### Option B: Extract Shared Command Logic
Move command parsing/handling to `lib.rs` shared layer:
- Core logic becomes shared between CLI REPL and UI
- UI can test CLI logic via lib.rs functions instead of CLI binary
- Better code reuse, easier testing

### Option C: Document as Expected Design
CLI commands are intentionally separate from UI flow:
- CLI is for scripting/automation (separate test via cli-e2e.sh)
- UI is the primary user interface (separate e2e tests)
- Different code paths are acceptable by design
- Document which Tauri commands map to which CLI commands (see table above)

---

## Recommended Next Steps

1. **Decide on coverage strategy** - Which Option (A/B/C) aligns with project goals?
   - **Option A:** Run CLI commands from e2e tests ← Requires tauri-driver on macOS
   - **Option B:** Refactor CLI handlers to lib.rs ← Would improve code reuse
   - **Option C:** Document and accept as intended ← Minimum effort

2. **If pursuing Option B:** 
   - Identify which CLI command logic should move to lib.rs
   - Create shared command handler functions
   - Update both CLI and UI to call shared handlers
   - Add unit tests for each handler

3. **If pursuing Option A or C:**
   - Document the intentional separation in DEVELOPMENT_RULES.md
   - Mark CLI command coverage as "N/A - separate code path by design"

**Current Recommendation:** Option C (document as intended) - CLI is for automation, UI is separate. Different test paths are acceptable.
