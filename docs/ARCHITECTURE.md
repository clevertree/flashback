# System Architecture

**Last Updated:** October 31, 2025

Complete architectural overview of the Flashback decentralized file sharing system.

---

## Core Concept

Flashback uses a **hybrid centralized-decentralized architecture**:
- **Relay Tracker**: Centralized coordinator (like BitTorrent tracker)
- **Peer Server**: Decentralized file host (like BitTorrent peer)

This combines the discovery benefits of centralization with the privacy and performance benefits of peer-to-peer transfer.

---

## Component Overview

### Relay Tracker (Centralized)

**Purpose:** Coordinate peer discovery
**Technology:** Next.js + PostgreSQL
**Location:** `/server` directory
**Network:** Public/private IP (configurable)
**Port:** 3000 (default, configurable)

**Responsibilities:**
- Accept client registrations
- Store peer metadata (email, socket, status)
- Respond to peer lookup queries
- Clean up stale entries (TTL-based)
- Track online/offline status

**What it does NOT do:**
- ❌ Store user files
- ❌ Participate in file transfers
- ❌ Cache content
- ❌ Index directories
- ❌ Authenticate file access

**API Endpoints:**
```
POST /api/relay/register        Register certificate + email
POST /api/relay/broadcast/ready Announce availability (mutual TLS)
GET  /api/relay/broadcast/lookup?email=... Query peer by email (mutual TLS)
GET  /api/relay/broadcast/list  List all online peers (mutual TLS)
```

---

### Peer Server (Decentralized)

**Purpose:** Serve files to other peers
**Technology:** Rust/Axum
**Location:** `client/src-tauri/src/http_server.rs`
**Network:** Localhost only (127.0.0.1)
**Port:** OS-chosen (ephemeral, port 0)

**Responsibilities:**
- Serve files from `fileRootDirectory`
- Provide directory listing API
- Stream file content
- Validate directory traversal
- Health check endpoint

**What it does NOT do:**
- ❌ Register with relay tracker (CLI/UI handles this)
- ❌ Provide search functionality
- ❌ Generate breadcrumbs (UI responsibility)
- ❌ Handle authentication (localhost trust model)

**API Endpoints:**
```
GET /api/files              List files in root
GET /api/files/:path        List files in subdirectory  
GET /content/:file          Get text file content
GET /download/:file         Stream/download binary file
GET /health                 Health check (200 OK if running)
```

---

## Data Flow

### Discovery Phase
```
1. User A starts peer server
   └─ Binds to 127.0.0.1:<ephemeral_port>
   
2. User A broadcasts to relay
   └─ POST /api/relay/broadcast/ready
   └─ Payload: {port: 54321, email: "a@example.com"}
   
3. Relay stores User A's socket
   └─ Database: {email: "a@example.com", socket: {...}, ttl: 1 hour}
   
4. User B queries relay
   └─ GET /api/relay/broadcast/lookup?email=a@example.com
   └─ Response: {email, socket: {host, port}}
```

### File Transfer Phase
```
5. User B connects to User A
   └─ HTTP GET http://127.0.0.1:54321/api/files
   └─ Direct peer-to-peer (relay not involved)
   
6. User B browses files
   └─ RemoteHouse component navigates directories
   └─ File preview for text/images/video
   
7. User B downloads file
   └─ HTTP GET http://127.0.0.1:54321/download/video.mp4
   └─ Direct stream from A to B
```

---

## Security Model

### Certificate-Based Identity
- Users generate RSA key pair + self-signed certificate
- Certificate CN field contains email
- Relay validates certificate on registration
- Mutual TLS for authenticated endpoints

### Network Isolation
- Peer Server binds to localhost (127.0.0.1) only
- No direct internet exposure
- Connections only via relay coordination or localhost

### Directory Traversal Prevention
- Canonical path validation
- No parent directory access via `../`
- Only files within `fileRootDirectory` accessible

### File Type Validation
- Whitelist-based approach
- Blocks dangerous types (HTML, JS, EXE)
- Content-Type header validation

---

## Storage Architecture

### Relay Tracker Database
```sql
-- PostgreSQL schema
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  certificate TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE broadcasts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  port INTEGER NOT NULL,
  addresses JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Client Storage
```
localStorage (Browser):
  - fileRootDirectory: string
  - certificatePath: string
  - relayTrackerUrl: string

Config file (Tauri):
  - client_certificate_path: string
  - relay_tracker_url: string
```

---

## Communication Protocols

### Relay Tracker ↔ Client
**Protocol:** HTTPS (mutual TLS for authenticated endpoints)
**Format:** JSON
**Authentication:** Certificate-based (mutual TLS)

### Peer ↔ Peer
**Protocol:** HTTP (localhost)
**Format:** JSON (metadata), Binary (files)
**Authentication:** None (localhost trust model)

### Client UI ↔ Tauri Backend
**Protocol:** Tauri IPC
**Format:** JSON
**Events:** `http-server-ready`, etc.

---

## Lifecycle Management

### Peer Server Lifecycle
```
1. User configures fileRootDirectory
2. Click "Broadcast Files"
3. Tauri starts HTTP server (ephemeral port)
4. Emit event: http-server-ready {port}
5. CLI/UI broadcasts to relay
6. Server runs until stopped or app closes
```

### Broadcast Lifecycle
```
1. Broadcast sent to relay (TTL: 1 hour)
2. Relay stores in database
3. Background job cleans expired entries (every 5 min)
4. Client can refresh by re-broadcasting
```

### Health Check Lifecycle (Phase 3)
```
1. Friend added to local list
2. Periodic health check (every 60s)
3. Try cached socket first
4. On failure: query relay for latest socket
5. Update friend status (online/offline)
```

---

## Scalability Considerations

### Relay Tracker
- **Bottleneck:** Database queries for peer lookup
- **Solution:** Index on email column, connection pooling
- **Capacity:** Can handle ~1000 concurrent clients per instance
- **Horizontal Scaling:** Add load balancer + multiple relay instances

### Peer Server
- **Bottleneck:** File I/O and network bandwidth
- **Solution:** Async I/O (Tokio), streaming responses
- **Capacity:** Limited by client's upload bandwidth
- **Scaling:** Naturally distributed (each client runs own server)

---

## Failure Modes

### Relay Tracker Down
- **Impact:** No new peer discovery
- **Mitigation:** Cached socket addresses still work
- **Recovery:** Automatic reconnection on relay restart

### Peer Server Crash
- **Impact:** Files unavailable from that peer
- **Mitigation:** Friends list shows offline status
- **Recovery:** User restarts peer server

### Network Partition
- **Impact:** Some peers unreachable
- **Mitigation:** Relay provides latest known socket
- **Recovery:** Automatic when network reconnects

---

## Technology Stack

### Backend (Relay Tracker)
- **Runtime:** Node.js 18+
- **Framework:** Next.js 14
- **Database:** PostgreSQL 14+
- **ORM:** Sequelize
- **Security:** TLS, Mutual TLS

### Backend (Peer Server)
- **Language:** Rust 1.70+
- **Framework:** Axum 0.7
- **Async Runtime:** Tokio
- **Security:** Canonical path checks

### Frontend
- **Framework:** React 18 + Next.js 14
- **Language:** TypeScript 5+
- **Styling:** Tailwind CSS
- **Desktop:** Tauri 1.5+

---

## Key Design Decisions

### Why Localhost Binding?
- Simplifies security (no internet exposure)
- Relies on relay for coordination
- Peer-to-peer transfer still efficient

### Why Ephemeral Ports?
- Avoids port conflicts
- OS chooses available port
- Communicated via events/broadcasts

### Why Mutual TLS?
- Strong authentication without tokens
- No session management needed
- Certificate lifecycle matches user account

### Why TTL-Based Expiration?
- Simple cleanup mechanism
- No heartbeat required initially
- Scales better than active monitoring

---

## See Also

- **FEATURES_IMPLEMENTED.md** - What's built so far
- **NEXT_PHASE.md** - Upcoming features
- **RELAY_VS_PEER_QUICK_REFERENCE.md** - API reference
