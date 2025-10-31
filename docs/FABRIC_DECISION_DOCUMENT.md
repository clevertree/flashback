# Hyperledger Fabric Architecture: Decision Document

**Status:** Architectural Decisions Finalized  
**Date:** October 31, 2025  
**Version:** 1.0  
**Type:** Implementation Specification

---

## Executive Summary

This document captures the final architectural decisions for integrating Hyperledger Fabric into the Flashback peer-to-peer network. All major decisions have been made and are documented below.

---

## Final Decisions

### 1. Orderer Architecture ✅

**Decision:** Distributed orderer with optional central seed server

**Details:**
- **Primary:** Bootstrap nodes run Raft consensus-based orderers
- **Redundancy:** 3-5 orderer nodes (odd number for Raft quorum)
- **Central Seed Server:** Optional high-capacity server that:
  - Helps bootstrap orderer nodes
  - Provides ordering service during peer network startup
  - Does NOT store blockchain state (peers do that)
  - Can be run by relay tracker or separate entity
  - Acts as "seed orderer" for consistency

**Architecture:**
```
Relay Tracker (Optional Central Seed Server)
└─ Fabric Orderer (seed/fallback)

Bootstrap Node 1          Bootstrap Node 2          Bootstrap Node 3
└─ Fabric Orderer    └─ Fabric Orderer      └─ Fabric Orderer
   (Raft)               (Raft)                   (Raft)
```

**Rationale:**
- Distributed: No single point of failure
- Seed server: Helps with initial setup and consistency
- Raft consensus: Battle-tested, works in P2P networks
- Bootstrap nodes naturally have the resources for ordering

---

### 2. Channel Architecture ✅

**Decision:** One Fabric channel per repository

**Details:**
- **Channels:** `movies`, `tv-shows`, `documentaries`, etc.
- **Each channel:** Independent blockchain, separate endorsers, own ledger state
- **Repository Data:** All entries for one repo in one channel
- **Isolation:** Repositories cannot directly interact across channels

**Channel Structure:**
```
Channel: movies
├─ Ledger State (LevelDB key-value)
│  ├─ entry:movie-001
│  ├─ entry:movie-002
│  ├─ comment:movie-001:review-123
│  └─ torrent:movie-001:hash-abc123
├─ Block Store (immutable history)
└─ Transaction Log

Channel: tv-shows
├─ Ledger State (LevelDB key-value)
├─ Block Store
└─ Transaction Log
```

**Rationale:**
- Per-repo ordering allows different data ordering strategies
- Clean isolation for permissions and access control
- Different repos can have different endorsement policies
- Easier to scale: add new repo = add new channel

---

### 3. Endorsement Policy ✅

**Decision:** Dual endorsement (2 of 3 peers)

**Details:**
- **Policy:** `AND ('bootstrap-org.peer', 'bootstrap-org.peer')` 
- **Interpretation:** 2 out of 3 available endorsing peers must sign
- **Timing:** Can be delayed (acceptable for all blockchain operations)
- **Implications:** Transactions can take a few seconds to finalize

**Transaction Flow:**
```
User invokes chaincode (signed with X.509)
├─ Peer 1 simulates execution → Signs result
├─ Peer 2 simulates execution → Signs result
├─ Client collects 2 endorsements
├─ Client sends to orderer
├─ Orderer creates block
└─ All peers validate & commit (2 sigs validates)
```

**Rationale:**
- 1 endorsement too risky (peer could go offline)
- 3 endorsements unnecessary (slows everything down)
- 2 endorsements: Good balance between safety and speed
- All additions are actions that can be delayed (user accepts eventual consistency)

---

### 4. Data Privacy Model ✅

**Decision:** All-public entries, private access requests

**Details:**

**Public (on blockchain):**
- Repository entries (movies, shows, etc.)
- Comments/reviews
- File torrent hashes
- File metadata (title, description, size)
- User identities (email, public key)
- Entry history (who added what, when)

**Private (NOT on blockchain):**
- File access requests (who wants what)
- User IP addresses (gossip protocol privacy)
- Private communications between peers

**Implementation:**
```
Blockchain Entries (Public):
{
  type: "entry",
  repo: "movies",
  id: "movie-001",
  title: "Inception",
  year: 2010,
  addedBy: "alice@example.com",
  addedAt: "2025-10-31T10:00:00Z",
  torrentHash: "abc123...",  // Only hash, not file itself
  fileSize: 2147483648,
  description: "A mind-bending thriller"
}

Access Requests (NOT on blockchain - direct peer-to-peer):
{
  requesterId: "bob@example.com",
  entryId: "movie-001",
  timestamp: "2025-10-31T10:05:00Z",
  // Handled directly by torrent protocol
  // Bob queries for peers seeding movie-001
  // Receives from peers directly (not through chain)
}
```

**Rationale:**
- Open collaboration: Everyone sees entries
- Privacy preserved: Access requests are P2P only
- Scalability: Only metadata stored in blockchain
- Transparency: Fair audit trail for who added what

---

### 5. Offline Support ✅

**Decision:** Local LevelDB cache with sync on reconnect

**Details:**

**Architecture:**
- Each peer maintains **local cache** of ledger state
- Cache stored in local LevelDB (same tech as Fabric uses)
- On reconnect: Fetch missed blocks and replay
- Conflict resolution: Fabric consensus resolves ordering

**Offline Capabilities:**
```
Offline:
├─ Read from local cache ✅
├─ Query ledger state ✅
└─ Submit transactions ❌ (queued locally)

On Reconnect:
├─ Push queued transactions
├─ Fetch missed blocks
├─ Replay state
└─ Sync complete
```

**Rationale:**
- Good UX: Works without network
- Eventually consistent: Acceptable for this use case
- Simple implementation: Use Fabric's built-in sync
- No manual conflict resolution needed: Blockchain decides

---

### 6. Chaincode Language ✅

**Decision:** JavaScript (Node.js)

**Details:**
- **Language:** JavaScript (easiest for team)
- **Runtime:** Fabric's Node.js chaincode support
- **Location:** Deployed on all endorsing peers
- **Updates:** Chaincode versioning for upgrades

**Chaincode Packages:**
```
repo-manager v1.0
├─ addEntry(repo, entry)
├─ removeEntry(repo, entryId)
├─ searchEntries(repo, query)
├─ addComment(repo, entryId, comment)
├─ getTorrentHash(repo, entryId)
└─ getHistory(repo, entryId)
```

**Rationale:**
- Team familiar with JavaScript
- Good Fabric support for Node.js
- Easy to maintain and debug
- Can import npm packages for utilities

---

### 7. Permissions Model ✅

**Decision:** Capability-based access control

**Details:**

**Capability Model:**
- User certificate = proof of capability
- Certificate organization = issuing CA
- Certificate attributes = specific permissions
- No role-based hierarchy needed

**Capabilities (via certificate attributes):**
```
Certificate Attributes:
- capability: "add-entry"      → Can add entries
- capability: "comment"        → Can comment
- capability: "admin"          → Can manage chaincode
- capability: "torrent-seed"   → Can seed files
- repository: "movies"         → For this repo only
- repository: "*"              → For all repos
```

**Endorsement Policy (CA-based):**
```
Channel: movies
Endorsement: {
  endorser1: "bootstrap-org.peer1",
  endorser2: "bootstrap-org.peer2",
  mspId: "bootstrap-org"
}

Access: Only users with CA-issued certs can invoke
```

**Example Verification:**
```javascript
// Chaincode validates:
if (invokerCert.capabilities.includes("add-entry")) {
  // User can add entries
} else {
  throw new Error("Not authorized to add entries");
}
```

**Rationale:**
- Flexible: Add capabilities without code changes
- Scalable: Works with any CA
- Decentralized: No central permission table
- Future-proof: Can add capabilities for new features

---

### 8. File Storage Strategy ✅

**Decision:** Text/links in blockchain, binary files via WebTorrent

**Details:**

**In Blockchain (LevelDB/Fabric):**
- Repository entries (JSON objects)
- Comments/reviews (text)
- Torrent hashes (links to files)
- File metadata (title, size, description)
- User information (email, public key)
- Transaction history

**NOT In Blockchain:**
- ❌ Media files (movies, images)
- ❌ Large documents (PDFs, archives)
- ❌ Binary data
- ❌ File access requests
- ❌ User IP addresses

**Distribution:**
```
User wants to add movie file:

1. Create torrent of movie file
2. Extract torrent hash (e.g., abc123def456...)
3. Create blockchain entry:
   {
     title: "Inception",
     torrentHash: "abc123def456...",
     size: 2147483648,  // 2GB in bytes
     description: "..."
   }
4. Peer seeds file via WebTorrent
5. Other peers can download movie via torrent protocol
```

**Blockchain Storage Examples:**

✅ **Store in blockchain:**
```json
{
  "type": "entry",
  "repo": "movies",
  "title": "Inception",
  "year": 2010,
  "addedBy": "alice@example.com",
  "torrentHash": "abc123def456...",
  "fileSize": 2147483648,
  "description": "A mind-bending thriller",
  "genres": ["sci-fi", "thriller"],
  "imdbId": "tt1375666"
}
```

❌ **NOT in blockchain:**
```json
{
  "movieData": "<binary data... 2GB...>",  // NO! Use torrent
  "fileContent": "...",                    // NO! Use torrent
  "image": "<PNG binary...>"               // NO! Use torrent
}
```

**Rationale:**
- Blockchain for immutable records only
- WebTorrent for efficient distribution
- Bandwidth efficient: No duplication in ledger
- Scalability: Arbitrary file sizes
- Decentralization: Torrent protocol is peer-to-peer

---

## Architecture Diagram: Final

```
┌─────────────────────────────────────────────────────────────┐
│                    Relay Tracker                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │  Fabric Certificate Authority (Fabric CA)              ││
│ │  ├─ Issues X.509 certs to users & peers               ││
│ │  ├─ Encodes capabilities in certificate attributes   ││
│ │  └─ Manages certificate revocation                   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │  Optional: Fabric Orderer (Seed)                      ││
│ │  ├─ Helps bootstrap orderer network                   ││
│ │  └─ Provides fallback ordering                        ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │  Bootstrap Node Registry (Gossip)                     ││
│ │  └─ Lists high-capacity peers for discovery          ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
         │
         │ (Peer discovery via gossip protocol)
         │
    ┌────┴────┬────────────┬────────────┐
    │          │            │            │
    ▼          ▼            ▼            ▼
┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Bootstrap │ │  Peer B  │ │  Peer C  │ │  Peer D  │
│ Node A   │ │(Silent)  │ │(Silent)  │ │(Silent)  │
├─────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│         │ │          │ │          │ │          │
│ Orderer │ │Fabric    │ │Fabric    │ │Fabric    │
│ (Raft)  │ │Peer      │ │Peer      │ │Peer      │
│         │ │          │ │          │ │          │
│Channels:│ │Channels: │ │Channels: │ │Channels: │
│ movies  │ │ movies   │ │ movies   │ │ movies   │
│ tv-show │ │ tv-show  │ │ tv-show  │ │ tv-show  │
│         │ │          │ │          │ │          │
│LevelDB  │ │LevelDB   │ │LevelDB   │ │LevelDB   │
│(Ledger) │ │(Ledger)  │ │(Ledger)  │ │(Ledger)  │
│         │ │          │ │          │ │          │
│WebTorrent  │WebTorrent  │WebTorrent  │WebTorrent
│Seeder   │ │Peer      │ │Peer      │ │Peer      │
│         │ │          │ │          │ │          │
│Gossip   │ │Gossip    │ │Gossip    │ │Gossip    │
│Listener │ │Listener  │ │Listener  │ │Listener  │
│         │ │          │ │          │ │          │
│Local    │ │Local     │ │Local     │ │Local     │
│Cache    │ │Cache     │ │Cache     │ │Cache     │
│(LevelDB)│ │(LevelDB) │ │(LevelDB) │ │(LevelDB) │
└─────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## Data Flow: Adding a Movie Entry

### Step 1: User Creates Entry (Offline or Online)

```javascript
// Client-side (user's Tauri app)
const entry = {
  repo: "movies",
  title: "Inception",
  year: 2010,
  torrentHash: "abc123def456...",  // Already created torrent
  fileSize: 2147483648,
  description: "Mind-bending thriller"
};

// Stored in local cache
localCache.put(`entry:movie-001`, entry);

// If online, send to blockchain
if (isOnline) {
  // Continue to Step 2
}
```

### Step 2: User Invokes Chaincode

```javascript
// Client invokes chaincode (signed with X.509 cert)
const txnProposal = fabricSDK.createProposal({
  channel: "movies",
  chaincode: "repo-manager",
  function: "addEntry",
  args: [entry],
  signer: userCertificate  // Certificate includes capabilities
});
```

### Step 3: Endorsement

```
Peer 1 (Bootstrap Node A) receives proposal:
├─ Verify X.509 signature ✓
├─ Check capabilities in cert ✓
├─ Execute chaincode simulation
│  └─ Entry is added to simulation result
├─ Sign endorsement
└─ Return to client

Peer 2 (Peer B) receives proposal:
├─ Verify X.509 signature ✓
├─ Check capabilities ✓
├─ Execute chaincode simulation
├─ Sign endorsement
└─ Return to client

(If Peer 1 or 2 offline, Peer 3 can endorse instead)
```

### Step 4: Ordering

```
Client collects 2 endorsements and sends to orderer:
├─ Verify both endorsements ✓
├─ Add to transaction pool
├─ Batch with other transactions
└─ Create block

Block contains:
{
  blockNumber: 42,
  transactions: [
    { invoker: "alice@example.com", function: "addEntry", ... },
    { invoker: "bob@example.com", function: "addComment", ... },
    ...
  ],
  previousHash: "...",
  hash: "abc123..."
}
```

### Step 5: Commitment

```
All peers receive block:
├─ Peer 1 validates
│  ├─ Check endorsements valid ✓
│  ├─ Execute chaincode (verify result same) ✓
│  ├─ Write to ledger ✓
│  └─ Update local cache ✓
├─ Peer 2 validates (same)
├─ Peer 3 validates (same)
└─ Peer 4 validates (same)

Result: All peers now have consistent ledger state
```

### Step 6: File Distribution (Async)

```
Meanwhile (asynchronously):
├─ User (Peer A) seeds movie file via WebTorrent
├─ Torrent DHT announces movie availability
├─ Other peers see entry in ledger
├─ Peers discover user (via DHT/gossip)
├─ Peers download movie via torrent
└─ Peers can become seeders
```

---

## Decision Table: Quick Reference

| Decision | Option | Rationale |
|----------|--------|-----------|
| **Orderer** | Distributed on bootstrap nodes + optional seed server | No single point of failure, consistent startup |
| **Channels** | One per repository (movies, tv-shows, etc.) | Clean isolation, flexible ordering per repo |
| **Endorsement** | 2 of 3 peers | Balanced safety/speed, acceptable delays |
| **Privacy** | All entries public, access requests private | Transparency + privacy for requests |
| **Offline** | Local LevelDB cache, sync on reconnect | Good UX, eventual consistency |
| **Chaincode** | JavaScript/Node.js | Team expertise, good Fabric support |
| **Permissions** | Capability-based (cert attributes) | Flexible, decentralized, scalable |
| **File Storage** | Text/links in blockchain, binaries via WebTorrent | Efficient, scalable, decentralized |

---

## Implementation Priority

### Phase 1: Core Fabric Infrastructure (Weeks 1-2)
- [ ] Deploy Fabric network (3-5 peers)
- [ ] Set up Fabric CA (issue X.509 certs)
- [ ] Create channels (movies, tv-shows)
- [ ] Deploy repo-manager chaincode v1.0

### Phase 2: Chaincode Development (Weeks 2-3)
- [ ] Write addEntry, removeEntry, searchEntries functions
- [ ] Write addComment, getHistory functions
- [ ] Implement capability-based access control
- [ ] Test with dual endorsement policy

### Phase 3: Client Integration (Weeks 3-4)
- [ ] Update Tauri client for Fabric invoke/query
- [ ] Implement local LevelDB cache
- [ ] Add offline-first functionality
- [ ] Implement transaction signing with X.509

### Phase 4: WebTorrent Integration (Weeks 4-5)
- [ ] Integrate WebTorrent library
- [ ] Handle torrent creation/metadata
- [ ] Store torrent hashes in blockchain
- [ ] Implement peer discovery for files

### Phase 5: Deployment & Testing (Weeks 5-6)
- [ ] Deploy Fabric network across bootstrap nodes
- [ ] Integrate with gossip protocol for peer discovery
- [ ] Performance testing (latency, throughput)
- [ ] Security testing (certificate validation, etc.)

---

## Next Steps

1. ✅ **Decisions documented** (this document)
2. ⏳ **Design Hyperledger Fabric integration** - Detailed network topology
3. ⏳ **Design repository data model** - Schema for entries, comments
4. ⏳ **Design torrent integration** - Metadata storage, DHT coordination
5. ⏳ **Update components** - Remove git references, add Fabric support

---

## Questions Resolved

This document resolves all contradictions from **ARCHITECTURE_RECONCILIATION_OCT31.md**:

- ✅ Orderer location: Distributed on bootstrap nodes + optional seed
- ✅ Channel architecture: One per repository
- ✅ Endorsement policy: 2 of 3 peers (dual endorsement)
- ✅ Data privacy: Public entries, private access requests
- ✅ Offline mode: Local cache with eventual sync
- ✅ Chaincode language: JavaScript
- ✅ Permissions: Capability-based
- ✅ File storage: Text/links in blockchain, binaries via torrent

All architectural decisions are now locked and ready for implementation.
