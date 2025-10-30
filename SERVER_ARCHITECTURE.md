# Flashback HTTP Architecture: Relay Tracker vs Peer Server

## Overview

Flashback has two distinct HTTP servers serving different purposes:

1. **Relay Tracker** - The centralized Next.js server (coordinator)
2. **Peer Server** - The HTTP file server running in each client (content provider)

Both are HTTP servers, but they serve fundamentally different roles in the architecture.

---

## 1. Relay Tracker (Centralized)

**What it is:** The Next.js backend server that acts like a **torrent tracker** for the relay network.

**Location:** `/server` directory

**Primary Responsibility:** Track clients and coordinate connections

### Relay Tracker Functions

**✅ Client Registration & Discovery**
- Clients register with the relay when they come online
- Relay maintains a list of active peers
- New clients query the relay to find others

**✅ Metadata Management**
- Track which clients are online/offline
- Store client connection capabilities
- Manage relay-wide settings and configuration

**✅ Coordination (Not Content)**
- Facilitate peer connections
- Never stores or hosts user files
- Does not participate in file transfers

**✅ API Endpoints (Examples)**
```
POST /api/peers/register         Register client as peer
GET /api/peers/list              List available peers
POST /api/peers/heartbeat        Keep-alive signal
GET /api/relay/status            Relay status
```

### What Relay Tracker Does NOT Do

❌ Host user files
❌ Stream video or media
❌ Serve file listings
❌ Participate in content transfers
❌ Cache user data
❌ Provide direct file access

### Security Model

- **Stateless**: Minimal session state (relay-only)
- **Tracker-like**: Similar to BitTorrent trackers
- **Coordinator only**: Never handles sensitive content
- **Optional**: Clients can work peer-to-peer if relay is unavailable

---

## 2. Peer Server (Client-Hosted)

**What it is:** An HTTP file server running on each Tauri client that serves files from the local machine.

**Location:** `client/src-tauri/src/http_server.rs` (embedded in client)

**Primary Responsibility:** Serve files from configured directory to other peers

### Peer Server Functions

**✅ File Serving**
- Stream files from configured local directory
- Prevent directory traversal attacks
- Support multiple file types (text, images, videos)
- Efficient large file streaming

**✅ Basic Endpoints**
```
GET /api/files                      List files in directory
GET /api/files/docs                 List files in subdirectory
GET /content/README.md              Get text file content
GET /download/large-video.mp4       Stream/download file
```

**✅ Dynamic Port Binding**
- Starts on OS-chosen port (port 0)
- Emits event with actual port to client app
- Ephemeral ports for each file transfer session

**✅ Navigation**
- File listing via `/api/files`
- Directory traversal (with security checks)
- Breadcrumbs determined by file content (links in markdown)

### What Peer Server Does NOT Do

❌ Register clients (that's the relay's job)
❌ Discover other peers (relay handles that)
❌ Store metadata (only local filesystem)
❌ Index all files automatically (not yet - future feature)
❌ Provide search functionality (client's responsibility)
❌ Generate breadcrumbs (files contain links)

### Security Model

- **Localhost-only**: Listens on 127.0.0.1 only
- **File-gated**: Respects configured root directory
- **Ephemeral**: No persistent sessions
- **Minimal**: No authentication (localhost assumption)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Relay Tracker                          │
│ (Centralized Next.js Server - Acts like Torrent Tracker)   │
│                                                             │
│  Functions:                                                │
│  • Client registration/discovery                           │
│  • Peer list management                                    │
│  • Connection coordination                                 │
│  • NO file storage                                         │
│  • NO content transfer                                     │
└──────────────────┬──────────────────┬──────────────────────┘
                   │                  │
        Query for peers    Query for peers
                   │                  │
        ┌──────────▼────────┐  ┌─────▼────────────┐
        │   Peer Client A   │  │   Peer Client B  │
        │                   │  │                  │
        │  ┌─────────────┐  │  │ ┌──────────────┐ │
        │  │ Peer Server │  │  │ │ Peer Server  │ │
        │  │ (HTTP on    │  │  │ │ (HTTP on     │ │
        │  │ :54321)     │  │  │ │ :65432)      │ │
        │  └─────────────┘  │  │ └──────────────┘ │
        │                   │  │                  │
        │  Hosts files from │  │  Hosts files     │
        │  ~/Documents      │  │  from ~/Videos   │
        │                   │  │                  │
        └───────────────────┘  └──────────────────┘
              ▲                        ▲
              │                        │
              │ Direct P2P connection  │
              │ (after relay intro)    │
              │                        │
              └────────────────────────┘
              
              File Transfer:
              Client B connects to Client A's Peer Server
              Downloads files directly
```

---

## Data Flow Examples

### Example 1: Client Discovery

```
1. Client A starts
   └─> Registers with Relay Tracker (via relay API)
       "I'm online, connect to me via <relay connection>"

2. Client B wants to find peers
   └─> Queries Relay Tracker: "List available peers"
       Relay responds: "Client A is online"

3. Client B initiates connection to Client A
   └─> Uses relay connection or direct P2P

4. Relay's job is done (metadata only)
```

### Example 2: File Transfer

```
1. Client B connected to Client A
   └─> Wants to access Client A's files

2. Client B queries Peer Server on Client A
   └─> GET http://127.0.0.1:54321/api/files
       Peer Server returns: [README.md, video.mp4, ...]

3. Client B selects a file
   └─> GET http://127.0.0.1:54321/download/video.mp4
       Peer Server streams video directly

4. Relay Tracker never sees the file (not involved)
```

### Example 3: Large File Streaming

```
1. Client B wants to download 4GB video from Client A

2. Option 1 - Single Connection
   └─> GET /download/large.mp4
       Peer Server streams via chunked encoding

3. Option 2 - Ephemeral Port (Future)
   └─> Client A creates temp port :65000
       Emits "file-stream-ready" event
       Client B connects to dedicated port
       Download completes, port closes

4. Relay Tracker never involved in transfer
```

---

## Key Differences

| Aspect | Relay Tracker | Peer Server |
|--------|---------------|------------|
| **Purpose** | Coordinate peers | Serve files |
| **Location** | Centralized server | Each client |
| **Stores user files** | ❌ No | ✅ Yes (local) |
| **Registers clients** | ✅ Yes | ❌ No |
| **Provides file list** | ❌ No | ✅ Yes |
| **Streams media** | ❌ No | ✅ Yes |
| **Metadata storage** | ✅ Peer info | ❌ Just filesystem |
| **Network binding** | Public/private | Localhost only |
| **Content transfer** | ❌ No (pass-through only) | ✅ Yes |
| **Search capability** | N/A | Client-side only |
| **Breadcrumbs** | N/A | From file links |
| **Authentication** | May require auth | Localhost trust |
| **Session state** | Minimal (peers) | None (ephemeral) |

---

## Design Philosophy

### Relay Tracker Philosophy: Thin Coordinator
- Provides only what's necessary for discovery
- Does not dictate client behavior
- Stateless where possible
- Similar to BitTorrent trackers (minimal overhead)

### Peer Server Philosophy: Data Provider
- Serves requested files only
- No automatic indexing or discovery (not yet)
- Clients control navigation (via file links)
- Remote clients own rendering and behavior

---

## Configuration

### Relay Tracker Configuration
```
.env or environment variables
RELAY_PORT=3000
RELAY_BIND_ADDRESS=0.0.0.0
DATABASE_URL=...
```

### Peer Server Configuration
```
Client Settings:
  fileRootDirectory: /path/to/files

Automatic:
  Binding: 127.0.0.1 (hardcoded)
  Port: 0 (OS-chosen, emitted via event)
  Index: index.md (created if missing)
```

---

## Future Enhancements

### Relay Tracker (Possible)
- Bandwidth tracking per peer
- Reputation system for reliability
- Advanced discovery/search integration
- Client capability advertising

### Peer Server (Possible)
- Automatic file indexing (JSON/YAML)
- Partial content/range requests (streaming resume)
- Ephemeral port strategies
- Performance optimization for massive file lists

---

## Security Implications

### Relay Tracker
- **Risk**: If compromised, can see client list and metadata
- **Mitigation**: Run your own relay, or use trusted relay operators
- **User files**: Never at risk (relay never sees them)

### Peer Server
- **Risk**: Localhost-only, so minimal network risk
- **Mitigation**: Configure fileRootDirectory carefully (controls what gets served)
- **User control**: Users decide what directory to share

---

## Example Deployment

```
┌─────────────────────────────────────────┐
│         Your Infrastructure             │
├─────────────────────────────────────────┤
│                                         │
│  Relay Tracker Server                  │
│  ├─ Runs on: example.com:3000         │
│  ├─ Manages: Client registration      │
│  ├─ Hosts: No user files              │
│  └─ Monitors: Peer availability       │
│                                         │
└──────────┬────────────────────────────┬─┘
           │                            │
        Peer Connections          Peer Connections
           │                            │
    ┌──────▼────────┐           ┌──────▼────────┐
    │  User Machine A        │  User Machine B  │
    ├────────────────┤         ├─────────────────┤
    │  Tauri Client  │         │  Tauri Client   │
    │  + Peer Server │         │  + Peer Server  │
    │                │         │                 │
    │ Serves files  │         │ Serves files    │
    │ from ~/Docs   │         │ from ~/Videos   │
    │                │         │                 │
    └────────────────┘         └─────────────────┘
```

---

## Naming Convention

To avoid confusion:

- **Relay Tracker** or **Central Relay**: The centralized Next.js server
- **Peer Server** or **File Server**: The HTTP server in each client
- **Relay Connection**: The connection from client to central relay
- **Direct Connection**: The connection between two peers

---

## Summary

**The Relay Tracker** is like a torrent tracker—it tells peers about each other but never touches the content.

**The Peer Server** is like a torrent peer—it serves content to other peers who ask for it.

Together, they enable **decentralized file sharing** with minimal central authority involvement.

- Relay = Knows who's online
- Peer = Knows what files it has
- Client = Decides what to do with files

This separation ensures:
✅ Scalability (relay doesn't handle all data)
✅ Privacy (files never go through central relay)
✅ Flexibility (clients implement UX as they see fit)
✅ Security (each component has minimal responsibilities)
