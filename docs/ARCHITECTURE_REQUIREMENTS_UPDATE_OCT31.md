# Architecture Requirements Update: October 31, 2025

**Status:** Documented & Designed  
**Date:** October 31, 2025  
**Requester:** Architecture Review  
**Scope:** Major architectural shift from centralized relay to decentralized P2P

---

## Requirements Summary

### Original Requirement

Instead of the relay tracker keeping track of all peers, implement a new architecture where:

1. **Relay Tracker Role Changes**
   - OLD: Stores ALL peer information
   - NEW: Only tracks bootstrap nodes (peers that choose to broadcast)

2. **Bootstrap Node Registration**
   - Clients that select repositories and enable broadcast/ready become bootstrap nodes
   - Only bootstraps share their IP information
   - Non-broadcasting peers remain anonymous (only gather socket info)

3. **Peer Discovery**
   - Clients discover initial peers via bootstrap nodes
   - Peers exchange information via gossip protocol
   - Gossip ensures eventual consistency without centralized coordinator

4. **IP Sharing Rules**
   - ONLY broadcasting clients share IP addresses publicly
   - Non-broadcasting peers can discover peers but aren't discoverable
   - Silent peers still get socket information about other peers

5. **Large File Distribution**
   - Implement WebTorrent/BitTorrent for distributing large files outside repos
   - Web clients can be served via WebTorrent (torrent over WebSocket)
   - Torrents are announced and discovered via gossip protocol

---

## What Was Designed

### Document 1: PEER_DISCOVERY_ARCHITECTURE.md (24 KB)

**Location:** `/docs/PEER_DISCOVERY_ARCHITECTURE.md`

**Contents:**

1. **Executive Summary** - Architectural shift comparison
2. **Architectural Shift** - Current vs New models with diagrams
3. **Components** - Bootstrap nodes, gossip handlers, peer tables, WebTorrent
4. **Bootstrap Node Model** - Registration, unregistration, peer lookup
5. **Gossip Protocol** - Message types, peer sharing rules, propagation
6. **Peer Discovery Flow** - 4-phase discovery process with timelines
7. **Data Structures** - PeerInfo, BootstrapNode, GossipMessage schemas
8. **Security Model** - Authentication, verification, IP sharing enforcement
9. **WebTorrent Integration** - File hashing, seeding, torrent discovery
10. **State Machines** - Peer lifecycle and bootstrap registration states
11. **Sequence Diagrams** - 3 detailed interaction sequences
12. **Implementation Phases** - 6-week phased rollout plan with milestones
13. **Migration Path** - Dual-operation → Gossip primary → Relay deprecated

### Document 2: GOSSIP_PROTOCOL_DESIGN.md (18 KB)

**Location:** `/docs/GOSSIP_PROTOCOL_DESIGN.md`

**Contents:**

1. **Overview** - Epidemic algorithm properties and trade-offs
2. **Protocol Layers** - Connection, framing, epidemic algorithm
3. **Message Types** (6 types):
   - HELLO - Connection establishment with capabilities
   - PEER_ANNOUNCEMENT - Announce peer with IP sharing rules
   - PEER_REQUEST - Request for peers with specific repos
   - PEER_LIST_RESPONSE - Response to peer request
   - HEARTBEAT - Keep-alive and bootstrap signals
   - PEER_UPDATE - Status/repository changes
4. **Connection Management** - WebSocket establish, maintain, reconnect
5. **Message Delivery Semantics** - Best-effort, partial ordering, idempotence
6. **Peer Table Updates** - Insert/update/conflict rules
7. **Performance & Tuning** - Parameters, bloom filters, bandwidth estimates
8. **Security** - Message verification, IP enforcement, Sybil prevention
9. **Examples** (3):
   - New peer joins network
   - Peer update propagation
   - Non-broadcasting peer discovery
10. **Appendix** - Pseudocode for main gossip loop

---

## Architecture Changes Summary

### Relay Tracker Changes

**Current Endpoints (being replaced):**
```
GET  /api/relay/broadcast/lookup?email=...    → Remove/deprecate
GET  /api/relay/broadcast/list                → Remove/deprecate
POST /api/relay/broadcast/ready               → Modify
```

**New Endpoints (to be added):**
```
POST /api/bootstrap/register                  → Register as bootstrap
DELETE /api/bootstrap/unregister              → Leave bootstrap
GET /api/bootstrap/discover?repositories=...  → Bootstrap peer discovery
```

**Database Changes:**
```
broadcasts table (current):
  - user_id, port, addresses, expires_at

bootstrap_nodes table (new):
  - email, peer_id, socket_addresses, port
  - repositories, is_broadcasting, is_bootstrap
  - public_certificate, registered_at, last_heartbeat
  - expires_at, capabilities (max_peers, torrent, bandwidth)
```

### Client Changes

**New Component:** `client/src-tauri/src/gossip.rs`
- Peer table management (in-memory)
- Gossip message handling
- IP sharing rule enforcement
- TTL and expiration tracking

**New Component:** `client/src-tauri/src/torrent.rs`
- File hashing (SHA-256)
- Torrent metadata creation
- Seeding/downloading
- WebTorrent DHT integration

**Updated Files:**
- `BroadcastSection.tsx` - Add bootstrap registration when broadcast enabled
- `cryptoBridge.ts` - Add gossip protocol interface
- `apiTypes.ts` - Add PeerInfo, GossipMessage, TorrentFile types

### Network Changes

**Old Network Topology:**
```
All Clients → Relay Tracker → Response
```

**New Network Topology:**
```
Client → Bootstrap Node (1 query) → Gossip Network (all peers)
```

---

## Key Decisions

### 1. Bootstrap Nodes (Not All Peers)

**Decision:** Only clients that enable broadcast become bootstrap nodes
- **Rationale:** Reduces relay storage, maintains privacy for silent peers
- **Benefit:** Non-broadcasting peers invisible to network
- **Tradeoff:** Silent peers depend on bootstrap for discovery

### 2. Gossip Protocol (Not Request-Response)

**Decision:** Use epidemic algorithm for peer information spread
- **Rationale:** Decentralized, no coordinator needed, scalable
- **Benefit:** Works when relay is down
- **Tradeoff:** Eventual consistency, temporary inconsistencies

### 3. IP Sharing Rules (Security by Default)

**Decision:** Only expose IP for peers that explicitly enable broadcast
- **Rationale:** Protects privacy of non-broadcasting peers
- **Benefit:** Peer can discover others but remains hidden
- **Tradeoff:** Non-broadcasting peers need relay/NAT for incoming connections

### 4. WebTorrent (Not Direct P2P)

**Decision:** Use WebTorrent for large file distribution
- **Rationale:** Better than single-peer bottleneck, works in web browsers
- **Benefit:** Scalable, distributed, web-compatible
- **Tradeoff:** Need to implement torrent client, DHT integration

### 5. Phased Migration (Not Big Bang)

**Decision:** Dual-operation period before full cutover
- **Rationale:** Backward compatibility, gradual rollout
- **Benefit:** Lower risk, can revert if issues
- **Tradeoff:** Temporary code complexity

---

## Implementation Roadmap

### Phase 1: Bootstrap Node Infrastructure (Weeks 1-2)
- [ ] Modify relay tracker database schema
- [ ] Add bootstrap registration endpoints
- [ ] Implement TTL-based expiration
- [ ] Test bootstrap peer discovery

### Phase 2: Gossip Protocol Handler (Weeks 2-3)
- [ ] Create gossip.rs component
- [ ] Implement message types
- [ ] Add peer table management
- [ ] Implement IP sharing rules

### Phase 3: Client Integration (Weeks 3-4)
- [ ] Update BroadcastSection.tsx
- [ ] Implement bootstrap registration
- [ ] Add gossip UI display
- [ ] Test peer discovery

### Phase 4: WebTorrent Integration (Weeks 4-5)
- [ ] Create torrent.rs component
- [ ] Implement file hashing
- [ ] Add torrent seeding/downloading
- [ ] Integrate with gossip protocol

### Phase 5: Performance Optimization (Weeks 5-6)
- [ ] Implement availability scoring
- [ ] Implement performance scoring
- [ ] Optimize peer selection
- [ ] Load testing

### Phase 6: Testing & Documentation (Weeks 6+)
- [ ] Comprehensive test suite
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Performance benchmarks

---

## Technical Specifications

### Gossip Protocol

**6 Message Types:**
1. HELLO - Connection setup
2. PEER_ANNOUNCEMENT - New/updated peer info
3. PEER_REQUEST - Search for specific repos
4. PEER_LIST_RESPONSE - Reply with peer list
5. HEARTBEAT - Keep-alive
6. PEER_UPDATE - Status/repo changes

**Key Parameters:**
- Fan-out: 3 random peers
- TTL: 32 (reaches ~59,000 peers)
- Heartbeat interval: 30 seconds
- Message dedup: Bloom filter

### Peer Table

**Stored per peer:**
```typescript
{
  email, peer_id, public_certificate,
  socket_addresses (only if broadcasting),
  port, is_broadcasting, is_bootstrap,
  repositories, availability_score (0-100),
  performance_score (0-100), bandwidth_estimate,
  discovered_at, last_seen, expires_at
}
```

### Bootstrap Node Registration

**Request:**
```
POST /api/bootstrap/register
{
  email, socket_addresses, port, repositories,
  capabilities: { max_peers, supports_torrent, bandwidth }
}
```

**Response:**
```
{
  status: 'registered',
  bootstrap_peers: [...],
  peer_id: 'unique-id',
  expires_at: Date
}
```

---

## Security Considerations

### Authentication
- Certificate-based (mutual TLS)
- Fingerprint verification
- Bootstrap whitelist (future enhancement)

### IP Sharing
- ONLY broadcasting peers expose IP
- Non-broadcasting peers can't be discovered
- Gossip enforces this rule automatically

### Message Verification
- TTL validation
- Timestamp validation (±30s clock skew)
- Certificate signature verification
- Message deduplication

### Sybil Attack Prevention
- Email-to-peer_id one-to-one mapping
- Relay tracker authoritative source
- Sequence numbering for updates

---

## Performance Estimates

### Information Spread Time
- With fan-out=3, TTL=32: ~50-250 seconds to reach all peers
- Typical peer discovery: 5-30 seconds

### Bandwidth Per Peer
- Message size: ~1 KB
- Forward rate: 1 message/5 seconds
- Per-peer gossip: ~600 bytes/second
- For 1000 peers: ~5 Mbps total (manageable)

### Scalability
- Gossip protocol: O(log n) information spread time
- Peer table: O(n) memory per node
- Bootstrap nodes: Limited to high-capacity machines

---

## Files Created

1. `/docs/PEER_DISCOVERY_ARCHITECTURE.md` - 24 KB
   - Complete architectural design
   - Component specifications
   - Migration path

2. `/docs/GOSSIP_PROTOCOL_DESIGN.md` - 18 KB
   - Detailed protocol specification
   - Message type definitions
   - Implementation examples

---

## Next Steps

1. **Review Architecture** - Get feedback from team on design choices
2. **Design Review** - Architecture review meeting
3. **Start Phase 1** - Bootstrap node infrastructure
4. **Implement Phase 2** - Gossip protocol handler
5. **Test & Iterate** - Full integration testing

---

## Related Documents

- `/PEER_DISCOVERY_ARCHITECTURE.md` - Main architecture
- `/GOSSIP_PROTOCOL_DESIGN.md` - Protocol details
- `/IMPLEMENTATION_SUMMARY.md` - RemoteHouse feature
- `/IMPLEMENTATION_TODO.md` - Planning document

---

## Questions & Discussion

### Q: What happens if all bootstrap nodes go down?
A: Existing peers continue using cached peer table. New peers can't join until bootstrap returns. Future: Peer-to-peer discovery without bootstrap.

### Q: How do we prevent network partition?
A: Gossip protocol naturally re-merges partitions. When partitions reconnect, peers exchange information and merge state.

### Q: What about peer authentication?
A: Currently rely on certificate verification at relay level. Future: Certificate-based authentication per peer.

### Q: How do WebTorrent trackers work?
A: Integrated with gossip - torrents announced via PEER_ANNOUNCEMENT, tracked in peer table, discovery via PEER_REQUEST.

### Q: Can this work with NAT/firewalls?
A: Broadcasting peers need port forward. Non-broadcasting peers use relay tracker or NAT traversal (future). WebTorrent can work through JavaScript (web clients).

---

## Conclusion

The new architecture shifts Flashback from centralized relay tracking to a decentralized peer network with:
- **Bootstrap nodes** for initial discovery
- **Gossip protocol** for peer information sharing
- **Privacy-respecting** IP sharing (only for broadcasting peers)
- **WebTorrent integration** for large file distribution
- **Fault tolerance** through redundancy and gossip

This provides better scalability, resilience, and privacy while maintaining security through certificate-based authentication and message verification.
