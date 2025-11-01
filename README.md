# Fabric Desktop Client

A modern Hyperledger Fabric desktop client built with Rust, Tauri, Next.js, and WebTorrent. This application enables users to interact with distributed ledger networks, manage cryptographic identities, browse blockchain data, and participate in peer-to-peer file sharing.

## Architecture Overview

### Project Structure

```
.
├── Cargo.toml                          # Workspace root configuration
├── crates/
│   ├── fabric-core/                    # Shared Rust library
│   │   ├── src/
│   │   │   ├── lib.rs                  # Library entry point
│   │   │   ├── error.rs                # Error types
│   │   │   ├── crypto.rs               # Key management & cryptography
│   │   │   ├── fabric.rs               # Hyperledger Fabric integration
│   │   │   └── torrent.rs              # WebTorrent protocol
│   │   └── Cargo.toml
│   └── fabric-cli/                     # CLI client application
│       ├── src/
│       │   └── main.rs                 # CLI entry point with commands
│       └── Cargo.toml
├── src-tauri/                          # Tauri + Next.js desktop application
│   ├── package.json                    # Frontend dependencies
│   ├── next.config.ts                  # Next.js configuration
│   ├── tsconfig.json                   # TypeScript configuration
│   ├── jest.config.ts                  # Jest testing configuration
│   ├── cypress.config.ts               # Cypress E2E testing
│   ├── app/
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Home page
│   │   └── globals.css                 # Global styles
│   ├── components/
│   │   ├── KeyManagement.tsx           # Key generation & import
│   │   ├── NetworkConnection.tsx       # Network connection UI
│   │   ├── ChannelBrowser.tsx          # Channel and content browser
│   │   └── TorrentManager.tsx          # Torrent management UI
│   ├── lib/
│   │   ├── api.ts                      # Tauri command bindings
│   │   └── store.ts                    # Zustand state management
│   ├── __tests__/                      # Component tests
│   │   └── KeyManagement.test.tsx
│   ├── cypress/
│   │   └── e2e/
│   │       └── app.cy.ts               # E2E tests
│   └── src-tauri/
│       ├── Cargo.toml                  # Rust backend dependencies
│       ├── src/
│       │   ├── main.rs                 # Tauri backend entry point
│       │   └── build.rs                # Build script
│       └── tauri.conf.json             # Tauri configuration
└── README.md                           # This file
```

## Key Features

### 1. Identity & Key Management
- **Generate new keypairs** (ECDSA)
- **Import existing certificates** (X.509 PEM format)
- **Manage multiple identities** per organization
- **Secure local storage** of credentials
- **Certificate validation** against CA

**Use Case Flow:**
```
Generate/Import Keys → Validate → Save Identity → Load for Network Access
```

### 2. Hyperledger Fabric Network Integration
- **Auto-connect to Kaleido** (default on startup)
- **Multi-channel support**: Movies, TV Shows, Games, Voting
- **Query and invoke** chaincode functions
- **Transaction tracking** and history
- **RESTful API** via Tauri bridges to Rust backend

**Channels:**
- `movies` - Movie database with torrent hashes
- `tv-shows` - TV series with streaming data
- `games` - Game database with multiplayer info
- `voting` - Consensus and voting mechanisms

### 3. Channel Browser UI
- **Grid-based channel selection** (left panel)
- **Large content viewing area** (right panel)
- **Real-time content search** and filtering
- **Per-channel chaincode invocation**
- **Community-contributed content** display

### 4. Distributed File Sharing via WebTorrent
- **Torrent protocol support** for P2P file distribution
- **Magnet link** handling and parsing
- **DHT peer discovery** across the network
- **Download progress tracking** with real-time updates
- **Streaming support** for partial downloads
- **Multi-file torrent** support
- **Pause/Resume** functionality

**Flow:**
```
Blockchain Torrent Hash → Magnet Link → DHT Search → Peer Connection → Download/Stream
```

## Technology Stack

### Backend (Rust)
- **Tokio** - Async runtime
- **Tauri** - Desktop framework
- **Fabric-Protobuf** - Hyperledger Fabric bindings
- **OpenSSL/Ring** - Cryptography
- **WebTorrent** - Torrent protocol implementation
- **Serde** - Serialization

### Frontend (Next.js)
- **React 18** - UI library
- **Next.js 14** - Framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Hook Form** - Form handling
- **Axios** - HTTP client

### Testing
- **Cypress** - E2E testing
- **Jest** - Unit testing
- **@testing-library/react** - Component testing
- **WebDriver** - Desktop app testing (via Tauri)

## Getting Started

### Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js and npm
node >= 18.0.0
npm >= 9.0.0

# Tauri CLI
cargo install tauri-cli
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd fabric-desktop

# Install Node dependencies (frontend)
cd src-tauri
npm install

# Build the project (from root)
cd ..
npm run tauri:build

# Development
npm run tauri:dev
```

### Running the CLI

```bash
# Key management commands
cargo run --bin fabric -- key generate --output ~/fabric-identity.json
cargo run --bin fabric -- key import --cert ~/path/to/cert.pem --user-id admin --org Org1

# Network commands
cargo run --bin fabric -- network connect \
  --gateway https://api.kaleido.io \
  --ca https://ca.kaleido.io \
  --identity ~/fabric-identity.json

cargo run --bin fabric -- network channels \
  --gateway https://api.kaleido.io \
  --identity ~/fabric-identity.json

# Chaincode operations
cargo run --bin fabric -- chaincode query \
  --channel movies \
  --chaincode movie-chaincode \
  --function queryAll

# Torrent operations
cargo run --bin fabric -- torrent add \
  --torrent "magnet:?xt=urn:btih:..." \
  --output ~/downloads

cargo run --bin fabric -- torrent list
cargo run --bin fabric -- torrent progress --hash abc123def456
```

## Use Cases

### Use Case 1: Discovering Content
1. Generate or import user identity
2. Auto-connect to Hyperledger network
3. View all available channels
4. Select a channel (e.g., Movies)
5. Browse community-contributed content
6. View torrent metadata

### Use Case 2: Downloading Content via Torrent
1. Select content with torrent hash on blockchain
2. Application extracts magnet link
3. Initiates torrent download via WebTorrent
4. Connects to peer nodes in the network
5. Streams or downloads to local storage
6. Seeds content for other peers

### Use Case 3: Contributing New Content
1. Prepare content and generate torrent
2. Create submission form per channel
3. Fill in metadata (title, description, etc.)
4. Sign transaction with private key
5. Submit via chaincode invoke
6. Chaincode validates structure
7. Content added to ledger
8. Community can now discover it

### Use Case 4: Voting on Content
1. Connect to voting channel
2. Query pending votes
3. Submit vote transaction
4. Weighted by identity/stake
5. Results tallied on ledger

## Development Guide

### Code Organization

**Shared Library (`crates/fabric-core`)**

The `lib.rs` contains all core business logic shared between CLI and UI:

```rust
// Key modules
pub mod crypto;      // CryptoManager, FabricIdentity
pub mod fabric;      // KaleidoFabricClient, FabricNetworkClient trait
pub mod torrent;     // WebTorrentClient, TorrentHash, DownloadStatus
pub mod error;       // FabricCoreError, Result<T>
```

**Rule: All major functionality must be in this library!**

**CLI (`crates/fabric-cli`)**

The CLI uses `clap` for command-line argument parsing:

```bash
fabric key generate --output ~/identity.json
fabric network connect --gateway ... --identity ...
fabric torrent add --torrent "magnet:..." --output ~/downloads
```

**UI (`src-tauri/`)**

React components call Tauri commands which invoke Rust backend:

```typescript
// Component
const result = await invoke('generate_keypair');

// Tauri Backend (main.rs)
#[tauri::command]
async fn generate_keypair() -> Result<serde_json::Value, String> { ... }

// Calls shared library
CryptoManager::generate_keypair()?
```

### Adding a New Feature

Example: Add support for searching content by name

1. **Add to shared library** (`crates/fabric-core/src/fabric.rs`):
```rust
pub async fn query_by_name(
    &self,
    channel_id: &str,
    search_term: &str,
) -> Result<Vec<ContentItem>> { ... }
```

2. **Add CLI command** (`crates/fabric-cli/src/main.rs`):
```rust
#[derive(Subcommand)]
enum ChaincodeCommands {
    Search {
        #[arg(short, long)]
        channel: String,
        #[arg(short, long)]
        query: String,
    },
}
```

3. **Add Tauri command** (`src-tauri/src-tauri/src/main.rs`):
```rust
#[tauri::command]
async fn search_content(
    channel_id: String,
    query: String,
) -> Result<serde_json::Value, String> { ... }
```

4. **Add React component** (`src-tauri/components/SearchComponent.tsx`):
```tsx
const results = await invoke('search_content', {
  channel_id: channel,
  query: searchTerm,
});
```

## Testing

### Component Tests (Jest)

```bash
# Run all component tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test file location:** `src-tauri/__tests__/*.test.tsx`

Example test (`src-tauri/__tests__/KeyManagement.test.tsx`):

```typescript
describe('KeyManagement Component', () => {
  it('generates a keypair when button is clicked', async () => {
    render(<KeyManagement />);
    const button = screen.getByText('Generate New Keypair');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/user1/)).toBeInTheDocument();
    });
  });
});
```

### E2E Tests (Cypress)

```bash
# Open Cypress interactive mode
npm run cypress:open

# Run headless
npm run cypress:run

# Run specific spec
npx cypress run --spec "cypress/e2e/app.cy.ts"
```

**Test file location:** `src-tauri/cypress/e2e/*.cy.ts`

Example E2E test:

```typescript
describe('Fabric Desktop Client E2E Tests', () => {
  it('should navigate to key management', () => {
    cy.visit('/');
    cy.contains('button', 'Keys').click();
    cy.contains('Key Management').should('be.visible');
  });
});
```

### Rust Tests

```bash
# Test shared library
cargo test -p fabric-core

# Test CLI
cargo test -p fabric-cli

# Test with logging
RUST_LOG=debug cargo test

# Integration tests
cargo test --test '*'
```

Example Rust test (`crates/fabric-core/src/crypto.rs`):

```rust
#[test]
fn test_fabric_identity_validation() {
    let identity = FabricIdentity::new(...);
    assert!(identity.validate().is_ok());
}
```

### WebDriver Tests (Tauri Desktop)

Tauri applications can be tested with WebDriver:

```typescript
// Example WebDriver test for Tauri app
describe('Tauri Window Tests', () => {
  it('should create app window', async () => {
    const app = await app.launch();
    const window = await app.getWebContents();
    expect(await window.getTitle()).toBe('Fabric Desktop Client');
  });
});
```

## Building for Production

### Desktop Application

```bash
# Build Tauri app (creates installers)
npm run tauri:build

# Output locations:
# - macOS: src-tauri/target/release/bundle/dmg/
# - Windows: src-tauri/target/release/bundle/msi/
# - Linux: src-tauri/target/release/bundle/deb/
```

### CLI Binary

```bash
# Build optimized CLI binary
cargo build --release -p fabric-cli

# Binary location: target/release/fabric
```

## Configuration

### Network Configuration (Kaleido)

Set environment variables or config file:

```env
FABRIC_GATEWAY=https://api.kaleido.io
FABRIC_CA_URL=https://ca.kaleido.io
FABRIC_ORG_NAME=Org1
FABRIC_MSPID=Org1MSP
```

### Chaincode Definitions

Each channel has an associated chaincode:

```rust
// Define in fabric.rs
pub const CHANNELS: &[(&str, &str, &str)] = &[
    ("movies", "Movie Database", "movie-chaincode"),
    ("tv-shows", "TV Shows", "tvshow-chaincode"),
    ("games", "Games", "game-chaincode"),
    ("voting", "Voting", "voting-chaincode"),
];
```

## Troubleshooting

### Connection Issues

```bash
# Check network connectivity
curl -I https://api.kaleido.io

# Verify TLS certificates
openssl s_client -connect api.kaleido.io:443

# Enable debug logging
RUST_LOG=debug npm run tauri:dev
```

### Build Errors

```bash
# Clean rebuild
cargo clean
npm run tauri:build

# Update dependencies
cargo update
npm update
```

### Torrent Download Stuck

Check peer availability:
```bash
cargo run --bin fabric -- torrent peers --hash <hash>
```

## API Reference

### Rust Library

#### CryptoManager

```rust
pub struct CryptoManager;

impl CryptoManager {
    pub fn generate_keypair() -> Result<(String, String)>;
    pub fn verify_certificate(cert_pem: &str, ca_cert_pem: &str) -> Result<bool>;
    pub fn sign(private_key_pem: &str, data: &[u8]) -> Result<Vec<u8>>;
    pub fn verify(public_key_pem: &str, data: &[u8], signature: &[u8]) -> Result<bool>;
}
```

#### FabricNetworkClient

```rust
#[async_trait]
pub trait FabricNetworkClient: Send + Sync {
    async fn connect(&mut self, identity: &FabricIdentity) -> Result<()>;
    async fn disconnect(&mut self) -> Result<()>;
    async fn get_channels(&self) -> Result<Vec<FabricChannel>>;
    async fn query_chaincode(...) -> Result<serde_json::Value>;
    async fn invoke_chaincode(...) -> Result<TransactionResult>;
    async fn get_transaction_history(...) -> Result<Vec<TransactionResult>>;
}
```

#### WebTorrentClient

```rust
pub struct WebTorrentClient;

impl WebTorrentClient {
    pub async fn init(&mut self) -> Result<()>;
    pub async fn shutdown(&mut self) -> Result<()>;
    pub async fn add_torrent(&mut self, hash: TorrentHash, path: PathBuf) -> Result<()>;
    pub fn get_download_progress(&self, hash: &TorrentHash) -> Result<TorrentDownload>;
    pub async fn pause_download(&mut self, hash: &TorrentHash) -> Result<()>;
    pub async fn resume_download(&mut self, hash: &TorrentHash) -> Result<()>;
    pub async fn search_peers(&self, hash: &TorrentHash) -> Result<Vec<String>>;
}
```

### Tauri Commands

All commands are async and return `Result<serde_json::Value, String>`:

```typescript
// Key Management
invoke('generate_keypair')
invoke('load_identity', { path })
invoke('save_identity', { path, identity })

// Network
invoke('connect_network', { gateway, ca_url, identity_json })
invoke('get_channels')

// Chaincode
invoke('query_chaincode', { channel_id, chaincode_id, function, args })
invoke('invoke_chaincode', { channel_id, chaincode_id, function, args })

// Torrent
invoke('add_torrent', { magnet_link, output_path })
invoke('get_torrent_progress', { hash })
```

## Contributing

### Guidelines

1. **Keep components small** - Break UI into focused, reusable pieces
2. **Share logic in lib.rs** - All business logic goes in the shared library
3. **Write tests** - All components and functions should have tests
4. **Document code** - Use doc comments for public APIs
5. **Follow conventions** - Use naming patterns from existing code

### Pull Request Process

1. Create feature branch: `git checkout -b feature/description`
2. Write tests for new functionality
3. Update README if adding features
4. Run test suite: `npm run test && cargo test`
5. Submit PR with description

## Security Considerations

- **Private keys** are never transmitted over the network
- **Certificates** are validated against CA before use
- **Transactions** are signed client-side before transmission
- **Torrent downloads** are from verified peer nodes only
- **Secrets** are stored in secure local storage (OS keychain support planned)

## Performance Optimization

- **Lazy loading** of channel content
- **Virtual scrolling** for large content lists
- **Efficient torrent chunking** via WebTorrent
- **Rust async/await** for non-blocking I/O
- **Next.js incremental static regeneration** for fast page loads

## Future Enhancements

- [ ] OS keychain integration for key storage
- [ ] WebRTC peer-to-peer communication
- [ ] Multi-signature transaction support
- [ ] Smart contract editor and deployment
- [ ] Real-time blockchain event subscriptions
- [ ] Cross-platform mobile app (React Native)
- [ ] Hardware wallet support (Ledger, Trezor)
- [ ] Advanced analytics dashboard
- [ ] Channel auditing and compliance tools
- [ ] Governance/voting mechanisms

## License

[Specify your license here]

## Support

For issues, questions, or feature requests, please open a GitHub issue.

---

**Last Updated:** November 2025
**Version:** 0.1.0 (Alpha)
