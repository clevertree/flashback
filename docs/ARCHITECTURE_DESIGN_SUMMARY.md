# Architecture Design Summary: Hyperledger Fabric Implementation

**Date:** October 31, 2025  
**Status:** Core Architecture Complete  
**Phase:** Detailed Design (Ready for Implementation)

---

## What's Been Designed ✅

### 1. **Fabric Network Architecture** ✅
- **File:** `FABRIC_IMPLEMENTATION_GUIDE.md`
- **Details:**
  - 3-5 bootstrap nodes with Raft orderers
  - Optional seed orderer on relay tracker
  - Distributed consensus (no single point of failure)
  - One channel per repository
  - Dual endorsement policy (2 of 3 peers)
  - JavaScript chaincode for all repositories

### 2. **Channel-Based Repository Isolation** ✅
- **File:** `CHANNEL_ARCHITECTURE_CLARIFICATION.md`
- **Details:**
  - Each Fabric channel = one repository (movies, tv-shows, etc.)
  - Simplified key structure (no repo prefix)
  - Physical isolation per repository
  - Repositories don't interfere with each other
  - Cleaner chaincode API

### 3. **Selective Channel Subscription** ✅
- **File:** `SELECTIVE_CHANNEL_SUBSCRIPTION.md`
- **Details:**
  - Peers join only channels they care about
  - Storage proportional to participation
  - Bootstrap nodes: Join all channels (full archive)
  - Consumer nodes: Join 1-5 channels of interest
  - Mobile devices: Join 1-2 channels
  - 60% bandwidth savings with selective approach

### 4. **Data Model & Schema** ✅
- **File:** `REPOSITORY_DATA_MODEL.md`
- **Details:**
  - Entry schema (media entries with metadata)
  - Comment schema (reviews/ratings)
  - Torrent metadata (file distribution info)
  - User profiles (accounts with capabilities)
  - Key naming: `entry:id`, `comment:id:commentId`, `torrent:id:variant`
  - Text and links only in blockchain
  - Binary files via WebTorrent

### 5. **Comment Ownership & Permissions** ✅
- **File:** `COMMENT_OWNERSHIP_PERMISSIONS.md`
- **Details:**
  - Comments store `commentedBy` from X.509 certificate
  - Default: Users can only edit/delete own comments
  - Admin override: Can edit/delete any comment
  - Immutability: Comments marked deleted, not erased
  - Full audit trail preserved
  - Chaincode enforces permissions

### 6. **Certificate Authority Model** ✅
- **File:** `CA_ARCHITECTURE.md`
- **Details:**
  - Relay tracker as Certificate Authority (CA)
  - CSR (Certificate Signing Request) flow
  - Email uniqueness enforcement
  - Capability-based permissions (attributes in certs)
  - Repository-level access control
  - X.509 for identity and transaction signing

### 7. **Architectural Decisions (8 Core Decisions)** ✅
- **File:** `FABRIC_DECISION_DOCUMENT.md`
- **Decisions:**
  1. Distributed orderer on bootstrap nodes
  2. One channel per repository
  3. Dual endorsement (2 of 3 peers)
  4. Public entries, private access requests
  5. Local LevelDB cache for offline support
  6. JavaScript chaincode
  7. Capability-based permissions
  8. Text/links in blockchain only, binaries via WebTorrent

### 8. **Reconciliation: Git → Fabric Pivot** ✅
- **File:** `ARCHITECTURE_RECONCILIATION_OCT31.md`
- **Details:**
  - Documents transition from git repositories to Fabric
  - Identifies what stays valid (peer discovery, CA, gossip protocol)
  - Identifies what's obsolete (git endpoints, RemoteHouse scripts)
  - Clarifies how CA model adapts to Fabric

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────┐
│         Relay Tracker                       │
├─────────────────────────────────────────────┤
│ - Fabric Certificate Authority (CA)         │
│ - Optional Fabric Orderer (seed)            │
│ - Bootstrap node registry (gossip)          │
│ - Channel registry (discovery)              │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┬───────────┬──────────┐
        │                 │           │          │
        ▼                 ▼           ▼          ▼
    Bootstrap A      Bootstrap B   Peer C    Peer D
    (Full Archive)   (Full Archive) (Selective) (Mobile)
    ├─ All channels  ├─ All channels├─2 channels├─1 channel
    ├─ Orderer       ├─ Orderer     ├─ Consumer ├─ Mobile
    ├─ 210 MB        ├─ 210 MB      ├─ 84 MB    ├─ 42 MB
    └─ Seeder        └─ Seeder      └─ Seeder   └─ Seeder
```

### Data Flow

```
1. User adds entry:
   ├─ Creates torrent (binary file)
   ├─ Submits chaincode tx (signed with X.509)
   ├─ Entry recorded in blockchain (text only)
   ├─ Torrent hash stored in blockchain
   └─ File distributed via WebTorrent

2. User comments:
   ├─ Submits chaincode tx (email from cert)
   ├─ Comment recorded with ownership
   ├─ Blockchain verifies signature
   └─ Only owner can edit by default

3. User searches:
   ├─ Queries local LevelDB (fast, offline)
   ├─ Or queries blockchain (if online)
   └─ Results show entries + torrent hashes

4. User downloads:
   ├─ Gets torrent hash from blockchain
   ├─ DHT finds seeders
   ├─ Downloads via WebTorrent
   └─ Peer becomes seeder
```

### Storage Model

```
Each peer stores:
├─ Local cache (LevelDB)
│  ├─ For channels joined only
│  ├─ Allows offline queries
│  └─ Can be synced when reconnected
│
├─ Blockchain (Fabric ledger)
│  ├─ All blocks for channels joined
│  ├─ Immutable transaction history
│  └─ Full audit trail
│
└─ WebTorrent data
   ├─ Downloaded files
   ├─ Seedable files
   └─ File metadata
```

---

## Permissions Model

### User Capabilities (from X.509 Certificate)

```
Basic User:
├─ Capability: "add-entry"           → Can add entries
├─ Capability: "comment"             → Can comment
├─ Repository: "movies"              → For movies channel
└─ Can edit/delete own entries and comments only

Moderator:
├─ Capability: "add-entry"
├─ Capability: "comment"
├─ Capability: "remove-entry"        → Can remove entries
├─ Repository: "movies"
└─ Can edit/delete any entries/comments

Administrator:
├─ Capability: "admin"               → All permissions
└─ Repository: "*"                   → All channels
```

### Comment Ownership Rules

```
Rule: Users can only edit/delete their own comments (by default)

How it works:
1. Comment stores commentedBy = user's email from X.509 cert
2. When editing: chaincode checks invoker == commentedBy
3. If not owner: check if invoker has "admin" capability
4. If neither: reject with "Unauthorized"

Result:
✅ Users control their own content
✅ Admins can moderate
✅ Cannot spoof other users' comments
✅ Full accountability via blockchain
```

---

## Key Decisions & Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| **Orderer** | Distributed on bootstrap nodes | Resilient, no single point of failure |
| **Channels** | One per repository | Physical isolation, cleaner design |
| **Endorsement** | 2 of 3 peers | Balanced (safe + fast) |
| **Privacy** | Entries public, requests private | Transparency + user privacy |
| **Offline** | Local cache with sync | Good UX, eventual consistency |
| **Chaincode** | JavaScript | Team expertise, good support |
| **Permissions** | Capability-based | Flexible, decentralized |
| **Files** | Text in blockchain, binaries via torrent | Efficient, scalable |
| **Comments** | Owner-only edit (default) | User control + accountability |
| **Channels** | Optional/selective | Scalability, device-friendly |

---

## What's Left to Design

### 7. **WebTorrent Integration** (In Progress)
- **Next:** `TORRENT_FILE_DISTRIBUTION.md`
- **Topics:**
  - Torrent creation workflow
  - DHT (Distributed Hash Table) integration
  - Seeding coordination across peers
  - File integrity verification
  - Large file handling (metadata in Fabric, file via torrent)
  - Bandwidth throttling
  - Peer selection algorithm

### 8. **Component Updates** (To Do)
- **Files to refactor:**
  - RemoteHouse (obsolete git functions)
  - Repository browser (update for Fabric)
  - Git protocol endpoints (remove)
  - CLI commands (adapt to Fabric)
  - Tauri API bridge (Fabric instead of git)

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Deploy Fabric network (local dev setup)
- [ ] Create channels (movies, tv-shows, etc.)
- [ ] Deploy chaincode (JavaScript)
- [ ] Setup CA with capability attributes
- [ ] Test basic transactions

### Phase 2: Integration (Weeks 3-4)
- [ ] Connect Tauri client to Fabric
- [ ] Implement channel subscription UI
- [ ] Local LevelDB caching
- [ ] Test offline/online sync
- [ ] Implement comment ownership

### Phase 3: WebTorrent (Weeks 5-6)
- [ ] Integrate WebTorrent library
- [ ] Torrent creation workflow
- [ ] File metadata in Fabric
- [ ] DHT integration for discovery
- [ ] Test seeding/leeching

### Phase 4: Testing & Hardening (Weeks 7-8)
- [ ] Performance testing (latency, throughput)
- [ ] Security testing (certificate validation)
- [ ] Stress testing (many entries, channels)
- [ ] Failure recovery testing
- [ ] Documentation

### Phase 5: Deployment (Weeks 9+)
- [ ] Deploy bootstrap nodes
- [ ] Production hardening
- [ ] Monitoring & alerting
- [ ] User testing
- [ ] Launch

---

## Key Files Created

| File | Purpose | Status |
|------|---------|--------|
| `FABRIC_IMPLEMENTATION_GUIDE.md` | Network topology, deployment | ✅ Complete |
| `CHANNEL_ARCHITECTURE_CLARIFICATION.md` | Channels as repo boundaries | ✅ Complete |
| `SELECTIVE_CHANNEL_SUBSCRIPTION.md` | Optional channel participation | ✅ Complete |
| `REPOSITORY_DATA_MODEL.md` | Entry/comment/torrent schemas | ✅ Complete |
| `COMMENT_OWNERSHIP_PERMISSIONS.md` | Comment access control | ✅ Complete |
| `CA_ARCHITECTURE.md` | Certificate authority design | ✅ Complete |
| `FABRIC_DECISION_DOCUMENT.md` | 8 core decisions | ✅ Complete |
| `ARCHITECTURE_RECONCILIATION_OCT31.md` | Git→Fabric reconciliation | ✅ Complete |
| `TORRENT_FILE_DISTRIBUTION.md` | WebTorrent integration | ⏳ In Progress |

---

## Next Steps

1. **Create WebTorrent Integration document**
   - How torrents are created
   - How metadata is stored in Fabric
   - How peers discover and download files
   - Seeding coordination

2. **Update component files**
   - Refactor RemoteHouse (git-specific code)
   - Update CLI commands for Fabric
   - Update UI for channel selection
   - Create Fabric API bridge

3. **Implementation preparation**
   - Review Fabric documentation
   - Setup local development environment
   - Create test scripts
   - Plan deployment

---

## Conclusion

The core architecture for Flashback Hyperledger Fabric integration is now fully designed:

✅ **Networking:** Distributed bootstrap nodes with Raft consensus  
✅ **Storage:** Channel-per-repository isolation with LevelDB  
✅ **Scalability:** Selective channel subscription for any device  
✅ **Permissions:** Capability-based access control from X.509 certs  
✅ **Accountability:** Comment ownership with full audit trails  
✅ **Data Model:** Text/links in blockchain, files via WebTorrent  
✅ **User Experience:** Offline-first with eventual consistency  

The system is:
- **Decentralized:** No single point of failure
- **Scalable:** Works with any number of repositories
- **Private:** User control over participation
- **Auditable:** Full blockchain history for compliance
- **Efficient:** Bandwidth/storage proportional to participation

Ready for implementation!
