# CLI Code Coverage Summary

## Quick Overview

```
┌─────────────────────────────────────────────────────────────┐
│              CODE COVERAGE ANALYSIS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CLI Commands (cli/commands.rs)                            │
│  ├─ GenKey                          ❌ NOT COVERED         │
│  ├─ GenCert                         ❌ NOT COVERED         │
│  ├─ SetCertPath                     ❌ NOT COVERED         │
│  ├─ PrintCert                       ❌ NOT COVERED         │
│  ├─ StartListener                   ❌ NOT COVERED         │
│  ├─ ApiRegister                     ❌ NOT COVERED         │
│  ├─ ApiReady                        ❌ NOT COVERED         │
│  ├─ ApiLookup                       ❌ NOT COVERED         │
│  ├─ ConnectPeer                     ❌ NOT COVERED         │
│  ├─ SendClient                      ❌ NOT COVERED         │
│  ├─ Allow                           ❌ NOT COVERED         │
│  ├─ AllowAuto                       ❌ NOT COVERED         │
│  ├─ Deny                            ❌ NOT COVERED         │
│  ├─ Help                            ❌ NOT COVERED         │
│  └─ Exit                            ❌ NOT COVERED         │
│     Coverage: 0/15 (0%)                                    │
│                                                             │
│  Tauri Commands (main.rs)                                  │
│  ├─ connect_to_server               ✅ COVERED by UI       │
│  ├─ ui_load_private_key             ✅ COVERED by UI       │
│  ├─ ui_generate_user_keys_and_cert  ✅ COVERED by UI       │
│  ├─ api_register                    ✅ COVERED by UI       │
│  ├─ api_register_json               ✅ COVERED by UI       │
│  ├─ api_ready                       ✅ COVERED by UI       │
│  ├─ api_lookup                      ✅ COVERED by UI       │
│  ├─ request_client_list             ✅ COVERED by UI       │
│  ├─ connect_to_peer                 ✅ COVERED by UI       │
│  ├─ send_chat_message               ✅ COVERED by UI       │
│  ├─ peer_send_dcc_chat              ✅ COVERED by UI       │
│  ├─ peer_send_dcc_request           ✅ COVERED by UI       │
│  ├─ peer_send_dcc_opened            ✅ COVERED by UI       │
│  ├─ peer_send_file_offer            ✅ COVERED by UI       │
│  ├─ peer_send_file_accept           ✅ COVERED by UI       │
│  ├─ peer_send_file_chunk            ✅ COVERED by UI       │
│  ├─ peer_send_file_cancel           ✅ COVERED by UI       │
│  └─ get_clients                     ✅ COVERED by UI       │
│     Coverage: 18/18 (100%)                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Finding

**The UI does NOT directly test CLI commands (`CliCommand` enum).**

### Why This Happens

1. **Tauri IPC Architecture:** 
   - UI calls Tauri commands via `invoke()`
   - Tauri commands are RPC endpoints in main.rs
   - CLI commands are a separate REPL interface in cli/commands.rs

2. **Two Separate Code Paths:**
   ```
   UI Frontend (React)
        ↓
   invoke('api_register') 
        ↓
   Tauri Command in main.rs
        ↓
   Implementation Logic
   
   CLI (REPL)
        ↓
   parse 'api-register'
        ↓
   CliCommand::ApiRegister
        ↓
   CLI Command Handler
        ↓
   Same Implementation (or different!)
   ```

3. **Testing Strategy:**
   - UI tests exercise Tauri commands (✅ 100% coverage)
   - CLI tests exercise CLI commands (run via `cli-e2e.sh`)
   - **But:** CLI commands are NOT called by UI tests

---

## What This Means

| Scenario | Current State | Risk |
|----------|---------------|------|
| Bug in Tauri command | ❌ UI tests WILL catch | LOW |
| Bug in CLI command parsing | ✅ UI tests WON'T catch | MEDIUM |
| Bug in shared logic (if refactored) | ? Depends on approach | ? |

---

## Three Decision Paths

### Path 1: Accept as Intended Design ✅ Recommended
- CLI is separate automation tool (tested by `cli-e2e.sh`)
- UI is separate GUI application (tested by GUI e2e tests)
- Different code paths = different test strategies
- **Action:** Document in DEVELOPMENT_RULES.md and close

### Path 2: Extract Shared Handlers → Full Coverage
- Move CLI command implementations to lib.rs functions
- Both CLI REPL and UI can call shared handlers
- One implementation per feature, tested once
- **Action:** Refactor cli/commands.rs to call lib.rs functions
- **Benefit:** 100% coverage, DRY principle
- **Effort:** Medium (would improve code quality)

### Path 3: Add UI Tests for CLI Commands
- Add e2e test that invokes CLI binary from UI test
- Verify each `CliCommand` variant is testable
- Ensures CLI/UI parity
- **Action:** Create new test suite in `client/e2e/`
- **Benefit:** Full coverage matrix
- **Effort:** Low-Medium (but requires tauri-driver on Linux)

---

## Recommendation

**Go with Path 1 + Optional Path 2:**

1. **Now (Path 1):** Document in DEVELOPMENT_RULES.md:
   > "CLI and UI are separate test vectors. CLI commands are tested via cli-e2e.sh scripts. UI features are tested via GUI e2e tests. This separation is intentional and allows independent iteration."

2. **Future (Path 2):** When refactoring for code reuse:
   > "Extract CLI command handlers to lib.rs functions. This makes the implementation testable from both CLI and UI contexts, achieving single-source-of-truth."

This balances:
- ✅ Current pragmatism (CLI works, UI works, tested separately)
- ✅ Future flexibility (path to shared layer when needed)
- ✅ Clear documentation (team understands the design)
