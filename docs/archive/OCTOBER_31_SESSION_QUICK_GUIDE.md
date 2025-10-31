# October 31, 2025: Architecture Update - Quick Navigation

**Session Summary:** Architected complete redesign from centralized relay tracking to decentralized P2P peer discovery with gossip protocol and WebTorrent integration.

---

## What Changed: The Vision

**From This:**
```
All Clients → Single Relay Tracker → Everything
(Centralized, single point of failure, relay stores all peer info)
```

**To This:**
```
Client → Bootstrap Nodes (for discovery)
       → Gossip Network (peer-to-peer info sharing)
       → WebTorrent (distributed file seeding)
(Decentralized, resilient, privacy-respecting)
```

---

## Key Design Decisions

| Decision | Impact | Rationale |
|----------|--------|-----------|
| **Bootstrap Nodes Only** | Relay only stores broadcasting peers | Privacy: silent peers remain hidden |
| **Gossip Protocol** | No central coordinator needed | Resilience: works when relay down |
| **IP Sharing Rules** | Only broadcasting peers expose IP | Security: non-broadcasting peers anonymous |
| **WebTorrent** | Large files via torrent network | Scalability: no single peer bottleneck |
| **Phased Migration** | Backward compatibility period | Risk reduction: gradual rollout |

---

## Documents Created (3 files, ~56 KB)

### 1. **PEER_DISCOVERY_ARCHITECTURE.md** (24 KB)
👉 **START HERE** - Complete system design

**What it contains:**
- Executive summary of architectural shift
- Detailed component descriptions (bootstrap nodes, gossip, WebTorrent)
- Complete data structure definitions
- State machines (peer lifecycle, bootstrap registration)
- 3 sequence diagrams showing interactions
- 6-week implementation roadmap
- Migration path from old to new architecture
- Security model and threat analysis

**When to read:**
- Get overview of entire system
- Understand component relationships
- Plan implementation phases
- Design database schema

---

### 2. **GOSSIP_PROTOCOL_DESIGN.md** (18 KB)
👉 **FOR IMPLEMENTATION** - Protocol specification

**What it contains:**
- Protocol layer breakdown (connection, framing, epidemic)
- **6 Message Types** (HELLO, PEER_ANNOUNCEMENT, PEER_REQUEST, PEER_LIST_RESPONSE, HEARTBEAT, PEER_UPDATE)
- Full message format examples
- Connection management (establish, maintain, reconnect)
- Message delivery semantics (best-effort, ordering, idempotence)
- Conflict resolution strategies
- Performance tuning parameters
- Security verification rules
- 3 implementation examples with timelines
- Pseudocode for main gossip loop

**When to read:**
- Build gossip protocol handler
- Debug peer table updates
- Implement message types
- Troubleshoot peer discovery

---

### 3. **ARCHITECTURE_REQUIREMENTS_UPDATE_OCT31.md** (13 KB)
👉 **FOR PLANNING** - Requirements and roadmap

**What it contains:**
- Original requirements summarized
- What was designed for each requirement
- Architecture changes (relay endpoints, database schema)
- Key decisions with rationale
- 6-phase implementation roadmap
- Technical specifications
- Security considerations
- Performance estimates
- Q&A addressing common questions
- Next steps

**When to read:**
- Understand requirements met
- Plan project timeline
- Get technical specifications
- Answer stakeholder questions

---

## Implementation Checklist

### Phase 1: Bootstrap Infrastructure (Weeks 1-2)
- [ ] Add `is_bootstrap`, `is_broadcasting` flags to database
- [ ] Create `bootstrap_nodes` table
- [ ] Implement `/api/bootstrap/register` endpoint
- [ ] Implement `/api/bootstrap/unregister` endpoint
- [ ] Implement `/api/bootstrap/discover` endpoint
- [ ] Add TTL expiration logic
- [ ] Write integration tests

### Phase 2: Gossip Protocol (Weeks 2-3)
- [ ] Create `client/src-tauri/src/gossip.rs`
- [ ] Implement PeerTable (in-memory storage)
- [ ] Implement 6 message types
- [ ] Add message deduplication (Bloom filter)
- [ ] Add IP sharing rule enforcement
- [ ] WebSocket connection management
- [ ] Peer expiration and cleanup

### Phase 3: Client Integration (Weeks 3-4)
- [ ] Update `BroadcastSection.tsx` to register bootstrap
- [ ] Add gossip protocol initialization
- [ ] Implement peer discovery UI
- [ ] Add TypeScript types (PeerInfo, GossipMessage)
- [ ] Update API bridge for gossip methods
- [ ] Add peer table browser UI

### Phase 4: WebTorrent Integration (Weeks 4-5)
- [ ] Create `client/src-tauri/src/torrent.rs`
- [ ] Implement file hashing (SHA-256)
- [ ] Add webtorrent npm package
- [ ] Implement torrent creation
- [ ] Implement seeding/downloading
- [ ] Integrate torrent discovery with gossip

### Phase 5: Performance Tuning (Weeks 5-6)
- [ ] Implement availability scoring
- [ ] Implement performance scoring
- [ ] Add peer sorting by score
- [ ] Optimize Bloom filter
- [ ] Test with large peer networks
- [ ] Measure bandwidth usage

### Phase 6: Testing & Docs (Weeks 6+)
- [ ] Write comprehensive test suite
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Performance benchmarks
- [ ] Network diagram tools

---

## Protocol at a Glance

### 6 Message Types

| Type | Direction | Purpose | Example |
|------|-----------|---------|---------|
| **HELLO** | Bidirectional | Connect & exchange capabilities | "Hi, I'm Alice, I have 3 repos" |
| **PEER_ANNOUNCEMENT** | Gossip (fan-out=3) | Spread peer info (respects IP sharing) | "Bob is online with films repo" |
| **PEER_REQUEST** | Gossip (TTL=16) | Search for peers with specific repos | "Who has documentaries repo?" |
| **PEER_LIST_RESPONSE** | Reply to request | Answer with matching peers | "David and Eve have it" |
| **HEARTBEAT** | Gossip (TTL=2) | Keep-alive, detect downtime | "I'm still here" |
| **PEER_UPDATE** | Gossip (TTL=32) | Announce status/repo changes | "I added a new repo" |

### Key Parameters

```
Fan-out:              3 random peers
Initial TTL:          32 hops (reaches ~59,000 peers)
Heartbeat interval:   30 seconds
Message retention:    Bloom filter (100K messages)
Peer expiration:      2 hours no heartbeat
Bootstrap expiration: 1 hour (same as current relay)
```

---

## Security Model

### Authentication
✅ Certificate-based (mutual TLS)  
✅ Fingerprint verification  
✅ Email-to-peer_id mapping (prevents Sybil)

### IP Sharing
✅ ONLY broadcasting peers expose IP  
✅ Non-broadcasting peers invisible to network  
✅ Gossip enforces this automatically  
✅ Relay tracker enforces at bootstrap level

### Message Security
✅ TTL validation (0-32)  
✅ Timestamp validation (±30s clock skew)  
✅ Signature verification  
✅ Message deduplication  
✅ Replay attack prevention

---

## Data Flow Examples

### Example 1: Bootstrap Registration
```
User enables broadcast → Generate peer_id → POST /bootstrap/register
                                           → Relay stores as bootstrap
                                           → Returns other bootstraps
                                           → Client connects & starts gossip
```

### Example 2: New Peer Joins
```
Peer connects to bootstrap → Receives peer list → Contacts peers
                          → Receives gossip announcements
                          → Local table populated with other peers
                          → Can discover repos via gossip
```

### Example 3: Silent Peer Discovers
```
Non-broadcasting peer sends PEER_REQUEST for "films"
                          → Bootstrap responds with ["Alice", "Bob"]
                          → Both have socket_addresses (they broadcast)
                          → Silent peer connects (outbound only)
                          → Remains invisible to network
```

---

## Comparison: Old vs New

### Relay Query Time
- **OLD:** Always query relay (1-2 second RTT)
- **NEW:** First check local gossip cache (instant)

### Scalability
- **OLD:** Relay bandwidth O(n), grows with peers
- **NEW:** Gossip O(log n), scales logarithmically

### Relay Downtime
- **OLD:** All peer discovery fails
- **NEW:** Existing peers continue, new peers can join network

### Privacy
- **OLD:** Relay knows all peer IPs
- **NEW:** Bootstrap only knows broadcasting peer IPs

### Network Resilience
- **OLD:** Single point of failure
- **NEW:** Network continues even if bootstrap down

---

## Next Immediate Actions

1. **Team Review** - Share documents with team for feedback
2. **Database Planning** - Plan bootstrap_nodes schema changes
3. **Start Phase 1** - Create bootstrap registration endpoints
4. **Start Phase 2** - Begin gossip.rs implementation
5. **Testing Strategy** - Plan test cases for gossip protocol

---

## File References

### Main Architecture Documents
```
📄 docs/PEER_DISCOVERY_ARCHITECTURE.md    ← Complete design
📄 docs/GOSSIP_PROTOCOL_DESIGN.md          ← Protocol spec
📄 docs/ARCHITECTURE_REQUIREMENTS_UPDATE_OCT31.md  ← Requirements
```

### Related Previous Work
```
📄 docs/REMOTEHOUSE_SECURITY.md           (Repository scripts security)
📄 docs/REMOTEHOUSE_IMPLEMENTATION.md     (RemoteHouse feature details)
📄 IMPLEMENTATION_SUMMARY.md              (RemoteHouse overview)
📄 IMPLEMENTATION_TODO.md                 (Project planning)
```

---

## Key Questions Answered

**Q: Won't this create a network split if bootstrap goes down?**  
A: No. Existing peers continue using their peer table. New peers can't join, but that's just like before. When bootstrap comes back, network recovers.

**Q: How do non-broadcasting peers get discovered?**  
A: They don't. They can discover others, but aren't discoverable themselves. They remain private/hidden.

**Q: What about WebTorrent compatibility?**  
A: Works with web browsers via WebTorrent-over-WebSocket. Desktop clients use full torrent protocol.

**Q: How long until information reaches all peers?**  
A: With fan-out=3, TTL=32: typically 50-250 seconds for full network convergence.

**Q: Can we bootstrap from multiple sources?**  
A: Yes. Clients can connect to multiple bootstrap nodes in parallel for faster discovery.

**Q: What if a malicious peer joins?**  
A: Certificate verification prevents spoofing. Gossip deduplication prevents floods. IP exposure limited to broadcasting peers only.

---

## Success Criteria

✅ **Protocol Design**
- [x] 6 message types defined and documented
- [x] IP sharing rules clearly specified
- [x] Security model comprehensive
- [x] Examples provided for all scenarios

✅ **Architecture Design**
- [x] Components clearly identified
- [x] Data structures specified
- [x] State machines documented
- [x] Sequence diagrams drawn

✅ **Implementation Roadmap**
- [x] 6-phase plan created
- [x] Milestones defined
- [x] Dependencies identified
- [x] Risk mitigation strategies outlined

✅ **Documentation**
- [x] 3 detailed documents created (56 KB)
- [x] Navigation guide provided
- [x] Quick reference included
- [x] Examples and pseudocode included

---

## Recommended Reading Order

1. **Start:** This document (quick navigation)
2. **Overview:** ARCHITECTURE_REQUIREMENTS_UPDATE_OCT31.md (understand requirements)
3. **Design:** PEER_DISCOVERY_ARCHITECTURE.md (grasp architecture)
4. **Implementation:** GOSSIP_PROTOCOL_DESIGN.md (build protocol)
5. **Reference:** Use as reference during coding

---

## Contact & Questions

For questions on:
- **Architecture:** See PEER_DISCOVERY_ARCHITECTURE.md
- **Protocol:** See GOSSIP_PROTOCOL_DESIGN.md  
- **Requirements:** See ARCHITECTURE_REQUIREMENTS_UPDATE_OCT31.md
- **Implementation:** Start with Phase 1 in roadmap

---

**Session Completed:** October 31, 2025  
**Documents:** 3 files created, 56 KB total  
**Next Review:** After team feedback and Phase 1 planning
