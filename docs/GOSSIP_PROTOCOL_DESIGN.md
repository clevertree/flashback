# Gossip Protocol Specification

**Status:** Detailed Specification  
**Date:** October 31, 2025  
**Version:** 1.0  
**Transport:** WebSocket (with UDP fallback)  
**Format:** JSON with optional binary payloads

---

## Table of Contents

1. [Overview](#overview)
2. [Protocol Layers](#protocol-layers)
3. [Message Types](#message-types)
4. [Connection Management](#connection-management)
5. [Message Delivery Semantics](#message-delivery-semantics)
6. [Peer Table Updates](#peer-table-updates)
7. [Conflict Resolution](#conflict-resolution)
8. [Performance & Tuning](#performance--tuning)
9. [Security](#security)
10. [Examples](#examples)

---

## Overview

### Properties

- **Epidemic Algorithm:** Information spreads probabilistically through network
- **Eventually Consistent:** All peers learn about all information (given enough time)
- **Partial Knowledge:** No peer knows entire network
- **Scalable:** Works with arbitrary number of peers
- **Fault Tolerant:** Works with packet loss, peer crashes
- **Privacy-Aware:** Respects IP sharing rules

### Trade-offs

| Aspect | Benefit | Trade-off |
|--------|---------|-----------|
| **Eventual Consistency** | Decentralized, no coordinator | Temporary inconsistencies |
| **Probabilistic Forwarding** | Reduces bandwidth | Slower information spread |
| **TTL-based Loops** | Simple loop prevention | Messages might not reach far |
| **Partial Knowledge** | Privacy, scalability | May not know all peers |

---

## Protocol Layers

### Layer 1: Connection Management

**Responsibility:** Establish and maintain peer connections

**Protocol:** WebSocket (secure)

**URL Format:**
```
wss://peer.example.com:8080/gossip?peer_id=abc123&email=user@example.com
```

**Query Parameters:**
- `peer_id`: Unique identifier for this peer's session
- `email`: Peer's email (for identification)
- `certificate`: Optional, sender's public certificate

### Layer 2: Message Framing

**Responsibility:** Deliver complete messages reliably

**Frame Format:**
```json
{
  "id": "msg-uuid-12345",
  "type": "PEER_ANNOUNCEMENT",
  "version": 1,
  "timestamp": "2025-10-31T12:00:00Z",
  "payload": { ... },
  "checksum": "sha256:abc123..."
}
```

**Fragmentation** (for large messages):
```json
{
  "id": "msg-uuid-12345",
  "fragment": {
    "index": 0,
    "total": 3,
    "data": "base64-encoded-chunk"
  }
}
```

### Layer 3: Epidemic Algorithm

**Responsibility:** Distribute information through network

**Fan-out:** 3 (forward to 3 random peers)  
**TTL:** 32 hops  
**Retransmit:** 5% probability for seen messages

---

## Message Types

### 1. HELLO (Connection Establishment)

**Sent by:** Any peer upon connection  
**Direction:** Bidirectional  
**Frequency:** Once per connection

**Payload:**
```typescript
{
  type: 'HELLO';
  sender: {
    email: string;
    peer_id: string;
    is_broadcasting: boolean;
    is_bootstrap: boolean;
  };
  capabilities: {
    max_message_size: number;        // bytes
    supports_fragmentation: boolean;
    supports_compression: boolean;
    gossip_version: number;          // 1
  };
  repositories: RepositorySummary[];
  timestamp: Date;
  ttl?: never;  // No TTL for direct messages
}
```

**Example:**
```json
{
  "type": "HELLO",
  "sender": {
    "email": "alice@example.com",
    "peer_id": "peer-abc123",
    "is_broadcasting": true,
    "is_bootstrap": true
  },
  "capabilities": {
    "max_message_size": 1048576,
    "supports_fragmentation": true,
    "supports_compression": true,
    "gossip_version": 1
  },
  "repositories": [
    { "name": "films", "description": "Movie collection" }
  ],
  "timestamp": "2025-10-31T12:00:00Z"
}
```

**Response:**
Receiver sends back HELLO with its own information

---

### 2. PEER_ANNOUNCEMENT

**Sent by:** Any peer that learns about another peer  
**Direction:** Broadcast via gossip  
**Frequency:** When peer comes online, or periodically for updates

**Payload:**
```typescript
{
  type: 'PEER_ANNOUNCEMENT';
  id: string;  // UUID for deduplication
  ttl: number; // 32 initially, decrements on each forward
  
  origin: {
    // The peer being announced
    email: string;
    peer_id: string;
    public_certificate: string;
    
    socket_addresses?: string[];  // ONLY if is_broadcasting=true
    port?: number;                // ONLY if is_broadcasting=true
    
    is_broadcasting: boolean;
    is_bootstrap: boolean;
    
    repositories: RepositorySummary[];
    capabilities?: {
      max_peers: number;
      supports_torrent: boolean;
      bandwidth_estimate: number;
    };
  };
  
  source: {
    // Who is forwarding this announcement
    email: string;
    peer_id: string;
  };
  
  timestamp: Date;  // When first announced
  last_updated: Date;  // Last change
}
```

**Example:**
```json
{
  "type": "PEER_ANNOUNCEMENT",
  "id": "announce-xyz789",
  "ttl": 30,
  "origin": {
    "email": "bob@example.com",
    "peer_id": "peer-def456",
    "public_certificate": "-----BEGIN CERTIFICATE-----\n...",
    "socket_addresses": ["192.168.1.50", "10.0.0.20"],
    "port": 8080,
    "is_broadcasting": true,
    "is_bootstrap": false,
    "repositories": [
      { "name": "films" },
      { "name": "tv-shows" }
    ]
  },
  "source": {
    "email": "alice@example.com",
    "peer_id": "peer-abc123"
  },
  "timestamp": "2025-10-31T12:00:00Z",
  "last_updated": "2025-10-31T12:00:00Z"
}
```

**Processing Rules:**
1. Verify TTL > 0
2. Check if ID in bloom filter (deduplication)
3. Extract peer info respecting IP sharing rules:
   ```typescript
   const peerInfo = {
     ...origin,
     // Only include socket if broadcasting
     socket_addresses: origin.is_broadcasting ? origin.socket_addresses : undefined
   };
   ```
4. Update local peer table with newer timestamp
5. Forward to 3 random peers with TTL-1

---

### 3. PEER_REQUEST

**Sent by:** Client searching for peers with specific repositories  
**Direction:** Broadcast via gossip  
**Frequency:** On-demand when client needs peers

**Payload:**
```typescript
{
  type: 'PEER_REQUEST';
  id: string;  // UUID for correlating responses
  ttl: number; // 16 initially (shorter than announcements)
  
  sender: {
    email: string;
    peer_id: string;
    is_broadcasting: boolean;
  };
  
  repositories: string[];  // List of repo names to find
  
  exclude_email?: string;  // Don't return info about yourself
  
  timestamp: Date;
}
```

**Example:**
```json
{
  "type": "PEER_REQUEST",
  "id": "request-123",
  "ttl": 16,
  "sender": {
    "email": "charlie@example.com",
    "peer_id": "peer-ghi789",
    "is_broadcasting": false
  },
  "repositories": ["films", "tv-shows"],
  "exclude_email": "charlie@example.com",
  "timestamp": "2025-10-31T12:00:05Z"
}
```

**Processing Rules:**
1. Extract repositories from request
2. Query local peer table for matches
3. If found: send PEER_LIST_RESPONSE
4. If not found: optionally forward with TTL-1
5. Keep track of request ID to avoid loops

---

### 4. PEER_LIST_RESPONSE

**Sent by:** Peer responding to PEER_REQUEST  
**Direction:** Reply to requester (via gossip if needed)  
**Frequency:** For each PEER_REQUEST received

**Payload:**
```typescript
{
  type: 'PEER_LIST_RESPONSE';
  request_id: string;  // Correlate with PEER_REQUEST.id
  ttl: number; // 16 (same as request)
  
  sender: {
    email: string;
    peer_id: string;
  };
  
  peers: Array<{
    email: string;
    peer_id: string;
    
    socket_addresses?: string[];  // ONLY if is_broadcasting=true
    port?: number;
    
    is_broadcasting: boolean;
    is_bootstrap: boolean;
    
    repositories: RepositorySummary[];
    
    availability_score?: number;  // 0-100
    performance_score?: number;   // 0-100
    
    last_seen: Date;
  }>;
  
  timestamp: Date;
}
```

**Example:**
```json
{
  "type": "PEER_LIST_RESPONSE",
  "request_id": "request-123",
  "ttl": 16,
  "sender": {
    "email": "alice@example.com",
    "peer_id": "peer-abc123"
  },
  "peers": [
    {
      "email": "bob@example.com",
      "peer_id": "peer-def456",
      "socket_addresses": ["192.168.1.50"],
      "port": 8080,
      "is_broadcasting": true,
      "is_bootstrap": false,
      "repositories": [
        { "name": "films" },
        { "name": "tv-shows" }
      ],
      "availability_score": 98,
      "performance_score": 92,
      "last_seen": "2025-10-31T11:59:00Z"
    }
  ],
  "timestamp": "2025-10-31T12:00:05Z"
}
```

**Processing Rules:**
1. Check if request_id matches a sent PEER_REQUEST
2. Update local peer table with received peers
3. Filter by requested repositories before returning
4. Only include socket_addresses if is_broadcasting=true

---

### 5. HEARTBEAT

**Sent by:** Bootstrap nodes periodically  
**Direction:** Broadcast via gossip  
**Frequency:** Every 30 seconds (for bootstrap nodes)

**Payload:**
```typescript
{
  type: 'HEARTBEAT';
  id: string;  // UUID for deduplication
  ttl: number; // 2 (short range)
  
  sender: {
    email: string;
    peer_id: string;
    is_bootstrap: boolean;
  };
  
  stats?: {
    peer_table_size: number;
    messages_forwarded: number;
    uptime_seconds: number;
  };
  
  timestamp: Date;
}
```

**Example:**
```json
{
  "type": "HEARTBEAT",
  "id": "heartbeat-456",
  "ttl": 2,
  "sender": {
    "email": "bootstrap1@example.com",
    "peer_id": "peer-boot1",
    "is_bootstrap": true
  },
  "stats": {
    "peer_table_size": 47,
    "messages_forwarded": 1230,
    "uptime_seconds": 86400
  },
  "timestamp": "2025-10-31T12:00:00Z"
}
```

**Processing Rules:**
1. Update "last_seen" for sender in peer table
2. If TTL > 0, optionally forward (low priority)
3. Use to detect peer downtime

---

### 6. PEER_UPDATE

**Sent by:** Peer updating its own information  
**Direction:** Broadcast via gossip  
**Frequency:** When status changes (goes online/offline, repos change)

**Payload:**
```typescript
{
  type: 'PEER_UPDATE';
  id: string;
  ttl: number; // 32
  
  sender: {
    email: string;
    peer_id: string;
  };
  
  updates: {
    repositories?: RepositorySummary[];  // New repos list
    is_broadcasting?: boolean;           // Changed broadcast status
    is_bootstrap?: boolean;              // Changed bootstrap status
    socket_addresses?: string[];         // New addresses (if broadcasting)
    port?: number;                       // New port
    status?: 'online' | 'offline';       // Status change
  };
  
  timestamp: Date;
  sequence_number: number;  // For ordering updates
}
```

**Example:**
```json
{
  "type": "PEER_UPDATE",
  "id": "update-789",
  "ttl": 32,
  "sender": {
    "email": "alice@example.com",
    "peer_id": "peer-abc123"
  },
  "updates": {
    "repositories": [
      { "name": "films" },
      { "name": "tv-shows" },
      { "name": "documentaries" }
    ],
    "is_broadcasting": true,
    "port": 8080
  },
  "timestamp": "2025-10-31T12:01:00Z",
  "sequence_number": 42
}
```

---

## Connection Management

### Establishing Connection

```typescript
// 1. Client initiates WebSocket connection
const socket = new WebSocket(
  `wss://${peer.socket_addresses[0]}:${peer.port}/gossip?` +
  `peer_id=${ourPeerId}&email=${ourEmail}`
);

// 2. On connection established
socket.addEventListener('open', () => {
  // Send HELLO message
  sendMessage({
    type: 'HELLO',
    sender: { email: ourEmail, peer_id: ourPeerId, ... },
    ...
  });
});

// 3. Receive peer's HELLO
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'HELLO') {
    // Store peer connection info
    peerTable.updatePeer(message.sender);
    // Start sending announcements
    startGossip();
  }
});
```

### Maintaining Connection

**Heartbeat (keep-alive):**
```typescript
setInterval(() => {
  if (socket.readyState === WebSocket.OPEN) {
    sendMessage({
      type: 'HEARTBEAT',
      sender: { ... },
      timestamp: new Date()
    });
  }
}, 30_000);  // Every 30 seconds
```

**Reconnection:**
```typescript
socket.addEventListener('close', () => {
  const delay = exponentialBackoff(attemptCount);
  setTimeout(() => {
    attemptCount++;
    connectToPeer(peer);
  }, delay);
});
```

---

## Message Delivery Semantics

### Guaranteed Delivery

**Not guaranteed.** Gossip protocol is best-effort because:
- Messages may be dropped if TTL expires
- Network packets can be lost
- Peers can crash unexpectedly

**Mitigation:**
- Periodic re-announcements
- Redundant paths (multiple peers forward)
- High redundancy factor (fan-out = 3)

### Ordering

**Partial ordering** via sequence numbers in PEER_UPDATE messages

```typescript
// Process updates in order
const updates = new Map<string, PeerUpdate[]>();

for (const update of incomingUpdates) {
  const peer_key = update.sender.email;
  if (!updates.has(peer_key)) {
    updates.set(peer_key, []);
  }
  updates.get(peer_key)!.push(update);
}

// Sort by sequence number and apply
for (const [email, updates_list] of updates) {
  updates_list.sort((a, b) => a.sequence_number - b.sequence_number);
  for (const update of updates_list) {
    applyUpdate(email, update);
  }
}
```

### Idempotence

**Messages are idempotent** (can apply multiple times safely):

```typescript
// Updating peer info is idempotent
updatePeerInfo({
  email: 'bob@example.com',
  repositories: ['films', 'tv']
});

// If received twice, same result
updatePeerInfo({
  email: 'bob@example.com',
  repositories: ['films', 'tv']
});
// Result: unchanged
```

---

## Peer Table Updates

### Update Rules

**1. New Peer (not in table)**
```typescript
if (!peerTable.has(email)) {
  peerTable.set(email, {
    ...peerInfo,
    discovered_at: now,
    last_seen: now,
    status: 'online'
  });
  return 'INSERTED';
}
```

**2. Existing Peer (newer timestamp)**
```typescript
const existing = peerTable.get(email);
if (announcement.timestamp > existing.last_updated) {
  peerTable.update(email, {
    ...peerInfo,
    last_updated: announcement.timestamp,
    last_seen: now
  });
  return 'UPDATED';
}
```

**3. Existing Peer (older timestamp)**
```typescript
// Ignore (older information)
return 'IGNORED';
```

**4. Duplicate Message (same ID)**
```typescript
if (seenMessageIds.has(announcement.id)) {
  return 'DUPLICATE';
}
```

### Conflict Resolution

**Multi-source Information:**

If peer info comes from multiple sources with different timestamps:

```typescript
const sources = [
  { source: 'bootstrap1', timestamp: T1, data: {...} },
  { source: 'bootstrap2', timestamp: T2, data: {...} },
  { source: 'peer3', timestamp: T3, data: {...} }
];

// Use latest timestamp (Last-Writer-Wins)
const newest = sources.sort((a, b) => b.timestamp - a.timestamp)[0];
applyUpdate(newest.data);
```

**IP Address Conflict:**

If same email reported from multiple IPs:

```typescript
// Trust bootstrap nodes over regular peers
if (announcement.sender.is_bootstrap) {
  trust_level = 'high';
  apply_immediately();
} else {
  trust_level = 'medium';
  verify_with_bootstrap_if_available();
}
```

---

## Performance & Tuning

### Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Fan-out** | 3 | Redundancy without broadcast storm |
| **Initial TTL** | 32 | Reaches ~200 peers with fan-out=3 |
| **Heartbeat interval** | 30s | Detect death in ~2 min |
| **Announcement interval** | Random 5-15min | Periodic refresh |
| **Message retransmit prob** | 5% | Catch lost messages |
| **Bloom filter size** | 100,000 | Dedup recent messages |

### Optimization: Bloom Filter

Prevent re-processing seen messages:

```typescript
class MessageDeduplicator {
  private bloomFilter = new BloomFilter(100_000);
  private seen = new Set<string>();

  isSeen(messageId: string): boolean {
    return this.bloomFilter.has(messageId);
  }

  mark(messageId: string): void {
    this.bloomFilter.add(messageId);
    this.seen.add(messageId);
  }

  // Clear old entries every hour
  cleanup(): void {
    if (this.seen.size > 50_000) {
      this.bloomFilter = new BloomFilter(100_000);
      this.seen.clear();
    }
  }
}
```

### Bandwidth Estimation

**Per-peer gossip bandwidth:**

```
Message size: ~1 KB (typical)
Fan-out: 3
Forward rate: 1 message per peer per 5 seconds

Bandwidth = (1 KB) × (3) × (1 per 5s)
          = 600 bytes/second per peer
          = ~5 Mbps for 1000 peers
```

### Latency Estimation

**Information spread time:**

```
With fan-out=3 and TTL=32:
- Reaches ~3^10 ≈ 59,000 peers
- Each hop = 1-5 seconds
- Total time to reach all: ~50-250 seconds

For emergency announcements, can reduce TTL
to prioritize speed over distance.
```

---

## Security

### Message Verification

```typescript
function verifyMessage(message: GossipMessage): boolean {
  // 1. Check TTL valid
  if (message.ttl < 0 || message.ttl > 32) return false;

  // 2. Check timestamp valid (not in future)
  const now = Date.now();
  const msgTime = new Date(message.timestamp).getTime();
  if (msgTime > now + 30_000) return false;  // 30s clock skew tolerance

  // 3. Check sender known (in peer table)
  if (!peerTable.has(message.sender.email)) {
    // Unknown sender - may be new peer, accept but mark tentative
    return true;  // Accept from bootstrap
  }

  // 4. Verify certificate signature if present
  if (message.origin?.public_certificate) {
    return verifySignature(message, message.origin.public_certificate);
  }

  return true;
}
```

### IP Sharing Enforcement

```typescript
function enforceIPSharing(message: GossipMessage): GossipMessage {
  const cleaned = {
    ...message,
    origin: {
      ...message.origin
    }
  };

  // Only include IP if broadcasting
  if (!message.origin.is_broadcasting) {
    delete cleaned.origin.socket_addresses;
    delete cleaned.origin.port;
  }

  return cleaned;
}
```

### Sybil Attack Prevention

**Limit:** Each email can only have 1 active peer_id

```typescript
function registerPeer(email: string, peer_id: string): void {
  if (peerTable.has(email)) {
    const existing = peerTable.get(email);
    if (existing.peer_id !== peer_id) {
      // Different peer_id for same email
      // Accept if new entry is from relay tracker (more authoritative)
      if (!fromRelayTracker) {
        return;  // Reject Sybil attempt
      }
    }
  }
  peerTable.set(email, { email, peer_id, ... });
}
```

---

## Examples

### Example 1: New Peer Joins Network

```
Timeline:

T0: Charlie comes online
    ├─ Generates peer_id: "peer-xyz"
    ├─ Registers with relay as bootstrap
    ├─ Relay returns: [Alice, Bob] as bootstrap peers
    └─ Peer table: [Alice, Bob]

T1: Charlie connects to Alice
    ├─ Opens WebSocket to Alice
    ├─ Sends HELLO
    └─ Receives Alice's HELLO

T2: Charlie connects to Bob
    ├─ Opens WebSocket to Bob
    ├─ Sends HELLO
    └─ Receives Bob's HELLO

T3-T4: Gossip starts
    ├─ Receives HELLO from Alice
    │  └─ Peer table: [Alice, Bob]
    ├─ Receives HELLO from Bob
    │  └─ Peer table: [Alice, Bob]
    ├─ Receives PEER_ANNOUNCEMENT from Alice (about David)
    │  └─ Peer table: [Alice, Bob, David]
    └─ Forwards David's announcement to Bob with TTL-1

T5: Charlie searches for "films" repo
    ├─ Sends PEER_REQUEST to random peers
    ├─ Receives PEER_LIST_RESPONSE with [Alice, Bob, David]
    └─ Connects to highest-scored peer (Alice)
```

### Example 2: Peer Update Propagation

```
Timeline:

T0: Alice adds new repository "podcasts"
    ├─ Updates local info
    ├─ Increments sequence_number: 43
    └─ Creates PEER_UPDATE message

T1: Alice sends PEER_UPDATE
    ├─ To: Bob, Charlie, David (fan-out=3)
    ├─ Message includes:
    │  - repositories: [..., {name: "podcasts"}]
    │  - sequence_number: 43
    └─ TTL: 32

T2: Bob receives PEER_UPDATE
    ├─ Updates Alice in peer table
    ├─ Forwards to: Charlie, Eve, Frank
    └─ TTL: 31

T3: Charlie receives from Alice
    ├─ Updates Alice in peer table
    └─ Forwards to: Bob, Dave, Grace

T4: David receives (gossip path)
    ├─ Checks sequence_number
    ├─ If seq > existing: update
    ├─ If seq < existing: ignore
    └─ Forwards with TTL-30

...

T∞: All peers eventually know Alice has "podcasts" repo
```

### Example 3: Non-Broadcasting Peer Discovery

```
Timeline:

T0: Charlie (non-broadcasting) wants "films"
    ├─ is_broadcasting: false
    ├─ Sends PEER_REQUEST: {repositories: ["films"]}
    └─ TTL: 16

T1: Alice (broadcasting) receives request
    ├─ Queries peer table for "films"
    ├─ Finds: Bob (filming repo), David (filming repo)
    ├─ Sends PEER_LIST_RESPONSE
    │  - Includes Bob's socket_addresses (is_broadcasting=true)
    │  - Includes David's socket_addresses (is_broadcasting=true)
    │  - Does NOT include Charlie's info (Charlie is non-broadcasting)
    └─ TTL: 16

T2: Charlie receives response
    ├─ Peer table updated: [Bob, David]
    ├─ Both have socket_addresses (they're broadcasting)
    ├─ Scores: Bob=90, David=85
    └─ Connects to Bob

T3: Charlie connects to Bob (but Bob doesn't know Charlie's IP)
    ├─ Charlie initiates connection (outbound)
    ├─ Bob accepts connection
    ├─ Communication established
    └─ Charlie remains "hidden" to network
```

---

## Appendix: Pseudocode

### Main Gossip Loop

```rust
async fn gossip_loop() {
  // Initialize
  let peer_table = PeerTable::new();
  let message_dedup = MessageDeduplicator::new();
  
  // Bootstrap: Connect to bootstrap nodes
  let bootstrap_peers = query_relay_for_bootstrap().await?;
  for peer in bootstrap_peers {
    connect_to_peer(&peer).await?;
  }
  
  // Main loop
  loop {
    select! {
      // Receive incoming gossip
      Some(message) = peer_updates.recv() => {
        if message_dedup.is_seen(&message.id) {
          continue;  // Already seen
        }
        
        // Verify and process
        if verify_message(&message) {
          message_dedup.mark(&message.id);
          peer_table.update_from_message(&message);
          
          // Forward with TTL-1
          if message.ttl > 0 {
            if should_forward(&message) {
              forward_to_random_peers(&message).await?;
            }
          }
        }
      }
      
      // Send periodic heartbeat
      _ = heartbeat_ticker.tick() => {
        send_heartbeat_to_peers().await?;
      }
      
      // Handle peer requests
      Some(request) = requests.recv() => {
        let peers = peer_table.find_by_repo(&request.repositories);
        send_response(peers).await?;
      }
    }
  }
}
```

---

## Conclusion

This gossip protocol provides decentralized peer discovery with:
- Simple message types (6 types total)
- Epidemic algorithm for information spread
- Privacy-respecting IP sharing
- Fault tolerance to peer crashes
- Scalable to large networks

Implementation should follow the sequences and examples provided to ensure compatibility across clients.
