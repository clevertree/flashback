# Phase 2 Quick Reference Card

**Print this page and keep it on your desk during implementation**

---

## Phase 2 at a Glance

| Aspect | Details |
|--------|---------|
| **Status** | 🔴 BLOCKED - Relay not started |
| **Duration** | 4-5 weeks |
| **Team Size** | 1-2 developers |
| **Effort** | 70+ checklist items |
| **Documentation** | 7 files, 85 KB |
| **Success** | Two users find & visit each other |

---

## The Three Things to Build

### 1️⃣ Relay Tracker Backend (6-8 days)
**What:** 4 API endpoints + database  
**Where:** `/server/app/api/relay/`  
**How:**
- Register clients (store certificates) - NO AUTH
- Accept broadcast ready (mutual TLS) - port + addresses
- Lookup peers by email (mutual TLS)
- List all peers (mutual TLS)
- Auto-cleanup every 5 min (no heartbeat endpoint!)

**Key:** Mutual TLS, expiration management, cleanup job

---

### 2️⃣ Peer Server + Certs (2 days)
**What:** Bind to all IPs, gather addresses, generate certs  
**Where:** `client/src-tauri/src/`  
**How:**
- Change bind: 127.0.0.1 → 0.0.0.0
- Get local IPs (IPv4 + IPv6)
- Generate self-signed cert (ed25519)
- Store in ~/.dcc/certificates/

**Key:** Address gathering, certificate generation

---

### 3️⃣ Client Integration (3.5-4 days)
**What:** Register, discover, browse peers  
**Where:** `client/src-tauri/src/` + `client/src/components/`  
**How:**
- Register with Relay on startup
- Broadcast ready (once) to Relay
- Query Relay for peers
- Try addresses in order (NAT traversal)
- Show peer status in UI

**Note:** Heartbeat is CLIENT-TO-CLIENT (Phase 2B), not to Relay

---

## 3 Critical Decisions ⚠️

1. **Is Relay in Phase 2?** → YES (recommended)
2. **Full Mutual TLS?** → YES (recommended)
3. **When to start?** → NOW (recommended)

---

## File Guide

| Need | Read This |
|------|-----------|
| Quick overview | PHASE_2_START_HERE.md |
| Understand scope | PHASE_2_REVISED_WHAT_IS_NEEDED.md |
| Plan work | PHASE_2_RELAY_TRACKER_REQUIREMENTS.md |
| Code checklist | PHASE_2_IMPLEMENTATION_CHECKLIST.md |
| Protocol spec | RELAY_TRACKER_PROTOCOL.md |
| Navigation | PHASE_2_DOCUMENTATION_INDEX.md |
| Session context | SESSION_SUMMARY_OCT_30_PHASE_2_CLARIFICATION.md |

---

## Phase 2 Timeline

```
Week 1: Relay Backend (Days 1-6)
  ✓ Database setup (Day 1)
  ✓ Register endpoint (Day 2)
  ✓ Broadcast ready endpoint + mutual TLS (Day 3)
  ✓ Broadcast lookup endpoint (Day 4)
  ✓ Broadcast list endpoint (Day 5)
  ✓ Cleanup job + TLS testing (Days 6-8)

Week 2: Client Certs + Server (Days 8-14)
  ✓ Generate certificate (rcgen)
  ✓ Bind to 0.0.0.0
  ✓ Gather local IPs
  ✓ Register with Relay
  ✓ Send address list to Relay

Week 3: Discovery (Days 15-21)
  ✓ Query Relay from Tauri
  ✓ Address try-order logic
  ✓ RemoteHouse updates
  ✓ Status indicators
  ✓ E2E test setup

Week 4: Polish (Days 22-30)
  ✓ Error handling
  ✓ Network resilience
  ✓ Performance tuning
  ✓ Documentation
  ✓ Cross-platform testing
```

---

## API Endpoints to Build

```
POST /api/relay/register
  Input: {certificate, email}
  Output: {client_id}
  Auth: None

POST /api/relay/broadcast/ready
  Input: {port, addresses, capabilities}
  Output: {broadcast_id, expires_in}
  Auth: Mutual TLS ✓

GET /api/relay/broadcast/lookup?email=user@example.com
  Input: Query parameter
  Output: {email, port, addresses}
  Auth: Mutual TLS ✓

GET /api/relay/broadcast/list
  Input: None
  Output: [{email, port, addresses}, ...]
  Auth: Mutual TLS ✓

NO HEARTBEAT ENDPOINT (client-to-client keepalive, Phase 2B+)
```

---

## Database Schema

```sql
-- Clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  certificate TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Broadcasts table (expires in 1 hour)
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  port INTEGER NOT NULL,
  addresses JSON NOT NULL,  -- ["192.168.1.50", "fd00::1"]
  capabilities JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,  -- NOW() + 3600 seconds
  last_heartbeat TIMESTAMP
);

CREATE INDEX idx_broadcasts_email 
  ON broadcasts USING (client_id);
CREATE INDEX idx_broadcasts_expires 
  ON broadcasts (expires_at);
```

---

## Checklist by Phase

### Phase 2A: Relay (Week 1)
- [ ] Database setup (clients + broadcasts)
- [ ] Register endpoint (certificate storage)
- [ ] Broadcast ready endpoint (mutual TLS)
- [ ] Broadcast lookup endpoint (mutual TLS)
- [ ] List peers endpoint (mutual TLS)
- [ ] Heartbeat endpoint (mutual TLS)
- [ ] Expiration cleanup job
- [ ] Tests for all endpoints

### Phase 2B: Client (Week 2)
- [ ] Certificate generation (rcgen)
- [ ] Certificate storage (~/.dcc/)
- [ ] Peer Server: bind 0.0.0.0
- [ ] IP address detection
- [ ] Register with Relay startup
- [ ] Broadcast ready implementation
- [ ] Heartbeat loop (every 30 min)
- [ ] Tests for certificate, registration

### Phase 2C: Discovery (Week 3)
- [ ] Query Relay (Tauri command)
- [ ] Address try-order logic
- [ ] Connect to peer endpoint
- [ ] RemoteHouse peer list UI
- [ ] Peer status indicators (●○◐!)
- [ ] E2E test: two users discovering
- [ ] Error handling for timeouts
- [ ] Connection retry logic

### Phase 2D: Polish (Week 4-5)
- [ ] Network resilience
- [ ] Timeout handling
- [ ] Retry mechanisms
- [ ] Cross-platform testing (mac/linux/win)
- [ ] Documentation
- [ ] Performance profiling
- [ ] Bug fixes
- [ ] Sign-off testing

---

## Key Technologies

**Relay Backend**
- Next.js 14+, TypeScript
- Node.js native TLS (https)
- PostgreSQL or MongoDB
- node-forge (certificate parsing)

**Peer Server**
- Axum 0.7, Rust
- pnet (network interfaces)
- rcgen (certificate generation)
- tokio (async runtime)

**Client**
- Tauri, Rust + TypeScript
- rustls (TLS client)
- reqwest (HTTP client)
- React 18 (UI)

---

## Success Criteria (10 Items)

✅ Client A starts → registers → broadcasts  
✅ Client B queries → sees Client A  
✅ Client B clicks Client A → tries addresses  
✅ Client B connects → browses files  
✅ Heartbeat keeps broadcast alive  
✅ After 1 hour → Client A goes offline  
✅ Mutual TLS secures Relay APIs  
✅ Address try-order works (local first)  
✅ E2E tests pass (two real instances)  
✅ Zero critical issues  

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Can't find peer | Relay not running | Start relay server |
| Mutual TLS fails | Wrong cert format | Use PEM format, ed25519 key |
| Address not reachable | Trying wrong order | Try local IPs first |
| Heartbeat missing | Timer not running | Check tokio spawn |
| Certificate expired | TTL too short | Set expires_at = now + 86400 |
| IPv6 not working | Link-local address | Skip fe80::/10 |
| Browser CORS fails | TLS from browser | Use Tauri bridge instead |

---

## Commands to Know

```bash
# Generate test certificate
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365

# Test mutual TLS
curl --cert client.crt --key client.key \
  https://localhost:3000/api/relay/broadcast/ready

# Run tests
cargo test
npm test

# Check ports
lsof -i :3000   # Relay
lsof -i :54321  # Peer Server (varies)

# Kill background processes
pkill -f "node.*server"
pkill -f "tauri"
```

---

## Documentation Files Location

All in: `/Users/ari.asulin/dev/test/rust/`

1. PHASE_2_START_HERE.md ← Read first
2. PHASE_2_REVISED_WHAT_IS_NEEDED.md
3. PHASE_2_RELAY_TRACKER_REQUIREMENTS.md
4. PHASE_2_IMPLEMENTATION_CHECKLIST.md ← Reference daily
5. RELAY_TRACKER_PROTOCOL.md ← Protocol reference
6. PHASE_2_DOCUMENTATION_INDEX.md
7. SESSION_SUMMARY_OCT_30_PHASE_2_CLARIFICATION.md
8. COMPLETE_DOCUMENTATION_PACKAGE.md ← Index of all docs

---

## Quick Links

**Protocol question?**  
→ RELAY_TRACKER_PROTOCOL.md, Part 2 & 4

**Implementation question?**  
→ PHASE_2_IMPLEMENTATION_CHECKLIST.md, search task #

**Timeline question?**  
→ PHASE_2_RELAY_TRACKER_REQUIREMENTS.md, effort table

**Database question?**  
→ PHASE_2_IMPLEMENTATION_CHECKLIST.md, Database Schema

**Testing question?**  
→ PHASE_2_IMPLEMENTATION_CHECKLIST.md, Tests section

---

## Status Check In Template

Use daily in standups:

```
Standup Update - Day X of Phase 2A

Completed Today:
- [ ] 3-5 checklist items
- [ ] Code review passed
- [ ] Tests written

In Progress:
- [ ] Current task
- [ ] Blockers: None / [describe]

Planned Tomorrow:
- [ ] Next 2-3 checklist items

Risks:
- [ ] None / [describe]
```

---

## Phase 2 is READY TO START 🚀

**What you have:**
✅ Complete protocol spec  
✅ Implementation roadmap  
✅ 70+ checklist items  
✅ Database schema  
✅ Code examples  
✅ API specifications  
✅ Test cases  

**What you need to do:**
1. Decide: Relay in Phase 2? (YES recommended)
2. Set up: Development environment
3. Begin: Phase 2A on Monday
4. Reference: This quick card daily

**Estimated completion:** 4-5 weeks  
**Status:** READY TO BUILD  

---

*Print this card. Tape to monitor. Reference daily during Phase 2.*

**Good luck! 🚀**

