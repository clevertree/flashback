# Architecture Reconciliation: Git → Hyperledger Fabric Pivot

**Status:** Architectural Reconciliation  
**Date:** October 31, 2025  
**Version:** 1.0  
**Type:** Requirements Clarification Document

---

## Executive Summary

### Requirements Evolution

1. **Initial:** Decentralized git repositories via bootstrap nodes with x509 signing and blockchain
2. **Revised:** Replace git with Hyperledger Fabric, use named repositories (movies, tv-shows), LevelDB for storage, WebTorrent for large files

### Key Changes
- ❌ Git repositories → ✅ Hyperledger Fabric ledger
- ❌ File-based commits → ✅ Key-value transactions (LevelDB)
- ❌ Git pull/push protocol → ✅ Fabric chaincode invocations
- ✅ X.509 certificates (STILL VALID for Fabric authentication)
- ✅ Bootstrap nodes (STILL VALID for Fabric peer network)
- ✅ Gossip protocol (STILL VALID for peer discovery)
- ✅ WebTorrent (STILL VALID for large file distribution)

---

## Contradictions Identified

### 1. CA Architecture vs. Fabric Certificates ❌→✅

**Contradiction:**
- CA_ARCHITECTURE.md designed CSR flow for signing commits
- Commits no longer exist in Fabric model

**Resolution:**
- ✅ **CA model is STILL VALID** for Fabric
- Fabric requires X.509 certificates for:
  - Identity (each peer must have cert)
  - Transaction signing (each user's transactions signed with cert)
  - Access control (membership services)
  - Chain of trust (CA issues certificates to peers)
- **Action:** CSR flow becomes Fabric enrollment flow

**Updated Flow:**
```
Old (Git):
  Client CSR → Relay CA → Signs certificate
  → Client signs commits with cert

New (Fabric):
  Client CSR → Relay CA (Fabric CA) → Enrolls client
  → Client joins Fabric organization
  → Client signs Fabric transactions with cert
```

---

### 2. RemoteHouse Component ❌→?

**Contradiction:**
- RemoteHouse designed for git protocol (`/git/push`, `/git/pull`)
- RemoteHouse expects file-based operations
- RemoteHouse no longer applicable with Fabric

**Resolution Options:**
- ❌ **Keep as-is:** Git protocol doesn't exist anymore
- ✅ **Option A:** Repurpose as Fabric transaction browser
- ✅ **Option B:** Replace with Fabric UI (query ledger, submit transactions)
- ✅ **Option C:** Keep for future extensibility, mark deprecated

**Recommendation:** Replace with Fabric-aware component that shows:
- Available repositories (Fabric channels or namespace)
- Ledger entries (movies, tv-shows, etc.)
- Transaction history (who added what, when)
- Comments/reviews system

---

### 3. Git Endpoints ❌→ Fabric Endpoints

**Contradiction:**
- Designed: `/git/push`, `/git/pull`, `/git/fetch`, `/git/clone`
- Reality: No git protocol needed

**Resolution:**
Replace with Fabric-native endpoints:

```
OLD (Git):
  POST /git/push           → Push commits
  GET /git/pull            → Pull commits
  GET /git/fetch           → Fetch objects
  POST /git/clone          → Clone repository

NEW (Fabric):
  POST /fabric/invoke      → Submit transaction (invoke chaincode)
  GET /fabric/query        → Query ledger state
  GET /fabric/history      → Get transaction history
  GET /fabric/channel      → List available channels/repos
  
  Specific operations:
  POST /repo/{name}/entry  → Add entry to repo
  POST /repo/{name}/comment → Add comment/review
  POST /repo/{name}/access → Request file access
```

---

### 4. Repository Structure ❌→✅

**Contradiction:**
- Previous: Git repos with filesystem structure
- Current: Named repos (movies, tv-shows)

**Resolution:** ✅ **NO CONTRADICTION - This aligns better**

```
OLD (Git filesystem):
  repos/
  ├── movies/
  │   ├── commits/
  │   ├── objects/
  │   └── refs/
  └── tv-shows/
      ├── commits/
      └── ...

NEW (Fabric + LevelDB):
  Fabric Channels:
    - movies-channel
    - tv-shows-channel
  
  LevelDB Keys (per channel):
    - entry:movie-001
    - entry:movie-002
    - comment:movie-001:review-123
    - torrent:movie-001:file-hash
```

---

### 5. Commit Signing ❌→ Transaction Signing

**Contradiction:**
- CA_ARCHITECTURE.md: X.509 signing of commits
- Commits don't exist in Fabric

**Resolution:** ✅ **CA model ADAPTS to Fabric transactions**

```
OLD (Git Commits):
  commit {
    author: alice@example.com
    message: "Added movie X"
    signature: <signed with alice's private key>
  }

NEW (Fabric Transactions):
  transaction {
    invoker: alice@example.com (from cert)
    chaincode: repo-manager
    function: addEntry
    args: { repo: "movies", entry: {...} }
    signature: <signed with alice's private key>
    timestamp: <Fabric-generated>
    nonce: <Fabric-generated>
  }
```

**X.509 Certificates still used for:**
- Transaction signing (mandatory in Fabric)
- Identity verification
- Access control (who can invoke which chaincode)

---

### 6. Blockchain (Multiple Interpretations)

**Contradiction:**
- Original requirement: "verify commits on the blockchain"
- Now: Hyperledger Fabric IS the blockchain

**Resolution:** ✅ **Perfect alignment**

```
Fabric = Distributed Ledger = Blockchain

Each transaction (entry add, comment, access request):
  ├─ Gets a transaction ID
  ├─ Gets a block number
  ├─ Is cryptographically signed
  ├─ Is immutable (can't be changed)
  ├─ Can be queried for history
  └─ Verifiable by all peers
```

**No separate "blockchain verification" needed - Fabric IS the verification system**

---

### 7. Repository Scripts (RemoteHouse) ❌→ Chaincode

**Contradiction:**
- RemoteHouse designed: `/search`, `/browse`, `/comment`, `/insert`, `/remove`
- These are now Fabric chaincode functions, not HTTP endpoints

**Resolution:**

```
OLD (HTTP + JavaScript):
  GET /repo/movies/search?query=...
  → Executes ./scripts/search.js locally
  
NEW (Fabric):
  POST /fabric/invoke
  {
    channel: "movies",
    chaincode: "repo-manager",
    function: "search",
    args: ["movies", "query-string"]
  }
  → Executes chaincode (Go/Node.js) on Fabric network
  → Result is deterministic across all peers
  → Result is recorded in ledger
```

---

### 8. Bootstrap Nodes + Fabric Peers

**Contradiction?** ❌ **NONE - They're complementary**

```
Bootstrap Nodes (Current Design):
  - High-capacity peers
  - Register with relay for discovery
  - Share IP via gossip protocol
  - Gateway to peer network

Fabric Peers (New Design):
  - Each peer runs Fabric peer node
  - Each peer has X.509 certificate (from CA)
  - Each peer participates in Fabric network
  - Bootstrap nodes CAN also be Fabric peers
```

**Alignment:**
- Bootstrap nodes = High-performance Fabric peers
- Non-broadcasting peers = Fabric peers that don't expose IP (use relay)
- Gossip protocol = Distributes peer discovery (Fabric has own gossip for ledger sync)
- WebTorrent = Large file distribution (separate from Fabric)

**Architecture:**
```
Peer A (Bootstrap, High-Capacity)
├─ Fabric Peer
├─ WebTorrent Seeder
└─ Gossip discoverable

Peer B (Silent, Low-Capacity)
├─ Fabric Peer (via relay)
├─ WebTorrent Leecher
└─ Gossip listening only

Relay Tracker (Certificate Authority + Bootstrap Registry)
├─ Fabric CA (signs enrollment certificates)
├─ Bootstrap registry (stores bootstrap peer IPs)
└─ Gossip coordinator
```

---

### 9. LevelDB Placement

**Question:** Where does LevelDB fit?

**Answer:** LevelDB is used by Hyperledger Fabric internally:

```
Hyperledger Fabric Architecture:
├─ Chaincode (smart contracts in Go/Node.js)
├─ Ledger State Database
│  ├─ World State (key-value pairs) ← USES LevelDB
│  └─ History (all transactions)
├─ Block Store (immutable blocks)
└─ Peer communication (gossip)
```

**You don't directly use LevelDB - Fabric uses it for you**

However, for local client-side caching:
```
Client (optional local cache):
├─ LevelDB cache of ledger state
├─ LevelDB cache of torrent metadata
└─ Can query local cache if offline
```

---

## What Stays Valid ✅

### From Previous Designs

| Component | Status | Applies To |
|-----------|--------|-----------|
| **CA Architecture** | ✅ Valid | Fabric enrollment, transaction signing |
| **Bootstrap Nodes** | ✅ Valid | Gateway to Fabric network |
| **Gossip Protocol** | ✅ Valid | Peer discovery (Fabric has own gossip) |
| **WebTorrent** | ✅ Valid | Large file distribution |
| **X.509 Certificates** | ✅ Essential | Fabric identity, signing |
| **Peer Table** | ✅ Valid | Peer discovery in gossip layer |
| **IP Sharing Rules** | ✅ Valid | Privacy protection (non-broadcast peers) |

---

## What Changes ❌

| Component | Old | New | Why |
|-----------|-----|-----|-----|
| **Repository Format** | Git files | Fabric ledger | Distributed state machine |
| **Commit Storage** | Git commits | Fabric transactions | Consensus required |
| **Access Method** | Git protocol | Chaincode invocation | Better for structured data |
| **Concurrency** | Git merge conflicts | Fabric consensus | Deterministic execution |
| **Repository Scripts** | JavaScript in repo | Chaincode (Go/Node) | Fabric requirement |
| **Data Format** | File-based | Key-value entries | LevelDB/Fabric storage |

---

## What Gets Removed ❌

| Component | Reason |
|-----------|--------|
| **Git endpoints** (`/git/push`, etc.) | Not needed for Fabric |
| **RemoteHouse git functions** | Git protocol doesn't exist |
| **Git CSR flow** | Becomes Fabric enrollment instead |
| **Commit signing spec** | Becomes Fabric transaction signing |
| **Git pull/fetch** | Becomes Fabric query/invoke |

---

## What Gets Refactored 🔄

| Component | From | To |
|-----------|------|-----|
| **RemoteHouse** | Git operations | Fabric UI (browse ledger, submit tx) |
| **API Bridge** | Git commands | Fabric invoke/query commands |
| **Repository Browser** | File browser | Ledger entry browser |
| **Commit Signing** | Git commit signature | Fabric transaction signature |
| **CA Architecture** | CSR for commits | CSR for Fabric enrollment |

---

## New Documents Needed

Based on this pivot, here are the documents that should be created:

1. ❌ `DECENTRALIZED_GIT_PROTOCOL.md` - **NOT NEEDED** (no git)
2. ❌ `GIT_COMMIT_SIGNING.md` - **NOT NEEDED** (Fabric handles this)
3. ✅ `HYPERLEDGER_FABRIC_INTEGRATION.md` - **NEEDED**
   - Fabric deployment on peer network
   - Chaincode architecture
   - Channel design (movies, tv-shows, etc.)
   - Endorsement policies

4. ✅ `REPOSITORY_DATA_MODEL.md` - **NEEDED**
   - Named repository schema
   - Entry structure
   - Comment/review system
   - Access request workflow
   - Key-value design (LevelDB keys)

5. ✅ `FABRIC_TRANSACTION_SIGNING.md` - **NEEDED**
   - Replaces git commit signing spec
   - Explains X.509 transaction signing in Fabric
   - Identity verification

6. ✅ `TORRENT_FILE_DISTRIBUTION.md` - **NEEDED**
   - WebTorrent integration
   - Torrent metadata in Fabric ledger
   - File access workflow

7. ✅ `CA_ARCHITECTURE.md` - **KEEP & UPDATE**
   - Enrollment flow (not CSR for commits)
   - Fabric identity management
   - Organization structure (peers, endorsers)

8. ✅ `PEER_DISCOVERY_ARCHITECTURE.md` - **KEEP**
   - Bootstrap nodes for Fabric peer discovery
   - Gossip protocol for peer info
   - Works alongside Fabric's internal gossip

---

## Architecture Diagram: Reconciled

```
┌─────────────────────────────────────────┐
│         Relay Tracker (Multi-Role)      │
├─────────────────────────────────────────┤
│                                         │
│  1. Fabric Certificate Authority       │
│     └─ Enroll peers/users with X.509   │
│                                         │
│  2. Bootstrap Node Registry            │
│     └─ Store high-capacity peer IPs    │
│                                         │
│  3. Gossip Coordinator (optional)      │
│     └─ Facilitate peer discovery       │
└────────────┬────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌──────────┐  ┌──────────┐
│ Peer A   │  │ Peer B   │ (Silent/Non-broadcast)
│(Bootstrap)  │(Regular) │
├──────────┤  ├──────────┤
│          │  │          │
│Fabric    │  │Fabric    │
│Peer Node │  │Peer Node │
│          │  │          │
│Chaincode │  │Chaincode │
│Execution │  │Execution │
│          │  │          │
│LevelDB   │  │LevelDB   │
│(Ledger)  │  │(Ledger)  │
│          │  │          │
│WebTorrent│  │WebTorrent│
│Seeder    │  │Leecher   │
│          │  │          │
└──────────┘  └──────────┘
      │             │
      └─────┬───────┘
            │
    (Gossip Protocol for peer discovery)
    (Fabric Gossip for ledger sync)
    (WebTorrent DHT for file distribution)
```

---

## Reconciled Workflow: Adding Movie Entry

### Old (Git-Based)
```
1. User creates commit in git repo
2. User signs commit with X.509 cert
3. User git push to bootstrap node
4. Bootstrap node receives git objects
5. Other peers git pull changes
6. All peers have same files
```

### New (Fabric-Based)
```
1. User invokes Fabric chaincode function: addEntry
   - Function: repo-manager.addEntry
   - Argument: { repo: "movies", entry: {...} }
   - Signed with X.509 cert by Fabric SDK

2. Endorsing peers (bootstrap nodes) execute chaincode
   - Simulate transaction execution
   - Read from ledger state
   - Write to ledger state
   - Return simulation result + signature

3. Client collects endorsements
   - Needs N of M endorsements (set by endorsement policy)
   - Typically: 1-2 endorsements enough

4. Client orders transaction
   - Sends to orderer (could be bootstrap node)
   - Orderer batches transactions
   - Orderer creates block

5. All peers receive block
   - Peers execute chaincode again (validation)
   - Peers check endorsement signatures
   - Peers commit block to ledger
   - All peers now have entry in ledger state

6. WebTorrent handles large files
   - If entry includes large file
   - Create torrent metadata
   - Store metadata in ledger
   - Seed file via WebTorrent
   - Others download via WebTorrent
```

---

## Timeline & Dependencies

### Immediate (Remove Contradictions)
- [ ] Mark git-related docs as archived/obsolete
- [ ] Clarify CA applies to Fabric enrollment
- [ ] Document this reconciliation

### Phase 1: Fabric Setup (Weeks 1-2)
- [ ] Deploy Hyperledger Fabric network (dev-net with 3-5 peers)
- [ ] Create Fabric CA for enrollment
- [ ] Design channels (movies, tv-shows, etc.)

### Phase 2: Chaincode Development (Weeks 2-4)
- [ ] Write repo-manager chaincode (add, remove, search, comment)
- [ ] Implement endorsement policies
- [ ] Test with different access patterns

### Phase 3: Client Integration (Weeks 4-6)
- [ ] Update Tauri client to invoke chaincode
- [ ] Implement transaction signing with X.509
- [ ] Refactor RemoteHouse for Fabric queries

### Phase 4: WebTorrent Integration (Weeks 6-7)
- [ ] Integrate WebTorrent for file distribution
- [ ] Store torrent metadata in Fabric
- [ ] Handle file access requests

### Phase 5: Deployment (Weeks 7+)
- [ ] Deploy Fabric network across peers
- [ ] Set up peer discovery with bootstrap nodes
- [ ] Production hardening

---

## Open Questions

1. **Fabric Orderer:** Where does the orderer run?
   - Option A: Centralized (relay tracker)
   - Option B: Distributed (elected bootstrap nodes)
   - Option C: BFT consensus (more complex)

2. **Channel Structure:** One channel per repository?
   - Option A: One channel per repo (movies, tv-shows, etc.)
   - Option B: Single channel with namespace (all repos)
   - Option C: Hierarchical (repo/category/item)

3. **Endorsement Policy:** How many peers must endorse?
   - Option A: 1 endorsement (fast but less safe)
   - Option B: 2+ endorsements (more safe)
   - Option C: Majority of peers (most safe)

4. **Private Data:** Should comments/reviews be private?
   - Option A: All data public (simple)
   - Option B: Private collections (complex)
   - Option C: User-selectable privacy

5. **Offline Support:** How to handle offline peers?
   - Option A: Sync on reconnect (Fabric native)
   - Option B: Local LevelDB cache (manual)
   - Option C: Both (hybrid)

---

## Conclusion

The pivot from Git to Hyperledger Fabric is:
- ✅ **Compatible with CA architecture** (adapts to Fabric enrollment)
- ✅ **Compatible with bootstrap nodes** (become Fabric peers)
- ✅ **Compatible with gossip protocol** (peer discovery)
- ✅ **Compatible with WebTorrent** (file distribution)
- ❌ **Removes** git protocol endpoints
- ❌ **Removes** git commit signing (becomes Fabric tx signing)
- 🔄 **Refactors** RemoteHouse and other git-aware components

The architecture is now more coherent:
- **Distributed state:** Managed by Fabric ledger
- **Transaction consensus:** Handled by Fabric orderer
- **Identity:** X.509 certificates from CA
- **Large files:** WebTorrent distribution
- **Peer discovery:** Gossip protocol + bootstrap nodes
- **Immutability:** Ledger blocks (stronger than git)

This is a cleaner, more enterprise-grade architecture than the git-based approach.
