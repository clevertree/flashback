# Shared Handler Implementation Guide

## Overview

The `handlers.rs` module provides shared command implementations that can be called from both the CLI and the Tauri GUI. This achieves a single source of truth for business logic and ensures CLI/UI code paths are consistent.

## Current Status

✅ **Completed:**
- Created `src/handlers.rs` module with generic handler functions
- Extracted command signatures: `GenKeyArgs`, `KeyCheckResult`
- Implemented handlers:
  - `handle_gen_key()` - Generate/reuse key with certificate
  - `handle_set_cert_path()` - Update certificate path
  - `handle_print_cert()` - Read certificate
  - `handle_api_register()` - Register with server
  - `handle_api_ready()` - Announce ready socket
  - `handle_api_lookup()` - Lookup peers

⏳ **Next Steps:**
- Gradually refactor CLI commands in `main.rs::run_cli()` to use handlers
- Gradually refactor Tauri commands to use handlers
- Add unit tests for each handler

## Integration Pattern

### For CLI Commands (in `src/main.rs` in `run_cli()`)

```rust
use crate::handlers::{GenKeyArgs, handle_gen_key};

// Replace inline "gen-key" implementation with:
"gen-key" => {
    let args = GenKeyArgs {
        email: email.to_string(),
        password: _password,
        bits: _bits,
        alg: alg,
        reuse_key: reuse,
    };
    
    match async_runtime::block_on(handle_gen_key(args, &state)) {
        Ok(result) => {
            println!("Private key: {}", result.private_key_path);
            println!("Certificate: {}", result.cert_pem_path);
        }
        Err(e) => println!("Error: {}", e),
    }
}
```

### For Tauri Commands (in `src/main.rs` as `#[tauri::command]`)

```rust
use crate::handlers::{GenKeyArgs, handle_gen_key};

#[tauri::command]
async fn ui_generate_user_keys_and_cert(
    args: GenerateArgs,
    state: State<'_, AppState>,
) -> Result<KeyCheckResult, String> {
    let handler_args = GenKeyArgs {
        email: args.email,
        password: args.password,
        bits: args.bits,
        alg: args.alg.unwrap_or_else(|| "ecdsa".to_string()),
        reuse_key: false,
    };
    
    handle_gen_key(handler_args, &state).await
}
```

## Handler Signatures

### `handle_gen_key(args, state) -> Result<KeyCheckResult, String>`
Generates a new key/certificate or reuses an existing key based on `args.reuse_key`.

**Params:**
- `args: GenKeyArgs` - Email, algorithm, bits, password, reuse flag
- `state: &AppState` - For config management

**Returns:**
- Success: `KeyCheckResult` with paths to private key and certificate
- Error: String error message

### `handle_set_cert_path(path, state) -> Result<String, String>`
Updates the certificate path in configuration.

### `handle_print_cert(state) -> Result<String, String>`
Returns the certificate PEM content.

### `handle_api_register(base_url, state) -> Result<String, String>`
Registers certificate with server.

### `handle_api_ready(base_url, local_ip, remote_ip, port, state) -> Result<String, String>`
Announces ready socket to server.

### `handle_api_lookup(base_url, email, minutes, state) -> Result<String, String>`
Looks up peer sockets by email.

## Benefits of This Pattern

1. **Single Source of Truth:** Business logic implemented once, called from anywhere
2. **Code Reuse:** CLI and UI both use same implementation
3. **Easier Testing:** Handler functions are testable in isolation
4. **Type Safety:** Structured arguments and returns instead of string parsing
5. **Consistency:** CLI and UI behavior automatically synchronized

## Testing Strategy

### Unit Tests (in `handlers.rs`)
```rust
#[test]
fn test_handle_gen_key_new() {
    // Test generating new key
}

#[test]
fn test_handle_gen_key_reuse() {
    // Test reusing existing key
}
```

### Integration Tests (CLI)
Use existing `scripts/cli-e2e.sh` to test CLI commands end-to-end.

### Integration Tests (UI)
Use WebdriverIO e2e tests to verify UI features call handlers correctly.

## Migration Priority

**High Priority (Frequently Used):**
1. `handle_gen_key` - Certificate generation is essential
2. `handle_api_register` - Server registration is essential

**Medium Priority:**
3. `handle_api_ready` - Broadcast to server
4. `handle_api_lookup` - Peer discovery

**Lower Priority (Admin Functions):**
5. `handle_set_cert_path` - Configuration
6. `handle_print_cert` - Debugging

## Implementation Roadmap

### Phase 1: Foundation (✅ Done)
- Create `handlers.rs` module
- Implement basic handler signatures
- Commit to git

### Phase 2: CLI Integration (Next)
- Update `run_cli()` in `main.rs` to call handlers
- Test CLI commands still work
- Commit incremental changes

### Phase 3: Tauri Integration (After Phase 2)
- Update `api_register` command to call handler
- Update `api_ready` command to call handler
- Update `api_lookup` command to call handler
- Test UI still works

### Phase 4: Extended Coverage (Future)
- Add remaining handlers for other CLI commands
- Add peer management (allow, deny, allow-auto)
- Add listener management (start-listener)
- Add chat send operations

## Notes for Future Developers

- **HTTP Requests:** Some handlers need to make HTTP calls. These should use the `reqwest` client already available in Cargo.toml.
- **Async Context:** All handlers are async. CLI code uses `async_runtime::block_on()` to call them.
- **State Management:** Handlers take `&AppState` for configuration and state management.
- **Error Handling:** Handlers return `Result<T, String>` for simple error propagation.

## Related Files

- `src/handlers.rs` - Shared handler implementations
- `src/lib.rs` - Library module declaration (exports `pub mod handlers`)
- `src/main.rs` - CLI and Tauri command entry points (to be refactored)
- `src/cli/commands.rs` - CLI command enum (separate from handlers)
