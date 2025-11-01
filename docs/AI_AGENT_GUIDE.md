# AI Agent Reference Guide

This document provides guidance for AI agents working on this project.

## Quick Navigation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Project overview, features, getting started |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Design decisions, architecture patterns |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Development setup and common tasks |
| [API.md](API.md) | Complete API reference for all components |

## Project Structure at a Glance

```
Cargo.toml (workspace root)
├── crates/
│   ├── fabric-core/          ← SHARED LIBRARY - All business logic
│   └── fabric-cli/           ← CLI using shared library
└── src-tauri/               ← Desktop UI using shared library
    ├── app/                 ← Next.js pages
    ├── components/          ← React components
    ├── lib/                 ← API bindings, state
    └── src-tauri/           ← Tauri backend (Rust)
```

## Critical Rule

**ALL major functionality must be in `crates/fabric-core/lib.rs`**

- ✅ DO: Add business logic to `crates/fabric-core/src/`
- ✅ DO: Use it from both CLI and UI
- ❌ DON'T: Duplicate code between CLI and UI
- ❌ DON'T: Put domain logic in UI components

## Adding a Feature

### Step 1: Add to Shared Library

```rust
// crates/fabric-core/src/fabric.rs
pub async fn new_feature(&self) -> Result<Data> {
    // Implementation here
}
```

### Step 2: Export from lib.rs

```rust
// crates/fabric-core/src/lib.rs
pub mod new_module;  // If new file
// OR it's already public in existing module
```

### Step 3: Use in CLI

```rust
// crates/fabric-cli/src/main.rs
use fabric_core::new_module;

#[derive(Subcommand)]
enum Commands {
    NewFeature { #[arg(short, long)] param: String }
}
```

### Step 4: Expose via Tauri

```rust
// src-tauri/src-tauri/src/main.rs
#[tauri::command]
async fn new_feature(param: String) -> Result<Value, String> {
    fabric_core::new_feature(param).await
        .map(|data| serde_json::to_value(data).unwrap())
        .map_err(|e| e.to_string())
}
```

### Step 5: Use in React

```typescript
// src-tauri/components/NewFeature.tsx
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('new_feature', { param: 'value' });
```

## Testing Requirements

Before submitting code:

```bash
# 1. Run Rust tests
cargo test -p fabric-core
cargo test -p fabric-cli

# 2. Run component tests
cd src-tauri && npm run test

# 3. Run E2E tests
npm run cypress:run

# 4. Build successfully
npm run tauri:build
```

## Key Files to Understand

### Entry Points
- **CLI**: `crates/fabric-cli/src/main.rs` - Parse commands, show output
- **UI**: `src-tauri/app/page.tsx` - React root component
- **Backend**: `src-tauri/src-tauri/src/main.rs` - Tauri command handlers
- **Library**: `crates/fabric-core/src/lib.rs` - All domain logic

### Domain Models
- `CryptoManager` - Key/certificate operations
- `FabricNetworkClient` - Blockchain interaction
- `WebTorrentClient` - File sharing
- `FabricIdentity` - User credentials
- `FabricChannel` - Blockchain channels
- `TorrentDownload` - Download tracking

### UI Components
- `KeyManagement.tsx` - Key generation
- `NetworkConnection.tsx` - Connect to network
- `ChannelBrowser.tsx` - Browse channels
- `TorrentManager.tsx` - Download manager

## Common Tasks

### Debug a Component
```typescript
// Add console logs to component
console.log('State:', useAppStore.getState());

// Run Cypress debug
npx cypress open

// Check browser console (Tauri window)
// Press F12 in running app
```

### Add a New Command to CLI
```rust
// 1. Add to enum
enum Commands { NewCmd { #[arg(short)] param: String } }

// 2. Add handler
async fn handle_new_cmd(param: String) -> Result<(), Box<dyn Error>> {
    let result = fabric_core::new_feature(param).await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
```

### Add New React Component
```typescript
// Create file: src-tauri/components/NewComponent.tsx
'use client';

import { invoke } from '@tauri-apps/api/tauri';

export default function NewComponent() {
  return <div>Component UI</div>;
}
```

### Test the Torrent System
```bash
# Add a test torrent
cargo run --bin fabric -- torrent add \
  --torrent "magnet:?xt=urn:btih:test" \
  --output ~/downloads

# Check progress
cargo run --bin fabric -- torrent progress --hash test

# List downloads
cargo run --bin fabric -- torrent list
```

## Error Handling Pattern

```rust
// Return error with context
if let Err(e) = some_operation() {
    return Err(FabricCoreError::OperationError(
        format!("Operation failed: {}", e)
    ));
}

// In CLI
Err(e) => eprintln!("{}", "ERROR".red());

// In UI (via Tauri)
.map_err(|e| e.to_string())
```

## Environment Variables

```bash
# Set for development
export RUST_LOG=debug
export FABRIC_GATEWAY=https://api.kaleido.io
export FABRIC_CA_URL=https://ca.kaleido.io

# Run with logging
RUST_LOG=debug npm run tauri:dev
```

## Performance Considerations

### Frontend
- Use `React.memo()` for expensive components
- Lazy load channels in ChannelBrowser
- Debounce search queries
- Cache torrent progress data

### Backend
- Async/await for I/O operations
- Connection pooling for network requests
- Batch chaincode queries where possible
- Stream file downloads instead of loading in memory

## Security Best Practices

- Private keys never stored in plaintext
- Certificates validated against CA before use
- Transactions signed client-side before transmission
- Torrent data verified against blockchain hash
- CORS configured properly in Tauri

## Debugging Tips

### Rust Issues
```bash
# Get detailed error messages
RUST_BACKTRACE=1 cargo test

# Check specific test
cargo test -p fabric-core specific_test_name -- --nocapture
```

### TypeScript Issues
```bash
# Type checking
npx tsc --noEmit

# Check for unused vars
npm run lint
```

### Tauri Issues
```bash
# Inspect backend
// Press F12 in running app

# Check Rust console output
npm run tauri:dev 2>&1 | grep -i error

# Verify command registration
// All #[tauri::command] functions must be in generate_handler![]
```

## Common Patterns

### Async Operations in Components
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleAction = async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await invoke('command_name', { params });
    // Handle result
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### State Management
```typescript
// Use Zustand for app-wide state
const { connected, setConnected } = useAppStore();

// Use local state for component-specific data
const [localData, setLocalData] = useState(null);
```

### Error Propagation
```rust
// In library - return Result
fn operation() -> Result<Data> {
    something.map_err(|e| 
        FabricCoreError::OperationError(e.to_string())
    )?
}

// In CLI - handle with context
operation().map_err(|e| {
    eprintln!("Failed: {}", e);
    e
})?

// In Tauri - convert to string
operation().map_err(|e| e.to_string())
```

## References for Different Tasks

| Task | File/Module |
|------|------------|
| Add key generation feature | `crates/fabric-core/src/crypto.rs` |
| Connect to new network | `crates/fabric-core/src/fabric.rs` |
| Add torrent capability | `crates/fabric-core/src/torrent.rs` |
| Add CLI command | `crates/fabric-cli/src/main.rs` |
| Add Tauri command | `src-tauri/src-tauri/src/main.rs` |
| Create React component | `src-tauri/components/*.tsx` |
| Add API binding | `src-tauri/lib/api.ts` |
| Add tests | `crates/*/tests/` or `src-tauri/__tests__/` |

## Integration Checklist

Before merging a feature:

- [ ] Code added to shared library (`fabric-core`)
- [ ] CLI command created/updated
- [ ] Tauri command handler created/updated
- [ ] React component created/updated
- [ ] Unit tests written for Rust code
- [ ] Component tests written for React
- [ ] E2E test added to Cypress
- [ ] Error handling in place
- [ ] Documentation updated
- [ ] All tests pass: `cargo test && npm run test && npm run cypress:run`

## Quick Commands

```bash
# Development
npm run tauri:dev              # Run desktop app

# Testing
cargo test                     # All Rust tests
npm run test                   # All component tests
npm run cypress:run            # All E2E tests

# Building
cargo build --release          # Release Rust build
npm run tauri:build            # Build desktop app

# Formatting
cargo fmt                      # Format Rust
npm run lint                   # Lint TypeScript
```

## Getting Help

1. **Check existing code** - Look at similar features
2. **Read ARCHITECTURE.md** - Understand design decisions
3. **Read API.md** - Understand function signatures
4. **Search tests** - See how features are tested
5. **Check git history** - See how features were implemented

## Contact & Support

For implementation questions, refer to:
- Architecture decisions: `ARCHITECTURE.md`
- API reference: `API.md`
- Development setup: `DEVELOPMENT.md`
- Feature examples: Look at existing implementations
