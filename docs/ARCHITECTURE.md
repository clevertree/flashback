# Architecture Decision Records

## ADR-001: Workspace Structure

### Decision
Use Rust workspace with three members: `fabric-core` (shared library), `fabric-cli` (CLI), and `src-tauri` (desktop app).

### Rationale
- Shared library (`fabric-core`) ensures consistency between CLI and UI
- Separate compilation units improve build times
- Clear separation of concerns
- Easy to add additional clients (mobile, web, etc.)

### Implementation
```toml
[workspace]
members = ["crates/fabric-core", "crates/fabric-cli", "src-tauri"]
```

---

## ADR-002: Tauri + Next.js for Desktop

### Decision
Use Tauri (Rust-based) with Next.js frontend instead of Electron.

### Rationale
- Tauri is significantly lighter than Electron (30MB vs 150MB+)
- Rust backend provides strong type safety
- Next.js enables modern React development
- Better OS integration (native APIs)
- Smaller application bundle size

### Tradeoffs
- Learning curve for Rust + Tauri combination
- Fewer community examples than Electron
- Mitigation: Good documentation and clear error messages

---

## ADR-003: Zustand for State Management

### Decision
Use Zustand instead of Redux or Context API.

### Rationale
- Minimal boilerplate
- Simple API for global state
- Small bundle size (~600 bytes)
- Perfect for medium-complexity apps
- DevTools support available

### Example Store
```typescript
export const useAppStore = create((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}));
```

---

## ADR-004: Tailwind CSS for Styling

### Decision
Use Tailwind CSS with utility-first approach.

### Rationale
- Rapid UI development
- Consistent design system
- Dark mode support built-in
- Smaller CSS bundle with PurgeCSS
- Better than traditional CSS-in-JS for desktop apps

---

## ADR-005: Hyperledger Fabric via Gateway Pattern

### Decision
Interact with Hyperledger Fabric through the Kaleido gateway API rather than direct node communication.

### Rationale
- Simplified API surface
- No need to manage multiple peer connections
- Built-in security and compliance
- Easier to deploy and maintain
- Kaleido provides a managed service

### Alternative Rejected
Direct fabric-client communication - too complex for desktop app

---

## ADR-006: WebTorrent for Distributed File Transfer

### Decision
Use WebTorrent instead of traditional torrent clients.

### Rationale
- Native Rust bindings available
- Designed for browser/lightweight apps
- DHT support for peer discovery
- Perfect for peer-to-peer content distribution
- Can seed/download partial files

### Example Flow
```
Blockchain Torrent Hash 
→ Extract Magnet Link 
→ WebTorrent Client Search DHT 
→ Connect to Peers 
→ Stream/Download Content
```

---

## ADR-007: Component Testing Strategy

### Decision
Use Jest for unit tests and Cypress for E2E tests.

### Rationale
- Jest: Fast unit testing, snapshot support
- Cypress: Realistic browser automation
- Complements WebDriver tests for Tauri
- Good CI/CD integration

### Test Pyramid
```
    E2E Tests (Cypress)
      /          \
     /            \
   Component      Integration
   Tests (Jest)   Tests
       \            /
        \          /
      Unit Tests (Rust)
```

---

## ADR-008: CLI and UI Share All Business Logic

### Decision
Enforce strict separation: all domain logic in `fabric-core`, CLI/UI are thin clients.

### Rationale
- Single source of truth for business rules
- Easier to maintain consistency
- Enables feature parity between interfaces
- Simplifies testing

### Code Ownership
```
fabric-core   → Domain logic, business rules, APIs
fabric-cli    → Argument parsing, terminal formatting
src-tauri/ui  → React components, styling, navigation
```

---

## ADR-009: Error Handling with thiserror

### Decision
Use `thiserror` crate for error definitions.

### Rationale
- Derives Display and Error traits automatically
- Reduces boilerplate
- Type-safe error chaining
- Better error messages

### Example
```rust
#[derive(Debug, Error)]
pub enum FabricCoreError {
    #[error("Crypto error: {0}")]
    CryptoError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
}
```

---

## ADR-010: Configuration via Environment Variables

### Decision
Use environment variables for configuration (Kaleido URLs, org names, etc).

### Rationale
- Industry standard for cloud-native apps
- Works across platforms
- Easy to secure in CI/CD
- Simple to override for development

### Variables
```
FABRIC_GATEWAY=https://api.kaleido.io
FABRIC_CA_URL=https://ca.kaleido.io
FABRIC_ORG_NAME=Org1
FABRIC_MSPID=Org1MSP
RUST_LOG=debug
```

---

## Decision Log

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| 001 | Workspace Structure | Accepted | 2025-11-01 |
| 002 | Tauri + Next.js | Accepted | 2025-11-01 |
| 003 | Zustand State | Accepted | 2025-11-01 |
| 004 | Tailwind CSS | Accepted | 2025-11-01 |
| 005 | Fabric Gateway | Accepted | 2025-11-01 |
| 006 | WebTorrent | Accepted | 2025-11-01 |
| 007 | Testing Strategy | Accepted | 2025-11-01 |
| 008 | Shared Logic | Accepted | 2025-11-01 |
| 009 | Error Handling | Accepted | 2025-11-01 |
| 010 | Configuration | Accepted | 2025-11-01 |
