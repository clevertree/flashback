# API Documentation

## REST API (Tauri Commands)

All commands are invoked via Tauri's `invoke` function. They return JSON responses or errors.

### Key Management API

#### `generate_keypair()`
Generate a new ECDSA keypair.

**Rust:**
```rust
#[tauri::command]
async fn generate_keypair() -> Result<serde_json::Value, String>
```

**Frontend:**
```typescript
const result = await invoke('generate_keypair');
// Returns:
// {
//   "private_key": "-----BEGIN PRIVATE KEY-----...",
//   "public_key": "-----BEGIN PUBLIC KEY-----..."
// }
```

#### `load_identity(path)`
Load an identity from file.

**Parameters:**
- `path` (string): File path to identity JSON

**Returns:**
```json
{
  "user_id": "user1",
  "org_name": "Org1",
  "mspid": "Org1MSP",
  "certificate": "...",
  "private_key": "...",
  "public_key": "...",
  "ca_certificate": "..."
}
```

#### `save_identity(path, identity)`
Save identity to file.

**Parameters:**
- `path` (string): File path for storage
- `identity` (object): Identity object

**Returns:**
```json
{ "status": "success" }
```

### Network API

#### `connect_network(gateway, ca_url, identity_json)`
Connect to Hyperledger Fabric network.

**Parameters:**
- `gateway` (string): Kaleido gateway URL
- `ca_url` (string): Certificate Authority URL
- `identity_json` (object): User identity

**Returns:**
```json
{
  "status": "connected",
  "gateway": "https://api.kaleido.io"
}
```

#### `get_channels()`
Retrieve all channels from network.

**Returns:**
```json
{
  "channels": [
    {
      "id": "movies",
      "name": "Movies",
      "description": "Movie database and torrent hashes",
      "chaincode_id": "movie-chaincode"
    },
    ...
  ]
}
```

### Chaincode API

#### `query_chaincode(channel_id, chaincode_id, function, args)`
Query chaincode (read-only).

**Parameters:**
- `channel_id` (string): Channel ID
- `chaincode_id` (string): Chaincode ID
- `function` (string): Function name to invoke
- `args` (string[]): Function arguments

**Returns:**
```json
{
  "status": "success",
  "results": [...]
}
```

**Example:**
```typescript
const result = await invoke('query_chaincode', {
  channel_id: 'movies',
  chaincode_id: 'movie-chaincode',
  function: 'queryAll',
  args: []
});
```

#### `invoke_chaincode(channel_id, chaincode_id, function, args)`
Invoke chaincode (write/modify state).

**Parameters:** (same as query_chaincode)

**Returns:**
```json
{
  "transaction_id": "uuid-4f1a3f...",
  "status": "SUCCESS",
  "payload": {...},
  "timestamp": "2025-11-01T12:34:56.789Z"
}
```

### Torrent API

#### `add_torrent(magnet_link, output_path)`
Add a torrent for download.

**Parameters:**
- `magnet_link` (string): Magnet link or info hash
- `output_path` (string): Download destination

**Returns:**
```json
{
  "hash": "abc123def456...",
  "status": "added",
  "output_path": "/downloads"
}
```

#### `get_torrent_progress(hash)`
Get download progress for a torrent.

**Parameters:**
- `hash` (string): Torrent info hash

**Returns:**
```json
{
  "hash": "abc123def456...",
  "progress": 0.35,
  "status": "Downloading",
  "peers": 12,
  "download_speed": 2048000
}
```

---

## CLI API

### Key Management Commands

```bash
fabric key generate [OPTIONS]
  --output <PATH>    Save identity to file

fabric key import [OPTIONS]
  --cert <PATH>      Certificate file path
  --user-id <ID>     Enrollment ID
  --org <NAME>       Organization name

fabric key list [OPTIONS]
  --dir <PATH>       Directory with identities

fabric key show [OPTIONS]
  --identity <PATH>  Path to identity file
```

### Network Commands

```bash
fabric network connect [OPTIONS]
  --gateway <URL>     Kaleido gateway URL
  --ca <URL>          CA URL
  --identity <PATH>   Identity file

fabric network channels [OPTIONS]
  --gateway <URL>     Kaleido gateway URL
  --identity <PATH>   Identity file

fabric network info [OPTIONS]
  --gateway <URL>     Kaleido gateway URL
```

### Chaincode Commands

```bash
fabric chaincode query [OPTIONS]
  --channel <ID>       Channel ID
  --chaincode <ID>     Chaincode ID
  --function <NAME>    Function to call
  --args <JSON>        Arguments in JSON format

fabric chaincode invoke [OPTIONS]
  --channel <ID>       Channel ID
  --chaincode <ID>     Chaincode ID
  --function <NAME>    Function to call
  --args <JSON>        Arguments in JSON format
```

### Torrent Commands

```bash
fabric torrent add [OPTIONS]
  --torrent <LINK>    Magnet link or hash
  --output <PATH>     Download directory

fabric torrent list

fabric torrent progress [OPTIONS]
  --hash <HASH>       Torrent info hash

fabric torrent pause [OPTIONS]
  --hash <HASH>       Torrent info hash

fabric torrent resume [OPTIONS]
  --hash <HASH>       Torrent info hash

fabric torrent peers [OPTIONS]
  --hash <HASH>       Torrent info hash
```

---

## Rust Library API

### CryptoManager

```rust
pub struct CryptoManager;

impl CryptoManager {
    /// Generate a new ECDSA keypair
    pub fn generate_keypair() -> Result<(String, String)>;
    
    /// Verify a certificate against CA
    pub fn verify_certificate(
        cert_pem: &str,
        ca_cert_pem: &str,
    ) -> Result<bool>;
    
    /// Sign data with private key
    pub fn sign(private_key_pem: &str, data: &[u8]) -> Result<Vec<u8>>;
    
    /// Verify signature with public key
    pub fn verify(
        public_key_pem: &str,
        data: &[u8],
        signature: &[u8],
    ) -> Result<bool>;
    
    /// Import certificate from PEM
    pub fn import_certificate_from_pem(
        pem_path: &Path,
    ) -> Result<String>;
    
    /// Export public key to PEM
    pub fn export_public_key_pem(key_bytes: &[u8]) -> Result<String>;
}
```

### FabricNetworkClient (Trait)

```rust
#[async_trait]
pub trait FabricNetworkClient: Send + Sync {
    /// Connect to network
    async fn connect(&mut self, identity: &FabricIdentity) -> Result<()>;
    
    /// Disconnect from network
    async fn disconnect(&mut self) -> Result<()>;
    
    /// Get all channels
    async fn get_channels(&self) -> Result<Vec<FabricChannel>>;
    
    /// Query chaincode (read-only)
    async fn query_chaincode(
        &self,
        channel_id: &str,
        chaincode_id: &str,
        function: &str,
        args: Vec<String>,
    ) -> Result<serde_json::Value>;
    
    /// Invoke chaincode (transaction)
    async fn invoke_chaincode(
        &self,
        channel_id: &str,
        chaincode_id: &str,
        function: &str,
        args: Vec<String>,
    ) -> Result<TransactionResult>;
    
    /// Get transaction history
    async fn get_transaction_history(
        &self,
        channel_id: &str,
        chaincode_id: &str,
    ) -> Result<Vec<TransactionResult>>;
}
```

### WebTorrentClient

```rust
pub struct WebTorrentClient;

impl WebTorrentClient {
    pub fn new() -> Self;
    
    /// Initialize client
    pub async fn init(&mut self) -> Result<()>;
    
    /// Shutdown client
    pub async fn shutdown(&mut self) -> Result<()>;
    
    /// Add torrent for download
    pub async fn add_torrent(
        &mut self,
        torrent_hash: TorrentHash,
        output_path: PathBuf,
    ) -> Result<()>;
    
    /// Get download progress
    pub fn get_download_progress(
        &self,
        torrent_hash: &TorrentHash,
    ) -> Result<TorrentDownload>;
    
    /// Pause download
    pub async fn pause_download(&mut self, torrent_hash: &TorrentHash) -> Result<()>;
    
    /// Resume download
    pub async fn resume_download(&mut self, torrent_hash: &TorrentHash) -> Result<()>;
    
    /// Get all downloads
    pub fn get_downloads(&self) -> Vec<TorrentDownload>;
    
    /// Search DHT for peers
    pub async fn search_peers(&self, torrent_hash: &TorrentHash) -> Result<Vec<String>>;
    
    /// Stream completed file
    pub async fn stream_file(&self, torrent_hash: &TorrentHash) -> Result<Vec<u8>>;
}
```

### Error Types

```rust
#[derive(Debug, Error)]
pub enum FabricCoreError {
    #[error("Cryptography error: {0}")]
    CryptoError(String),
    
    #[error("Hyperledger Fabric error: {0}")]
    FabricError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Torrent error: {0}")]
    TorrentError(String),
    
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    #[error("Connection error: {0}")]
    ConnectionError(String),
    
    #[error("Channel error: {0}")]
    ChannelError(String),
    
    #[error("Key management error: {0}")]
    KeyManagementError(String),
}

pub type Result<T> = std::result::Result<T, FabricCoreError>;
```

---

## Data Models

### FabricIdentity

```typescript
interface FabricIdentity {
  user_id: string;
  org_name: string;
  mspid: string;
  certificate: string;           // X.509 PEM format
  private_key: string;            // ECDSA PEM format
  public_key: string;             // ECDSA PEM format
  ca_certificate: string;         // CA cert PEM format
}
```

### FabricChannel

```typescript
interface FabricChannel {
  id: string;                      // Unique channel identifier
  name: string;                    // Display name
  description: string;             // Purpose/description
  chaincode_id: string;            // Associated chaincode
}
```

### TorrentDownload

```typescript
interface TorrentDownload {
  torrent_hash: TorrentHash;       // Hash reference
  file_path: string;               // Local path
  progress: number;                // 0.0 to 1.0
  status: "Pending" | "Downloading" | "Paused" | "Completed" | "Failed";
  peers: number;                   // Connected peers
  download_speed: number;          // Bytes per second
}
```

---

## Examples

### Generate Keys and Connect to Network

**TypeScript:**
```typescript
import { invoke } from '@tauri-apps/api/tauri';

// 1. Generate keypair
const keys = await invoke('generate_keypair');

// 2. Create identity
const identity = {
  user_id: 'admin',
  org_name: 'Org1',
  mspid: 'Org1MSP',
  certificate: keys.certificate,
  private_key: keys.private_key,
  public_key: keys.public_key,
  ca_certificate: 'CA_CERT_HERE'
};

// 3. Connect to network
const result = await invoke('connect_network', {
  gateway: 'https://api.kaleido.io',
  ca_url: 'https://ca.kaleido.io',
  identity_json: identity
});

console.log(result); // { status: "connected" }
```

### Query Chaincode

```typescript
const result = await invoke('query_chaincode', {
  channel_id: 'movies',
  chaincode_id: 'movie-chaincode',
  function: 'queryByTitle',
  args: ['Inception']
});

console.log(result.results); // Array of movie records
```

### Download Torrent

```typescript
// 1. Add torrent
const torrent = await invoke('add_torrent', {
  magnet_link: 'magnet:?xt=urn:btih:abc123...',
  output_path: '/home/user/downloads'
});

// 2. Poll for progress
const interval = setInterval(async () => {
  const progress = await invoke('get_torrent_progress', {
    hash: torrent.hash
  });
  console.log(`${(progress.progress * 100).toFixed(1)}% done`);
  
  if (progress.status === 'Completed') {
    clearInterval(interval);
  }
}, 1000);
```

### CLI Example

```bash
# Generate keys
fabric key generate --output ~/fabric-identity.json

# Connect to network
fabric network connect \
  --gateway https://api.kaleido.io \
  --ca https://ca.kaleido.io \
  --identity ~/fabric-identity.json

# List channels
fabric network channels \
  --gateway https://api.kaleido.io \
  --identity ~/fabric-identity.json

# Query chaincode
fabric chaincode query \
  --channel movies \
  --chaincode movie-chaincode \
  --function queryAll

# Add torrent
fabric torrent add \
  --torrent "magnet:?xt=urn:btih:abc123" \
  --output ~/downloads
```
