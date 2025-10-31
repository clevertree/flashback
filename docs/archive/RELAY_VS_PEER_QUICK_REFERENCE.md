# Quick Reference: Relay Tracker vs Peer Server

## Two HTTP Servers, Different Roles

### Relay Tracker
**Type:** Centralized coordinator (like a torrent tracker)  
**Tech:** Next.js backend  
**Location:** `/server` directory  
**Network:** Public/private IP (listens on all interfaces)  
**Port:** Configurable (typically 3000)  
**Stores files:** ❌ No  

**Main Job:**
- Register which clients are online
- Provide list of available peers
- Coordinate initial connections
- Never touches user files

**Files involved:**
```
server/app/api/peers/...     (client management)
server/app/api/relay/...     (relay operations)
```

---

### Peer Server
**Type:** Client-hosted file server (like a torrent peer)  
**Tech:** Rust/Axum (embedded in Tauri)  
**Location:** `client/src-tauri/src/http_server.rs`  
**Network:** Localhost only (127.0.0.1)  
**Port:** OS-chosen (dynamic, port 0)  
**Stores files:** ✅ Yes (from configured directory)  

**Main Job:**
- Serve files from local fileRootDirectory
- Support file browsing and streaming
- Enable other peers to download files
- No coordination with relay tracker

**Files involved:**
```
client/src-tauri/src/http_server.rs           (server implementation)
client/src/components/RemoteHouse/...         (UI to browse)
client/src/app/config.ts                      (fileRootDirectory setting)
```

---

## Communication Flow

```
┌─────────────────────┐
│   Relay Tracker     │
│  (Coordinator)      │
└──────────┬──────────┘
           │
      Tells A & B      Tells A & B
      about each       about each
      other            other
           │                │
           ▼                ▼
    ┌─────────────┐   ┌─────────────┐
    │  Peer A     │   │  Peer B     │
    │             │   │             │
    │ Peer Server │   │ Peer Server │
    │ (files)     │   │ (files)     │
    └─────────────┘   └─────────────┘
           │                ▲
           │                │
           └────────────────┘
              Direct connection
              (after relay intro)
              Files transfer here
              (Relay never sees them)
```

---

## Which Server For What?

| Question | Answer | Server |
|----------|--------|--------|
| Which server knows who's online? | Relay Tracker | Relay Tracker |
| Which server stores user files? | Peer Server | Peer Server |
| Which server sends videos to other clients? | Peer Server | Peer Server |
| Which server needs authentication? | Relay Tracker (maybe) | Peer Server (no, localhost) |
| Which server listens on localhost? | Peer Server | Peer Server |
| Which server listens publicly? | Relay Tracker | Relay Tracker |
| Which server can be run by end-users? | Both | Both |
| Which server never sees user files? | Relay Tracker | Relay Tracker |

---

## Configuration

### Relay Tracker
```env
# In server project (.env or environment)
RELAY_PORT=3000
RELAY_BIND_ADDRESS=0.0.0.0
DATABASE_URL=...
```

### Peer Server
```
In Client Settings UI:
  fileRootDirectory: /Users/username/Documents

Auto-configured:
  Binding: 127.0.0.1 (hardcoded)
  Port: OS-chosen (emitted via event)
```

---

## API Endpoints

### Relay Tracker Endpoints
```
POST /api/peers/register        Client registers
GET /api/peers/list             Get online peers
POST /api/peers/heartbeat       Keep-alive
GET /api/relay/status           Relay health
```

### Peer Server Endpoints
```
GET /api/files                  List files
GET /api/files/docs             List subdirectory
GET /content/README.md          Get text file
GET /download/video.mp4         Stream binary file
```

---

## Security Model

### Relay Tracker Security
- **Concern:** Metadata about who's online
- **Protection:** Use trusted relay, or run your own
- **Risk if breached:** Peer list exposed, but files safe

### Peer Server Security
- **Concern:** Local file exposure
- **Protection:** Users control fileRootDirectory, localhost-only binding
- **Risk if misconfigured:** Only files in configured directory exposed

---

## Deployment Scenarios

### Scenario 1: Using Public Relay
```
Your machine          Public Relay          Friend's machine
┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│   Client A   │◄────►│   Tracker   │◄────►│   Client B   │
│ (peer server)│      │  (public)   │      │(peer server) │
└──────────────┘      └─────────────┘      └──────────────┘
                            │
                      Files never here
```

### Scenario 2: Using Private Relay
```
Your Network
┌─────────────────────────────────────┐
│                                     │
│  ┌─────────────────────────┐       │
│  │   Relay Tracker         │       │
│  │   (private)             │       │
│  └────────┬────────────────┘       │
│           │                        │
│      ┌────▼─────┐  ┌──────────┐   │
│      │ Peer A   │  │ Peer B   │   │
│      │(file)    │  │(file)    │   │
│      └──────────┘  └──────────┘   │
│                                    │
└────────────────────────────────────┘
```

---

## Key Insight

**The Relay Tracker doesn't move files. It only tells peers where to find each other.**

The Peer Server is where the actual file transfer happens.

This design provides:
- **Privacy:** Files never go through the relay
- **Scalability:** Relay isn't bottleneck for file transfers
- **Flexibility:** Peers can upload/download directly
- **Decentralization:** No central content repository

---

## Testing

### Relay Tracker Tests
- Clients can register
- Client list is accurate
- Heartbeats keep clients alive
- Offline clients removed after timeout

### Peer Server Tests
- Files serve correctly from configured directory
- Directory traversal blocked
- Large files stream without error
- Port can be discovered via event
- Directory listing works

---

## Naming Convention (Going Forward)

To be precise:
- ✅ "Relay Tracker" or "Relay Server" = centralized Next.js server
- ✅ "Peer Server" or "File Server" = HTTP server in each client
- ✅ "Relay Connection" = connection from client to central relay
- ✅ "Peer Connection" or "Direct Connection" = connection between two clients
- ❌ "Relay Server" alone can be ambiguous - specify which one

---

## Summary Table

| Aspect | Relay Tracker | Peer Server |
|--------|---------------|-------------|
| **Purpose** | Coordinate peers | Serve files |
| **Centralized?** | Yes | No (runs on each client) |
| **Stores files?** | No | Yes |
| **Listens where?** | Public/private IP | Localhost (127.0.0.1) |
| **Port** | 3000 (configurable) | OS-chosen, dynamic |
| **Tech** | Next.js | Rust/Axum |
| **Codebase** | `/server` | `client/src-tauri/` |
| **Who can run?** | Relay operator | Each user |
| **User files safe?** | Yes (never touches them) | Yes (user controls what's shared) |
| **Needs auth?** | Maybe | No (localhost) |
| **Handles transfers?** | No | Yes |
| **Search API?** | Peer lookup | No (client-side search) |
| **Bandwidth cost** | Minimal (metadata) | Full file transfers |
