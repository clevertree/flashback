# PHASE 2 IMPLEMENTATION START HERE

**Status:** 🔴 BLOCKED - Relay Tracker not implemented  
**Estimated Duration:** 4-5 weeks  
**Team:** 1 full-stack developer (or 2 developers if split)  
**Difficulty:** Medium (TLS + API + React integration)

---

## Why You're Here

Phase 2 looked complete (Peer Server ✅, RemoteHouse ✅, 55+ tests ✅), but users can't discover each other. 

**Discovery requires Relay Tracker.** This is your implementation roadmap.

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **What's Missing** | Relay Tracker backend (peer discovery) |
| **Why It Blocks** | Clients need to find each other |
| **Tech Stack** | Next.js (Relay) + Tauri (Client) + Mutual TLS |
| **Effort** | 3-5 weeks, 1 developer |
| **Critical Path** | Relay backend → Client certs → Discovery integration |
| **Phase 2 Success** | Two users can find & visit each other |

---

## The Three Documents You Need

### 1. **RELAY_TRACKER_PROTOCOL.md** (18 KB)
**What it is:** Complete protocol specification  
**What you learn:**
- How clients authenticate (self-signed certificates + mutual TLS)
- How relay works (broadcast ready, lookup, heartbeat)
- How address lists enable NAT traversal
- Detailed API specifications

**Read when:** First time understanding the system
**Action:** Already exists, reference throughout implementation

### 2. **PHASE_2_RELAY_TRACKER_REQUIREMENTS.md** (12 KB)
**What it is:** Breakdown of what needs to be built  
**What you learn:**
- Relay Tracker backend tasks (6 endpoints)
- Peer Server enhancements (address gathering)
- Client integration tasks (certificate generation, registration, heartbeat)
- RemoteHouse updates (peer discovery, address try-order)

**Read when:** Planning what to build
**Action:** Use as sprint planning document

### 3. **PHASE_2_IMPLEMENTATION_CHECKLIST.md** (15 KB)
**What it is:** Detailed implementation checklist  
**What you learn:**
- Specific files to create (routes, commands, components)
- Exact code structure
- Dependencies to add
- Tests to write
- Success criteria

**Read when:** Day-to-day implementation
**Action:** Check off items as you go

### 4. **PHASE_2_REVISED_WHAT_IS_NEEDED.md** (This doc explains why all this matters)

---

## One-Page Implementation Overview

### Phase 2A: Relay Tracker Backend (1-2 weeks)

**Deliverable:** Fully working Relay API with mutual TLS

```
/server/app/api/relay/
  register/route.ts          ← Client registration (email + cert)
  broadcast/ready/route.ts   ← Send port + addresses (needs TLS)
  broadcast/lookup/route.ts  ← Find peer by email (needs TLS)
  broadcast/list/route.ts    ← List all peers (needs TLS)
  broadcast/heartbeat/route.ts ← Keep broadcast alive (needs TLS)
```

**Key challenges:**
- Setting up mutual TLS in Node.js
- Extracting client certificate from TLS connection
- Database schema for broadcasts + clients
- Expiration management (clean up old broadcasts)

**Database design:**
```sql
-- Store registered clients
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  certificate TEXT NOT NULL,
  created_at TIMESTAMP
);

-- Store active broadcasts (peer discovery)
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients,
  port INTEGER,
  addresses JSON,  -- ["192.168.1.50", "fd00::1"]
  capabilities JSON,
  created_at TIMESTAMP,
  expires_at TIMESTAMP  -- Auto-cleanup after 1 hour
);
```

**Tests needed:**
- Certificate registration (valid, duplicate email, malformed cert)
- Broadcast ready (valid, missing TLS, expired)
- Broadcast lookup (peer exists, peer offline, wrong email)
- Expiration (cleanup old broadcasts)

---

### Phase 2B: Peer Server Enhancements + Client Certificates (1 week)

**Deliverables:**
1. Peer Server listens on `0.0.0.0` (all IPs, not just localhost)
2. Gathers local IP addresses (IPv4 + IPv6)
3. Client generates self-signed certificate on first run
4. Client stores certificate + key locally

```
Peer Server Changes (Rust):
  - Bind to 0.0.0.0 instead of 127.0.0.1
  - Detect local IP addresses via pnet crate
  - Emit to UI: {port: 54321, addresses: ["192.168.1.50", ...]}

Client Changes (Rust/Tauri):
  - Generate certificate: rcgen crate, CN=user@example.com
  - Store: ~/.dcc/certificates/client.{crt,key}
  - Load on startup
```

---

### Phase 2C: Client Registration & Discovery (1.5-2 weeks)

**Deliverables:**
1. Client registers with Relay on startup
2. Client broadcasts port + address list
3. Client sends heartbeat every 30 minutes
4. RemoteHouse queries Relay for peers
5. RemoteHouse tries addresses in order
6. UI shows peer status (online/offline/checking/error)

```
Client Startup Flow:
  1. Generate/load certificate
  2. POST /api/relay/register (email + cert)
  3. Start HTTP file server on 0.0.0.0:ephemeral
  4. Gather local addresses
  5. POST /api/relay/broadcast/ready (port + addresses)
  6. Spawn background heartbeat task
  7. Emit ready event to UI

RemoteHouse Discovery Flow:
  1. Component mounts
  2. Tauri command: query_relay_peers()
  3. Tauri backend: GET /api/relay/broadcast/list (with mutual TLS)
  4. Receive peer list
  5. For each peer, Tauri command: connect_to_peer(email)
  6. Tauri tries addresses in order: 192.168... → 10.0... → fe80... → public
  7. On success, cache winning address
  8. Return address to React
  9. React browser connects to address:port/api/files
```

---

## Critical Implementation Decisions

### Decision 1: Mutual TLS
**Question:** How do you do mutual TLS?

**Three approaches:**

**A) Express.js native (Simple)**
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  requestCert: true,  // Ask client for cert
  rejectUnauthorized: false  // Accept all certs (validate later)
};

const server = https.createServer(options, app);
```

**B) node-forge (Comprehensive)**
- Parse client certificate
- Validate certificate format
- Extract CN field
- Verify against registered cert
- More control, more complex

**C) Mutual TLS middleware (Most Secure)**
- Framework-level mutual TLS
- Validate cert in middleware
- Reject on mismatch
- Production-ready

**Recommendation:** Start with A (simple), move to C (production) later

---

### Decision 2: Certificate Storage (Client)
**Question:** Where to store private key?

**Two approaches:**

**A) File system (`~/.dcc/certificates/client.key`)**
- Pro: Simple, portable
- Con: Unencrypted on disk
- Con: Platform-specific paths
- Use: Development, Phase 2

**B) OS Keychain (future)**
- Pro: Encrypted, OS-managed
- Con: Complex, platform-specific
- Use: Production, Phase 3+

**Recommendation:** File system for Phase 2, keychain for later

---

### Decision 3: Address Priority
**Question:** Which addresses to try first?

**Ordering strategy (recommended):**
```
1. Local IPv4 (192.168.*, 10.*, 172.16.*)      [fastest]
2. Link-local IPv6 (fe80::)                     [fast, local]
3. Other IPv4 (anything else)                   [medium]
4. Public IPv6                                  [slower]
5. Public IPv4                                  [might fail if behind NAT]
```

**Why this works:**
- Local addresses = same network = fastest
- Avoids internet round-trip if peers on same LAN
- Falls back to public if local doesn't work

---

## Implementation Order (Critical Path)

### Week 1: Relay Backend
**Must complete before anything else works**

- [ ] Day 1-2: Database + certificate registration endpoint
- [ ] Day 3-4: Mutual TLS setup + broadcast ready endpoint
- [ ] Day 5: Broadcast lookup + list endpoints
- [ ] Day 6-7: Heartbeat + expiration management
- [ ] Tests for all 5 endpoints

**Output:** Relay API fully working with test certificates

---

### Week 2: Client Certificates + Registration
**Unblocks client discovery**

- [ ] Day 1: Generate self-signed certificates (rcgen)
- [ ] Day 2-3: Peer Server address gathering + binding to 0.0.0.0
- [ ] Day 4-5: Register with Relay on startup
- [ ] Day 6-7: Broadcast ready + heartbeat loop
- [ ] Tests for certificate generation, registration, heartbeat

**Output:** Running client broadcasts to Relay, stays alive with heartbeat

---

### Week 3: Discovery Integration
**Enables peer browsing**

- [ ] Day 1-2: Query Relay from Tauri (mutual TLS client)
- [ ] Day 3-4: Try addresses in order logic
- [ ] Day 5-6: RemoteHouse updates (show peer list, connection status)
- [ ] Day 7: E2E tests (two clients finding each other)

**Output:** Users can see & click on peers

---

### Week 4: Polish & Testing
**Make Phase 2 production-ready**

- [ ] Error handling (network failures, timeouts)
- [ ] Retry logic (failed connections)
- [ ] Performance optimization (connection caching)
- [ ] Documentation (setup guide, troubleshooting)
- [ ] Full E2E test suite
- [ ] Cross-platform testing (macOS, Linux, Windows)

**Output:** Phase 2 complete, fully tested, documented

---

## Tech Stack Summary

### Relay Tracker Backend
```
Framework: Next.js 14+ (already exists in /server)
Language: TypeScript
Auth: Mutual TLS (Node.js https)
Database: PostgreSQL or MongoDB (your choice)
Deployment: Whatever you use for /server now
```

### Peer Server Enhancements
```
Framework: Axum 0.7 (already exists)
Language: Rust
Networking: pnet, tokio
Certificates: rcgen, rustls
HTTP Client: reqwest with rustls-tls
```

### Client Integration
```
Framework: Tauri 1.x (already exists)
Language: Rust + TypeScript
UI: React 18 (already exists)
TLS: rustls, tokio-rustls
Key storage: File system (~/.dcc/)
```

---

## Success Criteria (Sign-Off)

Phase 2 is complete when:

1. ✅ Client A starts app, generates certificate, registers with Relay
2. ✅ Client A broadcasts port + 3+ addresses
3. ✅ Client A sends heartbeat every 30 minutes
4. ✅ Client B starts app, queries Relay for peers
5. ✅ Client B sees Client A in peer list
6. ✅ Client B clicks Client A, tries addresses in order
7. ✅ Client B successfully connects to Client A (via local address if possible)
8. ✅ Client B browses Client A's files
9. ✅ After 1 hour without heartbeat, Client A goes offline in Client B's view
10. ✅ All tested end-to-end with 2 separate machines

---

## FAQ

### Q: Do I need to implement mutual TLS if Relay runs on localhost?
**A:** No, if Relay runs locally only. But your protocol specifies mutual TLS for security. Recommend implementing it - adds security without much complexity.

### Q: Can I use JWT instead of certificates?
**A:** Possible, but certificates are simpler here (identity + auth combined). Certificates also enable better audit trails.

### Q: What if a client's IP changes (mobile device moves to different network)?
**A:** Client sends heartbeat every 30 minutes, which updates the address list in Relay. Other clients query Relay and get the new addresses.

### Q: How do I test mutual TLS locally?
**A:** Generate test certificates with rcgen or openssl, configure server to require them. Test endpoints with curl:
```bash
curl --cert client.crt --key client.key \
  https://localhost:3000/api/relay/broadcast/ready
```

### Q: Should browser go directly to Peer Server or through Tauri?
**A:** Browser goes directly to Peer Server for file browsing (faster). But querying Relay must go through Tauri because browsers can't do mutual TLS.

### Q: What about Phase 3?
**A:** Phase 3 (Friends List) builds on working Phase 2. When Phase 2 is done, Phase 3 adds:
- Local friends list storage
- Health checks to verify peers are online
- Fallback to Relay if health check fails
- Better status indicators

---

## Next Steps

1. **Read RELAY_TRACKER_PROTOCOL.md** (15 min)
   - Understand the protocol
   - Understand certificate model
   - Understand address list strategy

2. **Read PHASE_2_RELAY_TRACKER_REQUIREMENTS.md** (20 min)
   - Understand what needs to be built
   - Understand effort estimates
   - Understand dependencies

3. **Review PHASE_2_IMPLEMENTATION_CHECKLIST.md** (10 min)
   - See detailed task breakdown
   - See specific files to create
   - See dependencies to add

4. **Start Week 1: Relay Backend**
   - Create `/server/app/api/relay/` directory
   - Create database schema
   - Implement `/api/relay/register` endpoint
   - Add tests

---

## Questions for Your Before Starting

1. **Is Relay part of Phase 2 or separate?**
   - Recommend: YES, part of Phase 2 (you need it for end-to-end)

2. **Should mutual TLS be implemented now or deferred?**
   - Recommend: NOW (part of protocol, adds security)

3. **Which database for Relay?** (PostgreSQL vs MongoDB)
   - Recommend: PostgreSQL (better for relational data)

4. **Should Phase 2 include cross-platform testing?**
   - Recommend: YES (test on macOS, Linux, Windows)

5. **Any deadline for Phase 2 completion?**
   - Impacts priority and effort allocation

---

## You Are Here

```
Phase 0: Design ✅ Complete
Phase 1: File serving skeleton ✅ Complete
Phase 2: File sharing + discovery 🔴 BLOCKED (Relay not started)
  ├─ Phase 2A: Relay backend ⏳ Not started
  ├─ Phase 2B: Client certs ⏳ Not started
  ├─ Phase 2C: Discovery integration ⏳ Not started
  └─ Phase 2D: Polish ⏳ Not started
Phase 3: Friends list ⏳ Waiting for Phase 2
Phase 4+: P2P discovery ⏳ Future
```

**You have all the documentation.** Time to build.

