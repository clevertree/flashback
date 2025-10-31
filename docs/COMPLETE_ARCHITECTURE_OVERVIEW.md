# Flashback Architecture: Complete Overview

## The Big Picture

Flashback is a **decentralized file sharing system** with two key components:

1. **Relay Tracker** - Centralized coordinator (like BitTorrent tracker)
2. **Peer Server** - Decentralized file host (like BitTorrent peer)

Together, they enable private, peer-to-peer file sharing with minimal central infrastructure.

---

## Component 1: Relay Tracker

**Purpose:** Tell peers about each other (coordination layer)

**Tech Stack:**
- Framework: Next.js
- Location: `/server` directory
- Network: Public/private IP (configurable binding)
- Port: 3000 (configurable)

**What It Does:**
```
1. Clients register: "I'm online"
2. Relay stores: "Client A is at <address>"
3. Relay responds to queries: "Here are online peers"
4. Peers connect: "I found Client A, connecting now"
5. Relay role complete: Files transfer peer-to-peer
```

**What It Does NOT Do:**
- ❌ Store user files
- ❌ Participate in file transfers
- ❌ Cache content
- ❌ Index directories
- ❌ Dictate client behavior

**API Endpoints (Examples):**
```
POST /api/peers/register        Client registers
GET /api/peers/list             Get online peers
POST /api/peers/heartbeat       Keep-alive signal
GET /api/relay/status           Relay health status
```

**Security Model:**
- Stores only metadata (peer list)
- User files never exposed to relay
- Can be self-hosted for privacy
- Similar to public BitTorrent trackers (metadata is acceptable exposure)

---

## Component 2: Peer Server

**Purpose:** Serve files to other peers (content layer)

**Tech Stack:**
- Framework: Rust/Axum
- Location: `client/src-tauri/src/http_server.rs`
- Network: Localhost only (127.0.0.1)
- Port: OS-chosen (dynamic, port 0)

**What It Does:**
```
1. User configures fileRootDirectory
2. Peer Server starts on localhost
3. Event emitted: "Here's the port"
4. RemoteHouse connects locally: http://127.0.0.1:PORT/api/files
5. Remote peer connects: http://127.0.0.1:PORT/download/file.mp4
6. Files stream directly between peers
```

**What It Does NOT Do:**
- ❌ Coordinate with relay tracker (no registration)
- ❌ Provide file search API
- ❌ Generate breadcrumbs
- ❌ Index files automatically (not yet)
- ❌ Handle authentication (localhost trust)

**API Endpoints:**
```
GET /api/files                  List files in directory
GET /api/files/docs             List files in subdirectory
GET /content/README.md          Get text file content
GET /download/video.mp4         Stream/download binary file
```

**Security Model:**
- Localhost binding (same machine or relayed connection)
- Directory traversal prevention (canonical path checks)
- User controls what gets shared (fileRootDirectory)
- No credentials needed (trusted localhost)

---

## How They Work Together

### Discovery Phase
```
1. User A runs Flashback client
   └─> Connects to Relay Tracker
       └─> Relay: "User A is online"

2. User B runs Flashback client
   └─> Connects to Relay Tracker
       └─> Relay: "User B is online"

3. User B wants files from User A
   └─> Queries Relay Tracker: "Who's online?"
       └─> Relay: "User A is online at <address>"

4. User B initiates connection to User A
   └─> Uses relay connection or direct P2P
       └─> Connection established
```

### File Transfer Phase
```
1. User B connected to User A
   └─> User B queries Peer Server on A
       └─> GET http://127.0.0.1:PORT/api/files
           ← Returns: [README.md, video.mp4, ...]

2. User B selects a file
   └─> User B queries Peer Server on A
       └─> GET http://127.0.0.1:PORT/download/video.mp4
           ← Peer Server streams file directly

3. Relay Tracker's job is done
   └─> Files transfer peer-to-peer
       └─> Relay not involved in transfer
```

### After Disconnection
```
1. User A goes offline
   └─> Relay Tracker: Removes from peer list

2. User B queries Relay Tracker: "Who's online?"
   └─> Relay: "User A is NOT listed"

3. User B cannot connect to User A
   └─> Peer Server on A is down
       └─> No local file serving
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      DISCOVERY LAYER                             │
│                    (Relay Tracker)                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Responsibilities:                                         │  │
│  │  • Client registration                                     │  │
│  │  • Peer discovery                                          │  │
│  │  • Connection coordination                                 │  │
│  │  • Heartbeat management                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         ▲                                        ▲
         │ Register/Query                        │ Register/Query
         │                                        │
┌────────┴────────────────────────────────────────┴────────┐
│                                                           │
│                    PEER LAYER                            │
│                                                           │
│  ┌─────────────────┐              ┌──────────────────┐  │
│  │   Peer A        │              │    Peer B        │  │
│  │                 │              │                  │  │
│  │  Peer Server    │◄────────────►│  Peer Server     │  │
│  │  127.0.0.1:     │  File        │  127.0.0.1:      │  │
│  │  54321          │  Transfer    │  65432           │  │
│  │                 │              │                  │  │
│  │  Files:         │              │  Files:          │  │
│  │  /docs          │              │  /videos         │  │
│  │  /videos        │              │  /photos         │  │
│  │                 │              │                  │  │
│  └─────────────────┘              └──────────────────┘  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## File Sharing Example

### Scenario: User A wants to send a presentation to User B

```
SETUP:
  User A: Flashback client with /Presentations directory
  User B: Flashback client
  Both: Connected to same Relay Tracker

PROCESS:

1. User A adds file to /Presentations
   └─> presentation.pdf (200 MB)

2. User A clicks "Ready" to go online
   └─> Tauri client starts Peer Server
       └─> Listening on http://127.0.0.1:54321
           └─> Emits event: "peer-server-ready: {port: 54321}"
               └─> RemoteHouse connects to local Peer Server

3. User B queries Relay Tracker: "Who has files to share?"
   └─> Relay: "User A is online"

4. User B initiates connection to User A
   └─> Relay Connection: 127.0.0.1:54321 (via relay routing)
       └─> User B's RemoteHouse can now browse User A's files

5. User B views Relay-routed connection to User A's files
   └─> User B: GET /api/files
       ← User A Peer Server: [presentation.pdf, ...]

6. User B clicks presentation.pdf
   └─> User B: GET /download/presentation.pdf
       ← User A Peer Server: Streams 200 MB file
           └─> Uses chunked encoding or ephemeral port

7. File transfer complete
   └─> User A: ✓ Shared file (uploaded via Peer Server)
       └─> User B: ✓ Received file
           └─> Relay Tracker: Observing, not participating
```

---

## Network Isolation

```
┌─ Your Computer ──────────────────────────────────┐
│                                                  │
│  Flashback Tauri Client                         │
│  ┌──────────────────────────────┐               │
│  │ RemoteHouse Browser          │               │
│  │  (file browsing UI)          │               │
│  └───────────────┬──────────────┘               │
│                  │ connects to                  │
│                  ▼                              │
│  ┌──────────────────────────────┐               │
│  │ Peer Server                  │               │
│  │ (http://127.0.0.1:54321)     │               │
│  │ Only listens locally         │               │
│  │ Serves /Users/.../Documents │               │
│  └──────────────────────────────┘               │
│                                                  │
└──────────────────────────────────────────────────┘
         ▲
         │ Relay Connection
         │ (to Relay Tracker)
         │
    ┌────┴─────┐
    │   Internet│
    └────┬─────┘
         │ Relay Connection
         │ (to Relay Tracker)
         ▼
    ┌─────────────────────────────┐
    │  Relay Tracker              │
    │  (example.com:3000)         │
    │  Metadata only              │
    └─────────────────────────────┘
```

The Relay Tracker never sees the files in `/Users/.../Documents`. It only knows:
- User A is online
- User B is online
- Here's how to reach them

---

## Configuration

### Relay Tracker
```bash
# In server/.env or environment
PORT=3000
BIND_ADDRESS=0.0.0.0          # Public
DATABASE_URL=postgresql://...
RELAY_SECRET=...
```

### Peer Server
```
User Settings:
  fileRootDirectory: /Users/username/Documents

Auto-configured:
  Binding: 127.0.0.1 (hardcoded - localhost only)
  Port: OS-chosen (port 0), emitted via event
  Index: index.md (created if missing)
```

---

## Comparison: Traditional vs Flashback

### Traditional Approach
```
User A → Central Server ← User B
         (stores files)
Risk: Files on central server
Privacy: Server sees all content
Scalability: Server is bottleneck
```

### Flashback Approach
```
User A ←→ Relay Tracker ←→ User B
(files)   (metadata)       (files)
Risk: Only metadata on relay
Privacy: Files never through relay
Scalability: Relay not bottleneck
```

---

## Security Checklist

### Relay Tracker
- ✅ No user files stored
- ✅ Only metadata (peer list)
- ✅ Can self-host for privacy
- ✅ Minimal attack surface
- ✅ HTTPS recommended for production
- ✅ Optional authentication

### Peer Server
- ✅ Localhost-only binding
- ✅ Directory traversal prevention
- ✅ User controls what's shared
- ✅ No authentication needed (trusted localhost)
- ✅ Ephemeral ports (no fixed exposure)
- ✅ Filesystem-level access control

---

## Future Enhancements

### Relay Tracker
- Bandwidth tracking per peer
- Reputation system
- Advanced discovery (tags, categories)
- Analytics

### Peer Server
- Automatic file indexing (JSON)
- Partial content requests (HTTP ranges)
- Ephemeral port strategy selection
- Performance optimization
- Caching headers
- Compression

---

## Naming Convention Summary

**Centralized Coordinator:**
- ✓ "Relay Tracker"
- ✓ "Central Relay"
- ✓ "Relay Server"
- ✓ "Tracker"

**Client-Hosted File Server:**
- ✓ "Peer Server"
- ✓ "File Server"
- ✓ "HTTP File Server"
- ✓ "HTTP Listener"

**Connection Types:**
- ✓ "Relay Connection" - Client to Relay Tracker
- ✓ "Peer Connection" - Peer to Peer
- ✓ "Direct Connection" - Direct P2P (after relay intro)

---

## Summary: The Division of Labor

| Component | Relay Tracker | Peer Server |
|-----------|---------------|------------|
| **Centralizes** | Peer list metadata | None (decentralized) |
| **Stores files** | No | Yes (local directory) |
| **Hosts content** | No | Yes |
| **Port** | 3000 | OS-chosen (dynamic) |
| **Binding** | Public/private | Localhost (127.0.0.1) |
| **Tech** | Next.js | Rust/Axum |
| **Directory** | /server | client/src-tauri/src/ |
| **User files at risk** | No | Only what user shares |
| **Bottleneck** | No (metadata) | No (peer-to-peer) |
| **Run locally** | ✓ (private relay) | ✓ (each client) |
| **Scaling** | Easy (little data) | Easy (distributed) |
| **Failure impact** | Discovery fails | Only if offline |

---

## Result

Flashback enables **decentralized, private file sharing**:

- ✓ **Private:** Files never touch central server
- ✓ **Scalable:** Each peer serves itself
- ✓ **Reliable:** No single point of failure
- ✓ **User-controlled:** Users decide what to share
- ✓ **Efficient:** Peer-to-peer transfers
- ✓ **Flexible:** Different clients, different UX

The Relay Tracker is a lightweight coordinator. The Peer Server is an independent file host. Together, they create a powerful decentralized system.
