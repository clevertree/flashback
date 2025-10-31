# CLI vs UI Features Comparison

## CLI Commands Implemented (in `src-tauri/src/cli/commands.rs`)

### Certificate & Key Management
- ✅ `gen-key <email>` - Generate new key/certificate with options:
  - `--password=<pwd>` - Set key password
  - `--bits=<n>` - Set key bits (RSA only)
  - `--alg=<alg>` - Algorithm: ecdsa, rsa, ed25519
  - `--reuse-key` - Reuse existing key
- ✅ `gen-cert <email>` - Generate self-signed certificate (deprecated, use gen-key)
- ✅ `set-cert-path <path>` - Set certificate path
- ✅ `print-cert` - Print current certificate

### Server Integration
- ✅ `api-register <base_url>` - Register certificate with server
- ✅ `api-ready <base_url> [socket]` - Announce ready socket to server
- ✅ `api-lookup <base_url> <email> [minutes]` - Lookup peer broadcast sockets by email

### Network Operations
- ✅ `start-listener` - Start peer listener
- ✅ `connect-peer <socket>` - Connect to a peer
- ✅ `send-client <socket> <message>` - Send message to peer

### Peer Management
- ✅ `allow` - Allow a pending peer request
- ✅ `allow auto` - Enable auto-allow mode
- ✅ `deny` - Deny a pending peer request

### Utility
- ✅ `help` / `--help` / `-h` - Show help
- ✅ `exit` / `quit` - Exit CLI

---

## UI Features Implemented (in `src/app/sections/` and `src/components/`)

### Key Management (KeySection.tsx)
- ✅ Generate new private key
- ✅ Select/locate existing private key
- ✅ Configure key path, email, password
- ✅ Choose algorithm (ECDSA, RSA, Ed25519) and bit length
- ✅ Verify key validity

### Server Registration (ServerSection.tsx)
- ✅ Register with server
- ✅ Display registration status
- ✅ Show registered info

### Broadcasting (BroadcastSection.tsx)
- ✅ Announce ready socket
- ✅ Lookup peers by email
- ✅ Connect to peers

### Chat Features
- ✅ Chat Section component
- ✅ Send/receive messages
- ✅ Message display

### Other UI Components
- ✅ Settings Section (navigation, media auto-play, connectivity options)
- ✅ Video Player Section
- ✅ DCC Chatroom (direct client connection)
- ✅ Clients List
- ✅ Navigation Menu

---

## Features in CLI but NOT in UI ❌

### API Operations (directly exposed CLI commands)
- **`api-register`** - Direct server registration via HTTP
  - UI has this wrapped in ServerSection but maybe not exposed at CLI level
- **`api-ready`** - Announce socket to server
  - UI has this in BroadcastSection
- **`api-lookup`** - Lookup peers by email
  - UI has this in BroadcastSection
- **`start-listener`** - Start the peer listener socket
  - UI may handle this automatically, but not explicitly in UI

### Low-level Networking
- **`connect-peer <socket>`** - Direct socket connection command
  - UI handles this but not as explicit button/command
- **`send-client <socket> <message>`** - Send direct message to socket
  - UI has chat but not raw socket messaging UI

### Peer Request Handling
- **`allow`** / **`allow auto`** / **`deny`** - Explicit request approval/denial
  - UI likely handles this in DCC Chatroom but not clear if fully implemented

### Certificate Operations  
- **`print-cert`** - Print certificate details
  - Not in UI; should show cert details somewhere
- **`set-cert-path`** - Explicit cert path configuration
  - UI has this in KeySection but maybe not as a standalone command after setup

---

## Features in UI but NOT as CLI Commands ✅

### Settings & Configuration
- Navigation layout toggle (left/right sidebar)
- Auto-play media settings
- Connect on startup option
- Auto re-connect to known peers option
- Theme/appearance settings

### UI-Specific Features
- Video player section
- Logs section
- Instructions section
- Error boundary/error handling UI

---

## Gaps & TODOs

| Feature | Status | Notes |
|---------|--------|-------|
| `print-cert` | 🔴 Missing in UI | Should show cert details in a readable format |
| Certificate import/export | 🟡 Partial | UI has key generation but not explicit export |
| Direct socket messaging UI | 🟡 Partial | CLI has `send-client`, UI needs raw socket UI |
| Request approval UI | 🟡 Unclear | DCC Chatroom likely handles this |
| Listener startup visibility | 🟡 Implicit | CLI explicit, UI may be automatic |
| Settings persistence | 🟡 Partial | UI has settings but unclear if all persisted |
| Error logging UI | 🟡 Partial | LogsSection exists but may need expansion |

