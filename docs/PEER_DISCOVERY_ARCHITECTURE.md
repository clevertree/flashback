# Peer Discovery Architecture: From Relay Tracker to Decentralized P2P Network

**Status:** Architecture Design  
**Date:** October 31, 2025  
**Version:** 1.0  
**Scope:** Complete redesign of peer coordination from centralized relay tracking to bootstrap nodes + gossip protocol

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architectural Shift](#architectural-shift)
3. [Components](#components)
4. [Bootstrap Node Model](#bootstrap-node-model)
5. [Gossip Protocol](#gossip-protocol)
6. [Peer Discovery Flow](#peer-discovery-flow)
7. [Data Structures](#data-structures)
8. [Security Model](#security-model)
9. [WebTorrent Integration](#webtorrent-integration)
10. [State Machines](#state-machines)
11. [Sequence Diagrams](#sequence-diagrams)
12. [Implementation Phases](#implementation-phases)

---

## Executive Summary

### From Centralized to Decentralized

**Current Model (Being Replaced):**
- Single relay tracker server maintains ALL peer information
- All peer discovery requires relay tracker query
- Relay tracker is single point of coordination
- Scalability limited by relay server capacity

**New Model (To Be Implemented):**
- Multiple bootstrap nodes coordinate initial discovery
- Gossip protocol shares peer information between connected peers
- No central repository of peer information
- Peers learn about other peers through gossip
- Broadcasting clients share their IP information
- Non-broadcasting peers gather socket info silently
- Large file distribution via WebTorrent (torrents for off-repo data)

### Key Changes

| Aspect | Old | New |
|--------|-----|-----|
| **Coordinator** | Single relay server | Multiple bootstrap nodes |
| **Peer Discovery** | Query relay for ALL peers | Query bootstrap node, then gossip |
| **IP Sharing** | Relay stores all IPs | Only broadcasting clients share IPs |
| **Scalability** | Centralized bottleneck | Decentralized, gossip-based |
| **Large Files** | Direct peer-to-peer only | WebTorrent/BitTorrent protocol |
| **Bootstrap** | Fixed relay URL | Multiple bootstrap node options |

---

## Architectural Shift

### Current Architecture (Relay-Based Discovery)

```
┌─────────────────────────────────┐
│      Relay Tracker Server       │
│  (Stores ALL peer information)  │
└──────┬──────────────────────────┘
       │ Query
       │ Response
       │
┌──────┴─────────────┬────────────┐
│                    │            │
▼                    ▼            ▼
Client A          Client B      Client C
```

**Problems:**
- Relay is single point of failure
- Relay stores complete peer graph (privacy concern)
- Relay bandwidth becomes bottleneck
- Centralized trust model
- All clients depend on relay uptime

### New Architecture (Bootstrap + Gossip Discovery)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Bootstrap 1  │  │ Bootstrap 2  │  │ Bootstrap 3  │
│  (Lists IPs) │  │  (Lists IPs) │  │  (Lists IPs) │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
              (Bootstrap Discovery)
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
    ┌──▼──┐           ┌──▼──┐           ┌──▼──┐
    │ C-A │◄─────────►│ C-B │◄─────────►│ C-C │
    │(Bcast)          │(Silent)         │(Bcast)
    └─────┘           └─────┘           └─────┘
       ▲                 ▲                 ▲
       │ Gossip Protocol │                 │
       └─────────────────┴─────────────────┘
```

**Advantages:**
- No single point of failure
- Bootstrap nodes only store broadcasting peer IPs
- Gossip protocol scales with network size
- Decentralized trust model
- Clients continue functioning even if bootstrap is down
- Privacy: Only broadcasting clients expose IP

---

## Components

### 1. Bootstrap Node

**Purpose:** Initial peer discovery entry point

**Responsibilities:**
- Register when client broadcasts/ready
- Unregister when client stops broadcasting
- Return list of other broadcasting bootstrap peers
- NO persistent storage of non-broadcasting peers
- TTL-based expiration (same as current relay)

**API Changes:**
```
OLD (Relay Tracker):
POST /api/relay/broadcast/ready      (stores to DB)
GET  /api/relay/broadcast/lookup     (queries by email)
GET  /api/relay/broadcast/list       (returns ALL peers)

NEW (Bootstrap Node):
POST /api/bootstrap/register         (register as bootstrap)
DELETE /api/bootstrap/unregister     (leave bootstrap role)
GET /api/bootstrap/peers             (list other bootstraps)
GET /api/bootstrap/discover          (guided peer discovery)
```

**Data Stored (Bootstrap Node Only):**
```typescript
{
  email: string;
  socket_addresses: string[];        // Only if broadcasting
  port: number;
  repositories: RepositorySummary[];
  expires_at: Date;
  is_bootstrap: boolean;              // NEW: Marks this peer as bootstrap
  is_broadcasting: boolean;           // Only bootstraps share IPs
}
```

### 2. Gossip Protocol Handler

**Purpose:** Peer-to-peer information sharing

**Responsibilities:**
- Send/receive peer announcements
- Maintain local peer table
- Share known peers with new peers
- Handle peer expiration and cleanup
- Enforce IP sharing rules

**Location:** `client/src-tauri/src/gossip.rs` (NEW)

### 3. Peer Table (Local)

**Purpose:** Local cache of known peers

**Responsibilities:**
- Store peer information
- Track availability and performance
- Manage peer expiration
- Sort by availability/performance

**Storage:** In-memory with optional persistence

### 4. WebTorrent Client

**Purpose:** Distributed file sharing outside repos

**Responsibilities:**
- Hash large files
- Seed torrent files
- Download from torrent swarm
- Integrate with peer discovery

**Library:** webtorrent (npm package)

---

## Bootstrap Node Model

### Bootstrap Registration

**When:** Client enables broadcast/ready with one or more repos

**Flow:**
1. Client has selected repositories to host
2. Client enables broadcast/ready
3. Client calls: `POST /api/bootstrap/register`
4. Relay tracker stores peer in bootstrap node list
5. Relay returns current bootstrap peers (for gossip)
6. Client begins gossip protocol with received peers

**Request:**
```typescript
POST /api/bootstrap/register
Content-Type: application/json
Authorization: Certificate-based (mutual TLS)

{
  email: string;
  socket_addresses: string[];  // IPs this client is available on
  port: number;
  repositories: RepositorySummary[];
  capabilities?: {
    max_peers?: number;
    supports_torrent?: boolean;
    bandwidth_estimate?: number;
  };
}
```

**Response:**
```typescript
{
  status: 'registered';
  bootstrap_peers: BootstrapPeer[];  // Other bootstrap nodes to gossip with
  peer_id: string;                    // Unique identifier for this session
  expires_at: Date;                   // TTL for this registration
}
```

### Bootstrap Unregistration

**When:** Client disables broadcast or application closes

**Flow:**
1. Client calls: `DELETE /api/bootstrap/unregister`
2. Relay tracker removes peer from bootstrap list
3. Gossip peers are notified of removal (optional)

**Request:**
```typescript
DELETE /api/bootstrap/unregister?email=user@example.com
Authorization: Certificate-based (mutual TLS)
```

**Response:**
```typescript
{
  status: 'unregistered';
}
```

### Bootstrap Peer Lookup

**When:** Client needs to discover new peers

**Flow:**
1. Client calls: `GET /api/bootstrap/discover?repositories=repo1,repo2`
2. Relay tracker returns bootstrap peers hosting those repos
3. Client initiates connection with returned peers

**Request:**
```typescript
GET /api/bootstrap/discover?repositories=repo1,repo2,repo3
Authorization: Certificate-based (mutual TLS)
```

**Response:**
```typescript
[
  {
    email: string;
    socket_addresses: string[];
    port: number;
    repositories: RepositorySummary[];
    performance_score?: number;      // Optional: based on community feedback
    availability_score?: number;     // Optional: based on uptime history
  }
]
```

---

## Gossip Protocol

### Overview

**Purpose:** Peers share information about other peers in network

**Properties:**
- **Epidemic Algorithm:** Information spreads like epidemic through network
- **Probabilistic:** Each message has probability of forwarding
- **Eventually Consistent:** All peers eventually learn about all peers
- **Privacy-Respecting:** Only broadcast peers share IPs
- **Partial Knowledge:** Peers don't know full network, only neighbors + gossip

### Message Types

#### 1. PEER_ANNOUNCEMENT

**Purpose:** Announce self or other peers

**Sender:** Any peer (mainly bootstrap nodes)

**Content:**
```typescript
{
  type: 'PEER_ANNOUNCEMENT';
  origin: {
    email: string;
    peer_id: string;
    socket_addresses?: string[];  // Only if broadcasting
    port: number;
    repositories: RepositorySummary[];
    public_certificate: string;
  };
  source: {
    email: string;  // Who sent this message
    peer_id: string;
  };
  timestamp: Date;
  ttl: number;  // Decrements, stops at 0
}
```

**Rules:**
- Only include `socket_addresses` if `origin.is_broadcasting === true`
- Non-broadcasting peers don't expose their IP
- TTL prevents infinite loops
- Receiver updates peer table
- Receiver may forward to other peers with TTL-1

#### 2. PEER_REQUEST

**Purpose:** Request peer list for specific repositories

**Sender:** Non-bootstrap peers discovering repositories

**Content:**
```typescript
{
  type: 'PEER_REQUEST';
  repositories: string[];
  sender: {
    email: string;
    peer_id: string;
  };
  timestamp: Date;
}
```

**Response:** PEER_LIST_RESPONSE with matching peers

#### 3. PEER_LIST_RESPONSE

**Purpose:** Respond to peer request with known peers

**Sender:** Any peer that received PEER_REQUEST

**Content:**
```typescript
{
  type: 'PEER_LIST_RESPONSE';
  request_id: string;  // Correlate with request
  peers: PeerInfo[];   // Known peers (filtered by repo)
  timestamp: Date;
}
```

**Rules:**
- Include only bootstrap peers if sender is non-broadcasting
- Include all peers if sender is broadcasting
- Filter by requested repositories

#### 4. HEARTBEAT

**Purpose:** Keep-alive / peer table cleanup

**Sender:** Bootstrap nodes (periodic)

**Content:**
```typescript
{
  type: 'HEARTBEAT';
  sender: {
    email: string;
    peer_id: string;
    is_bootstrap: boolean;
  };
  timestamp: Date;
}
```

**Rules:**
- Sent every 30 seconds by bootstrap nodes
- Recipient marks peer as "last_seen": now
- Peers that don't heartbeat for 2 hours expire

### Peer Sharing Rules

**Only Broadcasting Clients Share IPs:**

```typescript
if (peer.is_broadcasting) {
  // Include in announcements
  announcements.push({
    ...peer,
    socket_addresses: peer.socket_addresses  // INCLUDE
  });
} else {
  // Omit IP from announcements
  announcements.push({
    ...peer,
    socket_addresses: undefined  // EXCLUDE
  });
}
```

**Gossip Propagation:**

```typescript
function shouldForwardGossip(message: GossipMessage): boolean {
  // Forward if:
  // 1. TTL > 0
  if (message.ttl <= 0) return false;
  
  // 2. Not seen recently (probabilistic)
  if (recentlySeen(message.id)) {
    // 5% chance to forward duplicates (for redundancy)
    return Math.random() < 0.05;
  }
  
  // 3. To random subset of peers (fan-out = 3)
  const fanOut = 3;
  const selectedPeers = randomPeers(fanOut);
  
  for (const peer of selectedPeers) {
    sendGossipMessage(peer, {
      ...message,
      ttl: message.ttl - 1
    });
  }
  
  return true;
}
```

---

## Peer Discovery Flow

### Phase 1: Bootstrap Discovery

```
User enables broadcast/ready with repos
    │
    ├─► Generate unique peer_id
    │
    ├─► Get own socket addresses
    │
    ├─► Determine own port (or use from config)
    │
    └─► POST /api/bootstrap/register
            │
            ├─ Relay checks certificate (mutual TLS)
            ├─ Relay stores as bootstrap node
            ├─ Relay returns other bootstrap peers
            │
            └─► Response: bootstrap_peers[], expires_at, peer_id
                │
                └─► Store peer_id for later heartbeats
                └─► Initialize peer table with bootstrap peers
                └─► Start gossip protocol connections
```

### Phase 2: Gossip Network Formation

```
Peer table initialized with bootstrap peers
    │
    ├─► For each bootstrap peer:
    │     │
    │     ├─ Open gossip channel (WebSocket or UDP)
    │     ├─ Send PEER_ANNOUNCEMENT (self)
    │     └─ Listen for incoming gossip messages
    │
    ├─► Receive announcements from bootstrap peers
    │     │
    │     ├─ Extract peer information
    │     ├─ Respect IP sharing rules
    │     ├─ Add to local peer table
    │     └─ Forward to other peers (with TTL-1)
    │
    └─► Peer table now contains:
          - Bootstrap peers (direct)
          - Peers from gossip (indirect)
          - Performance/availability scores
```

### Phase 3: Peer Repository Discovery

```
Application wants to find peers hosting specific repos
    │
    ├─► Check local peer table first
    │     ├─ Filter by repository
    │     ├─ Sort by availability/performance
    │     └─ If found: use directly (no delay)
    │
    └─► If not found in peer table:
          │
          ├─ Send PEER_REQUEST (repository list)
          ├─ To: random set of known peers
          │
          └─► Receive PEER_LIST_RESPONSE
                ├─ Update peer table
                └─ Connect to highest-scored peers
```

### Phase 4: Peer-to-Peer Connection

```
Selected peer from discovery
    │
    ├─► Check if broadcasting
    │     ├─ Yes: Use socket_addresses directly
    │     └─ No: Connect via relay tracker or NAT traversal
    │
    ├─► Establish connection:
    │     ├─ HTTPS/TLS with peer certificate
    │     ├─ Handshake / authentication
    │     └─ Subscribe to gossip from this peer
    │
    └─► Exchange peer information:
          ├─ Announce own presence
          ├─ Request repository information
          └─ Receive peer updates
```

---

## Data Structures

### PeerInfo (Stored Locally)

```typescript
interface PeerInfo {
  // Identity
  email: string;
  peer_id: string;
  public_certificate: string;
  
  // Connection
  socket_addresses: string[];        // Only for broadcasting peers
  port: number;
  
  // Status
  is_broadcasting: boolean;           // Shares IP publicly
  is_bootstrap: boolean;              // Acts as bootstrap node
  peer_status: 'online' | 'offline' | 'stale';
  
  // Repositories
  repositories: RepositorySummary[];
  
  // Availability/Performance
  availability_score: number;         // 0-100, based on uptime
  performance_score: number;          // 0-100, based on response time
  bandwidth_estimate: number;         // bytes/sec
  
  // Lifecycle
  discovered_at: Date;
  last_seen: Date;
  expires_at: Date;  // TTL-based expiration
  
  // Metadata
  peer_count: number;                 // How many peers this peer knows about
  gossip_received_count: number;      // Statistics
}
```

### BootstrapNode (Stored by Relay)

```typescript
interface BootstrapNode {
  id: number;
  email: string;
  peer_id: string;
  
  // Connection info (only if broadcasting)
  socket_addresses: string[];
  port: number;
  
  // Repositories
  repositories: RepositorySummary[];
  
  // Status
  is_broadcasting: boolean;
  is_bootstrap: boolean;
  
  // Certificate
  public_certificate: string;
  
  // Lifecycle
  registered_at: Date;
  last_heartbeat: Date;
  expires_at: Date;
  
  // Capabilities
  capabilities: {
    max_peers: number;
    supports_torrent: boolean;
    bandwidth_estimate: number;
  };
}
```

### GossipMessage (In Transit)

```typescript
interface GossipMessage {
  id: string;  // UUID for deduplication
  type: 'PEER_ANNOUNCEMENT' | 'PEER_REQUEST' | 'PEER_LIST_RESPONSE' | 'HEARTBEAT';
  ttl: number;
  timestamp: Date;
  sender: {
    email: string;
    peer_id: string;
  };
  
  // Payload varies by type
  payload: {
    // PEER_ANNOUNCEMENT
    origin?: PeerInfo;
    
    // PEER_REQUEST
    repositories?: string[];
    
    // PEER_LIST_RESPONSE
    request_id?: string;
    peers?: PeerInfo[];
    
    // HEARTBEAT
    is_alive?: boolean;
  };
}
```

---

## Security Model

### 1. Bootstrap Registration

**Authentication:** Mutual TLS (certificate-based)

**Authorization:**
- Any client can register as bootstrap (no whitelist yet)
- Client must own the certificate
- Relay verifies certificate against stored fingerprint

**Privacy:**
- Only broadcasting clients expose IP
- Non-broadcasting clients can register but don't share socket addresses

### 2. Gossip Protocol Security

**Message Verification:**
```typescript
function verifyGossipMessage(message: GossipMessage): boolean {
  // 1. Check TTL > 0
  if (message.ttl <= 0) return false;
  
  // 2. Check timestamp not in future
  if (message.timestamp > Date.now() + 30_000) return false;
  
  // 3. Verify sender's certificate (if peer info included)
  if (message.payload.origin?.public_certificate) {
    return verifyCertificateSignature(message);
  }
  
  // 4. Check message not seen recently (prevent replays)
  if (seenMessageIds.has(message.id)) return false;
  
  return true;
}
```

**Certificate Trust:**
- Bootstrap nodes' certificates come from relay tracker
- Gossip messages include sender's public certificate
- Receivers verify certificate signature on message
- Non-broadcasting peers don't expose their real IP

### 3. IP Sharing Model

**Broadcasting Peer:**
- Explicitly chooses to enable broadcast
- IP exposed to all peers on network
- Can be discovered via bootstrap nodes
- Allows incoming connections

**Non-Broadcasting Peer:**
- No IP exposed to network
- Can only be reached via relay tracker
- Discovers peers but isn't listed in peer discovery
- Gathers socket info about other peers silently

**Example:**

```typescript
// Broadcasting peer announces itself
if (this.isBroadcasting) {
  const announcement: GossipMessage = {
    type: 'PEER_ANNOUNCEMENT',
    payload: {
      origin: {
        ...this.peerInfo,
        socket_addresses: ['192.168.1.100', '10.0.0.5'],  // EXPOSE
        port: 8080
      }
    }
  };
  this.gossip.broadcast(announcement);
}

// Non-broadcasting peer announces others' info but not self
if (!this.isBroadcasting) {
  // Forward announcements but don't expose own IP
  const forwardAnnouncement = {
    type: 'PEER_ANNOUNCEMENT',
    payload: {
      origin: {
        ...knownPeer,
        socket_addresses: knownPeer.socket_addresses  // Forward others' IPs
        // But when receiving announcements about us:
      }
    }
  };
}
```

### 4. Whitelist Future

**Current:** Anyone can be a bootstrap node by enabling broadcast

**Future Enhancement (TODO):**
```typescript
// Whitelist check before registering bootstrap
if (!this.bootstrapWhitelist.includes(certificate.fingerprint)) {
  return NextResponse.json(
    { error: 'Not whitelisted as bootstrap node' },
    { status: 403 }
  );
}
```

---

## WebTorrent Integration

### Large File Distribution Problem

**Scenario:**
- Repositories contain metadata/scripts
- Users have large media files outside repos
- Traditional peer-to-peer: each peer must host entire file
- Bottleneck: Single peer's upload bandwidth

**Solution:** WebTorrent (BitTorrent over WebSocket)

### WebTorrent Architecture

**File Hashing:**
```typescript
interface TorrentFile {
  path: string;                   // File location
  info_hash: string;              // SHA-256 hash
  magnet_link: string;            // magnet:?xt=urn:btih:...
  size: number;                   // File size
  created_by: string;             // Peer email
  announced_at: Date;
  tracker_urls: string[];         // WebTorrent trackers
  seeders: number;                // Active seeds
  leechers: number;               // Active downloads
}
```

**Seed Management:**
```
User adds large file to shared directory
    │
    ├─► Calculate SHA-256 hash
    ├─► Generate torrent metadata
    ├─► Announce via gossip protocol
    │   (includes magnet link)
    │
    └─► Start seeding:
        ├─ Connect to WebTorrent DHT
        ├─ Listen for download requests
        └─ Serve file chunks to swarm
```

**Download Flow:**
```
Peer wants large file (via torrent hash)
    │
    ├─► Announce in gossip: "Looking for torrent X"
    ├─► Receive list of seeders
    │
    ├─► Connect to WebTorrent DHT
    ├─► Add seeders to peer list
    │
    └─► Download:
        ├─ Fetch from fastest seeders
        ├─ Become seeder for others
        └─ Cache locally
```

### Integration with Gossip

**Announce Torrent:**
```typescript
{
  type: 'PEER_ANNOUNCEMENT',
  payload: {
    origin: peer,
    torrent: {
      info_hash: 'abc123...',
      magnet_link: 'magnet:?xt=urn:btih:...',
      size: 1_000_000_000,
      seeders: 3
    }
  }
}
```

**Search for Torrent:**
```typescript
{
  type: 'PEER_REQUEST',
  payload: {
    torrent_search: {
      info_hash: 'abc123...'
    }
  }
}
```

---

## State Machines

### Peer Lifecycle

```
    ┌─────────────────────┐
    │   NOT_DISCOVERED    │
    └──────────┬──────────┘
               │ Announced in gossip
               ▼
    ┌─────────────────────┐
    │   DISCOVERED        │
    └──────────┬──────────┘
               │ Connection established
               ▼
    ┌─────────────────────┐
    │   CONNECTED         │
    └──────────┬──────────┘
               │
      ┌────────┴────────┐
      │                 │
      │            No heartbeat for 30 min
      │                 │
      │                 ▼
      │      ┌─────────────────────┐
      │      │   STALE             │ (still in table, not trusted)
      │      └─────────────────────┘
      │
  Heartbeat received / refreshed
      │
      └────► Back to CONNECTED
               │
      No activity for 2 hours
               │
               ▼
    ┌─────────────────────┐
    │   EXPIRED           │ (removed from table)
    └─────────────────────┘
```

### Bootstrap Registration Lifecycle

```
    ┌──────────────┐
    │  NOT_READY   │
    └──────┬───────┘
           │ User enables broadcast/ready
           │ Selects repositories
           ▼
    ┌──────────────┐
    │  REGISTERING │
    └──────┬───────┘
           │ POST /api/bootstrap/register
           │ Relay stores entry
           ▼
    ┌──────────────┐
    │  REGISTERED  │ (TTL-based, expires in 1 hour)
    └──────┬───────┘
           │
      ┌────┴─────┐
      │           │
 Heartbeat   No heartbeat
  every 30s   for 15 min
      │           │
      │           ▼
      │    ┌──────────────┐
      │    │  STALE       │ (still reachable but unresponsive)
      │    └──────────────┘
      │
      └────────────────────┘
                 │
      DELETE /api/bootstrap/unregister
                 │
                 ▼
    ┌──────────────┐
    │  UNREGISTERED│
    └──────────────┘
```

---

## Sequence Diagrams

### Sequence 1: Bootstrap Registration and Initial Gossip

```
Client A          Relay            Bootstrap 1      Bootstrap 2
   │               │                   │                │
   │─ register ──►│                   │                │
   │  POST        │                   │                │
   │              ├─ verify cert      │                │
   │              ├─ store            │                │
   │              │                   │                │
   │◄─ response ──┤                   │                │
   │  peers[]     │                   │                │
   │              │                   │                │
   │─ announce ──────────────────────►│                │
   │  (gossip)    │                   │                │
   │              │                   ├─ update table  │
   │              │                   │                │
   │              │                   │─ forward ─────►│
   │              │                   │  (TTL-1)       │
   │              │                   │                ├─update
   │              │                   │                │
   │◄─ announce ──────────────────────┤                │
   │  from B1     │                   │                │
   │              │                   │                │
   │◄─ announce ───────────────────────────────────────┤
   │  from B2     │                   │                │
   │              │                   │                │
   └─ peer table now has B1 + B2 info
```

### Sequence 2: Repository Discovery from Non-Broadcasting Peer

```
Client C (Silent)  Client B (Bootstrap)   Relay    Bootstrap 1
   │                     │                  │           │
   │ wants repos         │                  │           │
   │ repo1,repo2         │                  │           │
   │                     │                  │           │
   │─ PEER_REQUEST ─────►│                  │           │
   │  (repo1,repo2)      │                  │           │
   │                     │                  │           │
   │◄─ PEER_LIST ────────┤                  │           │
   │  [B1, Bootstrap1]   │                  │           │
   │  (no C's IP)        │                  │           │
   │                     │                  │           │
   │─ PEER_REQUEST ────────────────────────►│           │
   │                     │                  │           │
   │◄─ PEER_LIST ─────────────────────────────           │
   │  [B2, Bootstrap2]   │                  │           │
   │                     │                  │           │
   └─ peer table updated
     (found 2 broadcasting peers with repo1,repo2)
```

### Sequence 3: WebTorrent File Announcement

```
Seeder          Peer Discovery      Peer D
   │               │                  │
   │ file ready    │                  │
   │ (large)       │                  │
   │               │                  │
   ├─ hash file    │                  │
   ├─ gen torrent  │                  │
   │               │                  │
   │─ ANNOUNCE ───►│ TORRENT          │
   │  (magnet)     │                  │
   │               ├─ gossiped to D   │
   │               │                  │
   │               │◄─ PEER_REQUEST ──┤
   │               │  (torrent hash)  │
   │               │                  │
   │◄─ RESPONSE ───┤ (seeder info)    │
   │  [Seeder,...]├─────────────────►│
   │               │                  │
   │               │         D connects to Seeder
   │◄─────────── WebTorrent Protocol ──────────────►│
   │  (chunks)     │              D becomes Seeder    │
   │               │                  │
```

---

## Implementation Phases

### Phase 1: Bootstrap Node Infrastructure (Weeks 1-2)

**Changes to Relay Tracker:**
1. Modify `/api/relay/broadcast/ready` to mark as bootstrap node
2. Add `/api/bootstrap/register` endpoint
3. Add `/api/bootstrap/unregister` endpoint
4. Add `/api/bootstrap/discover` endpoint
5. Update database schema: add `is_bootstrap`, `is_broadcasting` flags
6. Implement TTL-based expiration for bootstrap nodes

**No Changes Required:**
- Existing `/api/relay/broadcast/lookup` still works for non-broadcasting peers
- Existing `/api/relay/broadcast/list` still works for compatibility

**Testing:**
- Bootstrap registration/unregistration
- Bootstrap peer discovery
- TTL expiration logic

### Phase 2: Gossip Protocol Handler (Weeks 2-3)

**New Component:** `client/src-tauri/src/gossip.rs`

**Responsibilities:**
1. Peer table management (in-memory)
2. Gossip message handling
3. Message validation and verification
4. Peer sharing rule enforcement
5. TTL and expiration tracking

**Key Functions:**
```rust
pub async fn start_gossip_protocol(peers: Vec<BootstrapPeer>) -> Result<()>
pub async fn send_peer_announcement(peer_info: PeerInfo) -> Result<()>
pub async fn handle_gossip_message(message: GossipMessage) -> Result<()>
pub async fn get_peers_for_repo(repo: &str) -> Result<Vec<PeerInfo>>
pub async fn forward_gossip_with_ttl(message: GossipMessage, ttl: u32) -> Result<()>
```

**Testing:**
- Message deduplication
- TTL decrement
- Peer table updates
- IP sharing rule enforcement

### Phase 3: Client Integration (Weeks 3-4)

**Update BroadcastSection.tsx:**
1. Check if broadcasting, if yes: register as bootstrap
2. Initialize gossip protocol on registration
3. Update UI to show bootstrap status
4. Implement peer table browser UI

**Update Tauri API Bridge:**
1. Add `apiDiscoverPeers(repositories: string[])` method
2. Add `apiGetPeerTable()` method
3. Add `apiRegisterBootstrap(repos: RepositorySummary[])` method

**Testing:**
- Gossip connectivity
- Peer discovery accuracy
- UI state consistency

### Phase 4: WebTorrent Integration (Weeks 4-5)

**Add WebTorrent Handler:** `client/src-tauri/src/torrent.rs`

**Key Functions:**
```rust
pub async fn hash_file(path: &str) -> Result<String>  // SHA-256
pub async fn create_torrent(file: &str, magnet: &str) -> Result<TorrentMetadata>
pub async fn start_seeding(torrent: TorrentMetadata) -> Result<()>
pub async fn search_torrent(info_hash: &str) -> Result<Vec<Seeder>>
pub async fn download_torrent(magnet_link: &str, dest: &str) -> Result<()>
```

**Dependencies:**
- webtorrent npm package
- Node.js subprocess for torrent handling

**Integration with Gossip:**
- Announce torrents via PEER_ANNOUNCEMENT
- Search torrents via PEER_REQUEST

### Phase 5: Performance Optimization (Weeks 5-6)

**Availability Scoring:**
```typescript
availability_score = (heartbeats_received / total_expected) * 100
// Based on: last 24 hours, rolling window
```

**Performance Scoring:**
```typescript
performance_score = 1 / (avg_response_time_ms / 1000)
// Normalized to 0-100 scale
// Based on: request latency to peer's API
```

**Peer Sorting:**
```typescript
const scoredPeers = peers
  .map(p => ({
    ...p,
    score: (p.availability_score * 0.6) + (p.performance_score * 0.4)
  }))
  .sort((a, b) => b.score - a.score);
```

### Phase 6: Testing & Documentation (Weeks 6+)

**Test Suite:**
- Bootstrap node registration/discovery
- Gossip message propagation
- IP sharing rule enforcement
- Peer table accuracy
- WebTorrent seeding/downloading
- Performance scoring

**Documentation:**
- Gossip protocol specification
- WebTorrent integration guide
- Peer discovery troubleshooting
- Network topology analysis tools

---

## Future Enhancements

### 1. Bootstrap Whitelist

Currently: Anyone can enable broadcast to become bootstrap
Future: Whitelist of trusted bootstrap operators

```typescript
const whitelist = [
  'trusted-org@example.com',
  'community-node@example.com'
];
```

### 2. Reputation System

- Track peer availability over time
- Penalize peers that go offline frequently
- Reward peers with consistent uptime
- Share reputation via gossip

### 3. NAT Traversal

- STUN/TURN for non-broadcasting peers
- Hole punching techniques
- Relay for unreachable peers

### 4. Content Addressing

- Store large files by content hash
- Deduplicate across network
- Integration with IPFS-like systems

### 5. Consensus Mechanisms

- Detect malicious peers
- Verify peer information via multiple sources
- Byzantine fault tolerance for peer list

---

## Migration Path from Old to New

### Phase 1: Dual Operation (Relay + Bootstrap)

**Period:** 1-2 months

**How:**
- Bootstrap nodes still report to relay tracker
- Relay tracker accepts both old and new formats
- Clients gradually migrate to gossip protocol

**Compatibility:**
```typescript
// Old way still works
GET /api/relay/broadcast/lookup?email=user@example.com

// New way also available
GET /api/bootstrap/discover?repositories=repo1,repo2
```

### Phase 2: Gossip Primary, Relay Fallback

**Period:** 2-3 months

**How:**
- Clients prefer gossip discovery
- Fall back to relay if gossip unavailable
- Relay continues operating for compatibility

**Code:**
```typescript
async function discoverPeers(repos: string[]) {
  try {
    // Try gossip first (fastest)
    return await gossipDiscovery(repos);
  } catch {
    // Fall back to relay (slow but reliable)
    return await relayDiscovery(repos);
  }
}
```

### Phase 3: Relay Deprecation

**Period:** 3+ months

**How:**
- Relay tracker becomes optional
- Bootstrap nodes fully autonomous
- Gossip protocol handles all discovery

---

## Conclusion

This architecture shift moves Flashback from a centralized relay tracker to a decentralized peer network with:
- **Bootstrap nodes** for initial discovery
- **Gossip protocol** for peer information sharing
- **Privacy-respecting IP sharing** (only for broadcasting peers)
- **WebTorrent integration** for large file distribution
- **Availability/performance scoring** for smart peer selection

The design maintains security through certificate-based authentication while improving resilience, scalability, and user privacy.
