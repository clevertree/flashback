# Phase 2 Revised: Relay Tracker Implementation (Prerequisite)

**Date:** October 30, 2025  
**Status:** Phase 2 requires Relay Tracker - this is the critical path  
**Duration:** Estimated 2-3 weeks

---

## Phase 2 Scope Revision

Your clarification reveals that **Phase 2 is actually THREE parallel work streams:**

1. **Peer Server HTTP File Serving** ✅ DONE
   - HTTP file server on Rust/Axum ✅
   - Endpoints: `/api/files`, `/content/*`, `/download/*` ✅
   - File preview in React ✅

2. **Relay Tracker Implementation** ⏳ NOT STARTED (CRITICAL)
   - Client registration (certificate + email)
   - Broadcast ready API (mutual TLS)
   - Broadcast lookup API (mutual TLS)
   - Peer list management
   - Certificate storage

3. **Client Integration** ⏳ PARTIAL
   - Generate self-signed certificates ✅ Needed
   - Register with relay on startup ✅ Needed
   - Query relay to get peer list ✅ Needed
   - Try addresses in order ✅ Needed
   - Address list handling ✅ Needed

---

## Why Phase 2 Needs Relay Tracker

**Current State:**
- ✅ Peer Server works locally
- ❌ No way for two clients to find each other
- ❌ Phase 2 is incomplete without discovery

**With Relay Tracker:**
- ✅ Client A announces: "I'm online at 192.168.1.50:54321"
- ✅ Client B queries: "Find user.a@example.com"
- ✅ Client B connects: "Found them! Now visiting files..."
- ✅ Phase 2 is complete end-to-end

---

## Phase 2.1: Relay Tracker Backend

**Location:** `/server` directory (Next.js backend)

### Implementation Tasks

#### 2.1.1 Certificate Registration Endpoint
```
✓ POST /api/relay/register
  Input: certificate (PEM) + email
  Validation:
    - Valid certificate format
    - Email matches certificate CN
    - Email not already registered
  Storage:
    - Store certificate + email in database
    - Create client ID
  Response: 200 OK or 409 Conflict
```

**Estimated:** 1-2 days
**Tech:** 
- Next.js API route
- Certificate parsing library
- PostgreSQL/MongoDB for storage
- Unique email constraint

#### 2.1.2 Broadcast Ready Endpoint (Mutual TLS)
```
✓ POST /api/relay/broadcast/ready
  Auth: Mutual TLS (validate client certificate)
  Input: port, addresses (v4 + v6), capabilities
  Validation:
    - TLS cert matches registered cert
    - Port is valid (1-65535)
    - Addresses are valid IP format
  Storage:
    - Store: email, port, addresses, timestamp
    - Set expiration: current_time + 3600s
  Response: 200 OK with broadcast_id
```

**Estimated:** 2-3 days
**Tech:**
- TLS mutual certificate validation
- Express/Next.js middleware for cert extraction
- Redis or database for quick lookup
- Expiration manager (cron or TTL)

#### 2.1.3 Broadcast Lookup Endpoint (Mutual TLS)
```
✓ GET /api/relay/broadcast/lookup?email=<email>
  Auth: Mutual TLS
  Query: Target email to find
  Validation:
    - TLS cert matches registered cert
    - Email parameter valid
  Lookup:
    - Find target email in broadcast list
    - Check if broadcast not expired
  Response:
    - 200: {email, port, addresses, last_seen}
    - 404: Target not online
```

**Estimated:** 1-2 days
**Tech:**
- Database lookup
- Expiration checking
- Response serialization

#### 2.1.4 List Peers Endpoint (Mutual TLS)
```
✓ GET /api/relay/broadcast/list
  Auth: Mutual TLS
  Response: Array of all online peers
  [
    {email, port, addresses, last_seen},
    ...
  ]
```

**Estimated:** 0.5 days
**Tech:**
- Database query for all active broadcasts
- Filter by expiration time

#### 2.1.5 Heartbeat/Keep-Alive Endpoint (Mutual TLS)
```
✓ POST /api/relay/broadcast/heartbeat
  Auth: Mutual TLS
  Action: Extend broadcast expiration
  Response: 200 OK with new expires_in
```

**Estimated:** 0.5 days
**Tech:**
- Update broadcast expiration
- Return new TTL

#### 2.1.6 Broadcast Expiration Management
```
✓ Automatic cleanup of expired broadcasts
✓ Mark peers as offline after 1 hour
✓ Clean up old records
```

**Estimated:** 1 day
**Tech:**
- Background job (Node cron)
- Database cleanup queries

### 2.1 Summary
- **Total estimate:** 6-10 days
- **Key challenge:** Mutual TLS certificate handling
- **Dependencies:** PostgreSQL or MongoDB

---

## Phase 2.2: Peer Server Enhancements

**Location:** `client/src-tauri/src/http_server.rs`

### Implementation Tasks

#### 2.2.1 Multi-Address Binding
```
Current:
  Binds to: 127.0.0.1 (hardcoded)
  Issue: Unreachable from other machines

New:
  Accept configuration: bind_all = true
  Binds to: 0.0.0.0 (all IPv4)
  Also: :: (all IPv6)
  Result: Server reachable from any IP
```

**Estimated:** 0.5 days
**Code change:**
```rust
// Instead of:
let listener = TcpListener::bind("127.0.0.1:0").await?;

// Do:
let listener = TcpListener::bind("0.0.0.0:0").await?;
```

#### 2.2.2 Get Local IP Addresses
```
New functionality:
  Get all local IPv4 addresses
  Get all local IPv6 addresses
  Return as list to client
```

**Estimated:** 1 day
**Tech:**
- `ipnetwork` crate
- `local-ip-address` crate
- Filter loopback addresses

#### 2.2.3 Emit Address List to UI
```
Current:
  Emits: {port: 54321}

New:
  Emits: {
    port: 54321,
    addresses: [
      "192.168.1.50",
      "10.0.0.5",
      "fd00::1"
    ]
  }
```

**Estimated:** 0.5 days
**Code change:**
```rust
// In http_server::start_server
let addresses = get_local_addresses()?;
app_handle.emit_all("http-file-server-ready", json!({
  "port": port,
  "addresses": addresses
}))?;
```

### 2.2 Summary
- **Total estimate:** 2 days
- **Key challenge:** IP address detection across platforms
- **Dependencies:** None (standard libraries)

---

## Phase 2.3: Client Certificate & Registration

**Location:** `client/src-tauri/src/main.rs`

### Implementation Tasks

#### 2.3.1 Generate Self-Signed Certificate
```
On first run:
  1. Generate ed25519 private key
  2. Create self-signed certificate with CN=<email>
  3. Store private key + certificate locally
  4. Load from storage on subsequent runs
```

**Estimated:** 1 day
**Tech:**
- `rcgen` crate (certificate generation)
- Tauri storage API (save to disk)
- `rustls` for certificate handling

#### 2.3.2 Register with Relay on Startup
```
On app startup:
  1. Load email from config
  2. Load certificate from storage
  3. POST to /api/relay/register
     {certificate, email}
  4. Handle response:
     - 200: Registered (ready)
     - 409: Email conflict (user selects new email)
     - Error: Retry or fail gracefully
```

**Estimated:** 1-2 days
**Tech:**
- HTTP client with certificate support
- Error handling and retry logic
- UI feedback for registration state

#### 2.3.3 Gather & Send Address List
```
On broadcast/ready:
  1. Get local IP addresses (from 2.2.2)
  2. Optionally get public IP (future)
  3. POST to /api/relay/broadcast/ready
     {
       port: 54321,
       addresses: [...],
       capabilities: {...}
     }
  4. Receive broadcast_id + expiration
```

**Estimated:** 1 day
**Tech:**
- IP address gathering (from 2.2.2)
- HTTP request to relay

#### 2.3.4 Heartbeat Loop
```
Background task:
  Every 30 minutes:
    - POST to /api/relay/broadcast/heartbeat
    - Extend broadcast expiration
    - On failure: Try to re-broadcast
```

**Estimated:** 0.5 days
**Tech:**
- Tokio task spawning
- Timer loop
- Error recovery

### 2.3 Summary
- **Total estimate:** 3.5-4 days
- **Key challenge:** Certificate generation + storage
- **Dependencies:** `rcgen` crate

---

## Phase 2.4: RemoteHouse Updates

**Location:** `client/src/components/RemoteHouse/RemoteHouse.tsx`

### Implementation Tasks

#### 2.4.1 Query Relay for Peer List
```
Current:
  Hardcoded mock peer list

New:
  1. On component mount, query relay:
     GET /api/relay/broadcast/list
     Auth: Mutual TLS from browser? 
     (Browser can't do mutual TLS!)
     
  Problem: Browser can't do mutual TLS
  Solution: Query relay through Tauri backend
```

**Estimated:** 1-2 days
**Tech:**
- Tauri command to query relay
- Return peer list to React
- Cache result

#### 2.4.2 Implement Address List Try-Order
```
Current:
  Tries single socket

New:
  Try in order:
    1. 192.168.1.50:54321 (local, lowest latency)
    2. 10.0.0.5:54321 (private network)
    3. 2001:db8::1:54321 (IPv6)
    4. 203.0.113.42:54321 (public WAN)
  
  On connection failure: Try next address
  On connection success: Cache winning address
```

**Estimated:** 1-2 days
**Code change:**
```typescript
async function connectToPeer(addresses, port) {
  for (const address of addresses) {
    try {
      const response = await fetch(`http://${address}:${port}/api/files`);
      if (response.ok) {
        setPeerSocket({address, port}); // Cache
        return response;
      }
    } catch (e) {
      continue; // Try next address
    }
  }
  throw new Error('No addresses reachable');
}
```

#### 2.4.3 Show Peer Availability Status
```
UI Update:
  - [●] online - Successfully connected
  - [○] offline - No addresses reachable
  - [?] checking - Currently trying addresses
  - [!] error - Connection error (show message)
```

**Estimated:** 0.5 days
**Tech:**
- React state for peer status
- Visual indicators

### 2.4 Summary
- **Total estimate:** 2-3 days
- **Key challenge:** Browser can't do mutual TLS (need Tauri bridge)
- **Dependencies:** Tauri backend support

---

## Phase 2 Timeline

### Week 1: Relay Tracker Backend
- Days 1-2: Certificate registration
- Days 3-4: Broadcast ready + lookup
- Days 5: Heartbeat + expiration

### Week 2: Client Integration
- Days 1-2: Client certificate generation
- Days 3-4: Relay registration + heartbeat
- Day 5: Address list gathering

### Week 3: UI Integration
- Days 1-2: Query relay from UI
- Days 3-4: Address try-order logic
- Day 5: Testing + fixes

**Total Estimate:** 2-3 weeks
**Critical Path:** Relay Tracker backend (most blocking)

---

## Phase 2 Success Criteria

### Relay Tracker
- ✅ Client registration working
- ✅ Certificate storage in database
- ✅ Broadcast ready endpoint functional
- ✅ Broadcast lookup working
- ✅ Expiration management working
- ✅ Heartbeat extends broadcast TTL

### Peer Server & Client
- ✅ Self-signed certificate generated
- ✅ Client registers with relay on startup
- ✅ Address list sent to relay
- ✅ Heartbeat running in background
- ✅ RemoteHouse queries relay for peers
- ✅ Can connect to any peer in address list

### End-to-End Flow
- ✅ User A starts app → Registers with relay → Broadcasts port + addresses
- ✅ User B starts app → Registers with relay
- ✅ User B sees User A in peer list
- ✅ User B visits User A → Tries local address first
- ✅ User B browses User A's files
- ✅ User A goes offline → RemoteHouse shows [○] offline

---

## Phase 2 vs Phase 3 Clarification

### Phase 2: Relay-Based Discovery
- ✅ Clients find each other via relay
- ✅ Health checks via `/health` endpoint
- ✅ Only cached socket (from relay broadcast)
- ✅ No local friends list

### Phase 3: Friends List & Health Checks
- ✅ Friends list stored locally
- ✅ Periodic health checks (every 60s)
- ✅ Relay fallback if health check fails
- ✅ Socket caching for resilience
- ✅ Status indicators (online/offline/checking)

### Phase 4+: P2P Discovery (Future)
- ✅ Kademlia DHT (like BitTorrent)
- ✅ mDNS local network
- ✅ Gossip protocols
- ✅ Works without relay server

---

## What Needs to Be Documented

1. ✅ **RELAY_TRACKER_PROTOCOL.md** (just created) - Complete protocol spec
2. 🔜 **CLIENT_CERTIFICATE_GENERATION.md** - Certificate generation guide
3. 🔜 **MUTUAL_TLS_IMPLEMENTATION.md** - Mutual TLS setup
4. 🔜 **NETWORK_ADDRESS_HANDLING.md** - Address list logic
5. 🔜 **PHASE_2_REVISED_ROADMAP.md** - This document (being created)
6. Update **ARCHITECTURE_OVERVIEW.md** - Clarify Phase 2 requires Relay

---

## Key Takeaways

1. **Phase 2 is NOT just file sharing** - It's file sharing + discovery
2. **Relay Tracker MUST be implemented in Phase 2** - Not Phase 3
3. **Mutual TLS is required** - For `/broadcast/ready` and `/broadcast/lookup`
4. **Address list is critical** - Enables NAT traversal
5. **Browser can't do mutual TLS** - Need Tauri bridge
6. **Phase 2 is truly complete only when** users can find and visit each other

---

**Status:** 🔄 Phase 2 requires revision to include Relay Tracker  
**Next Step:** Confirm scope and get started on Relay Tracker backend

