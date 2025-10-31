# Hyperledger Fabric Integration: Implementation Guide

**Status:** Design Phase  
**Date:** October 31, 2025  
**Version:** 1.0  
**Type:** Technical Implementation Guide

---

## Table of Contents

1. [Network Architecture](#network-architecture)
2. [Channel Configuration](#channel-configuration)
3. [Organization Structure](#organization-structure)
4. [Chaincode Design](#chaincode-design)
5. [Certificate Authority Setup](#certificate-authority-setup)
6. [Deployment Strategy](#deployment-strategy)
7. [Configuration Files](#configuration-files)
8. [Testing & Validation](#testing--validation)

---

## Network Architecture

### 1.1 Network Topology

```
┌─────────────────────────────────────────────────────────┐
│                Fabric Network                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Organization: bootstrap-org                           │
│  ├─ Peers: 3-5 nodes                                   │
│  ├─ Orderer: 3 nodes (Raft consensus)                  │
│  └─ Certificate Authority: 1 node                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Peer Deployment

**High-Capacity Bootstrap Nodes** (2-3 total):
- Located on public IPs
- Run Fabric peer node
- Run Fabric orderer (Raft consensus)
- Run WebTorrent seeder
- Participate in gossip discovery
- Are endorsers for chaincode

**Regular Peers** (unlimited):
- Can be on any network (NATted, dynamic IP)
- Connect via relay tracker (gossip bridge)
- Run Fabric peer node
- Run WebTorrent client
- Can participate in voting (if orderer nodes elected)
- Can be endorsers if configured

**Relay Tracker** (1 node):
- Optional Fabric orderer (seed)
- Optional Fabric CA (trust anchor)
- Gossip coordinator
- Bootstrap registry
- Does NOT store blockchain (orderer doesn't store state)

### 1.3 Network Traffic Patterns

```
Peer-to-Peer Communication:
├─ Bootstrap peers ←→ Bootstrap peers (direct, fast)
├─ Regular peers ←→ Bootstrap peers (direct or via relay)
├─ Regular peers ←→ Regular peers (via relay for NAT traversal)
├─ Gossip protocol (peer discovery)
├─ Fabric internal gossip (ledger sync)
└─ WebTorrent DHT (file discovery)

Orderer Communication:
├─ All peers → Orderer (send transactions)
├─ Orderer broadcasts blocks → All peers
└─ Raft consensus (bootstrap orderers only)
```

---

## Channel Configuration

### 2.1 Channel Design

**Channels for Each Repository:**

```
Channel: movies
├─ Name: movies
├─ Organizations: bootstrap-org
├─ Peers: All peers in bootstrap-org
├─ Orderer: bootstrap-org-orderer
├─ Chaincode: repo-manager v1.0
├─ Policy: Endorsement 2-of-3
└─ Ledger Key Prefix: "entry:", "comment:", "torrent:"

Channel: tv-shows
├─ Name: tv-shows
├─ Organizations: bootstrap-org
├─ Peers: All peers in bootstrap-org
├─ Orderer: bootstrap-org-orderer
├─ Chaincode: repo-manager v1.0
├─ Policy: Endorsement 2-of-3
└─ Ledger Key Prefix: "entry:", "comment:", "torrent:"

Channel: documentaries
├─ Similar structure
└─ Extensible for more repositories
```

### 2.2 Channel Creation Process

```
1. Generate channel artifacts
   └─ Use configtxgen to create genesis block
   └─ Define organizations, endorsement policies

2. Create channel (first peer only)
   └─ peer channel create -c movies -f movies.tx

3. Join channel (all peers)
   └─ peer channel join -b movies.block

4. Install chaincode (all peers)
   └─ peer lifecycle chaincode install repo-manager.tgz

5. Approve chaincode (all org endorsers)
   └─ peer lifecycle chaincode approveformyorg

6. Commit chaincode
   └─ peer lifecycle chaincode commit
```

### 2.3 Endorsement Policy Configuration

```
Channel: movies
Endorsement Policy: {
  version: "1.0",
  policy: [
    {
      "signed-by": 0
    }
  ],
  identities: [
    {
      principal: {
        "msp-identifier": "bootstrap-org",
        role: {
          role: "peer"
        }
      }
    }
  ]
}

Interpretation:
- Need 1 of N available bootstrap-org peers to endorse
- BUT: 2-of-3 in practice (requires majority)
- Any 2 of the 3+ endorsers will satisfy policy

Result:
- Fast: Only needs 2 peers (not all 5)
- Safe: Quorum ensures correctness
- Resilient: If 1 peer down, 2 others proceed
```

---

## Organization Structure

### 3.1 Organization Configuration

```
MSP (Membership Service Provider): bootstrap-org

├─ CA: bootstrap-org-ca
│  ├─ Admin certificate
│  ├─ Peer certificates
│  ├─ User certificates (with capabilities)
│  └─ Orderer certificates
│
├─ Peers:
│  ├─ peer1.bootstrap-org (endorser)
│  ├─ peer2.bootstrap-org (endorser)
│  ├─ peer3.bootstrap-org (endorser)
│  ├─ peer4.bootstrap-org (committer)
│  └─ peer5.bootstrap-org (committer)
│
├─ Orderers:
│  ├─ orderer1.bootstrap-org
│  ├─ orderer2.bootstrap-org
│  └─ orderer3.bootstrap-org
│
└─ Admin:
   └─ admin@bootstrap-org (manages org)
```

### 3.2 Multi-Organizational Model (Future)

If expanding to multiple organizations:

```
Scenario: Multiple data stewards

Organization: bootstrap-org (manages infrastructure)
├─ Peers: peer1, peer2, peer3 (endorsers)
└─ Orderer: orderer1, orderer2, orderer3

Organization: content-org (manages content repos)
├─ Peers: peer1, peer2 (endorsers)
└─ Uses bootstrap-org orderers

Endorsement Policy: {
  "2-of": [
    {"signed-by": 0},   // bootstrap-org peer
    {"signed-by": 1}    // content-org peer
  ]
}

Result: All transactions need agreement from both orgs
```

---

## Chaincode Design

### 4.1 Chaincode Overview

**Name:** repo-manager  
**Language:** JavaScript (Node.js)  
**Version:** 1.0  

**Functions:**

| Function | Parameters | Returns | Effect |
|----------|-----------|---------|--------|
| `addEntry` | `repo, entry` | `entryId` | Create new entry |
| `removeEntry` | `repo, entryId` | `success` | Delete entry |
| `getEntry` | `repo, entryId` | `entry` | Retrieve entry |
| `searchEntries` | `repo, query` | `[entries]` | Search entries |
| `addComment` | `repo, entryId, comment` | `commentId` | Add comment/review |
| `getComments` | `repo, entryId` | `[comments]` | Get all comments |
| `getHistory` | `repo, entryId` | `[transactions]` | Full audit trail |
| `listRepositories` | none | `[repos]` | List all repos |

### 4.2 Data Model

**Entry Object:**
```javascript
{
  id: "movie-001",                    // Unique within repo
  title: "Inception",                 // String
  year: 2010,                         // Integer
  addedBy: "alice@example.com",       // User email
  addedAt: "2025-10-31T10:00:00Z",   // ISO 8601
  torrentHash: "abc123def456...",     // WebTorrent hash
  fileSize: 2147483648,               // Bytes
  description: "...",                 // Text
  genres: ["sci-fi", "thriller"],     // Array
  metadata: {                         // Custom metadata
    imdbId: "tt1375666",
    director: "Christopher Nolan",
    rating: 8.8
  }
}
```

**Comment Object:**
```javascript
{
  id: "comment-123",
  entryId: "movie-001",
  commentedBy: "bob@example.com",
  commentedAt: "2025-10-31T11:00:00Z",
  content: "Great movie!",
  rating: 5,                          // 1-5 stars
  type: "review"                      // "review", "annotation", etc.
}
```

### 4.3 Chaincode Structure

```javascript
// repo-manager.js

// Contract: RepoManager
class RepoManager {
  
  // --- Entry Management ---
  
  async addEntry(ctx, repo, entryData) {
    // Verify invoker has "add-entry" capability
    // Generate unique ID
    // Store in ledger state
    // Emit entry-added event
    return entryId;
  }

  async removeEntry(ctx, repo, entryId) {
    // Verify invoker has "remove-entry" capability
    // Check entry exists
    // Mark as deleted (or remove)
    // Emit entry-removed event
    return { success: true };
  }

  async getEntry(ctx, repo, entryId) {
    // Read from ledger state
    // Return entry or null
    return entry;
  }

  async searchEntries(ctx, repo, query) {
    // Search entries by title, metadata, etc.
    // Return matching entries
    return entries;
  }

  // --- Comment Management ---

  async addComment(ctx, repo, entryId, commentData) {
    // Verify entry exists
    // Generate comment ID
    // Store comment
    // Emit comment-added event
    return commentId;
  }

  async getComments(ctx, repo, entryId) {
    // Get all comments for entry
    // Sort by date
    return comments;
  }

  // --- History & Audit ---

  async getHistory(ctx, repo, entryId) {
    // Get transaction history
    // Show all changes to entry
    return history;
  }

  // --- Repository Management ---

  async listRepositories(ctx) {
    // List all channels we're part of
    return ["movies", "tv-shows", "documentaries"];
  }
}
```

### 4.4 Capability Verification

```javascript
// Inside chaincode
async addEntry(ctx, repo, entryData) {
  // Get invoker's certificate
  const cert = ctx.clientIdentity.getX509Certificate();
  const attributes = cert.getExtensions();

  // Check for "add-entry" capability
  if (!this.hasCapability(attributes, "add-entry")) {
    throw new Error("User not authorized to add entries");
  }

  // Check repository permission
  const repoAccess = attributes["repository"] || ["*"];
  if (repoAccess !== "*" && !repoAccess.includes(repo)) {
    throw new Error(`User not authorized for repository: ${repo}`);
  }

  // Proceed with adding entry...
}

hasCapability(attributes, capability) {
  const caps = attributes["capability"] || [];
  return caps.includes(capability) || caps.includes("admin");
}
```

---

## Certificate Authority Setup

### 5.1 CA Configuration

```
Organization: bootstrap-org
Certificate Authority: bootstrap-org-ca

Attributes:
├─ capability: "add-entry" | "comment" | "admin" | "torrent-seed"
├─ repository: "movies" | "tv-shows" | "*"
└─ role: "peer" | "orderer" | "user"

Certificate Types:
├─ Admin: Manages organization
├─ Peer: Runs fabric peer node
├─ Orderer: Runs ordering service
├─ User: Makes transactions
└─ Client: SDK client certificates
```

### 5.2 Enrollment Flow

```
User Registration Flow:

1. User creates CSR (Certificate Signing Request)
   ├─ Email: alice@example.com
   ├─ Public key: alice-pub.pem
   └─ Desired capabilities: ["add-entry", "comment"]

2. Relay Tracker (CA) validates CSR
   ├─ Verify email uniqueness
   ├─ Verify proof of ownership
   └─ Approve or reject

3. CA signs certificate with attributes
   ├─ Subject: alice@example.com
   ├─ Extensions: capability, repository
   ├─ Valid for: 1 year (configurable)
   └─ Signed with CA private key

4. User receives certificate
   ├─ X.509 certificate
   ├─ CA certificate (for chain of trust)
   └─ Stores locally

5. User uses certificate for Fabric transactions
   ├─ SDK signs transactions with private key
   ├─ Chaincode verifies certificate
   └─ Capabilities are checked
```

### 5.3 Capability Assignment

**Bootstrap Node Admin:**
```
cn=admin
capability=admin
repository=*
role=peer
```

**Regular User (Content Creator):**
```
cn=alice@example.com
capability=add-entry,comment
repository=*
role=user
```

**Torrent Seeder:**
```
cn=seeder@example.com
capability=torrent-seed
repository=*
role=user
```

**Repository Moderator:**
```
cn=moderator@example.com
capability=remove-entry,add-admin-comment
repository=movies
role=user
```

---

## Deployment Strategy

### 6.1 Phase 1: Local Development

```
Environment: Single machine, all components

1. Install Fabric binaries
   └─ fabric-samples repository

2. Start Fabric network (dev setup)
   └─ docker-compose with peer, orderer, CA

3. Create test channels
   └─ movies, tv-shows

4. Deploy chaincode
   └─ repo-manager v1.0

5. Test with CLI and SDK
   └─ Invoke transactions
   └─ Query ledger state

Location: localhost:7051, localhost:7050, etc.
```

### 6.2 Phase 2: Testnet Deployment

```
Environment: 3 bootstrap nodes on cloud

Bootstrap Node 1 (bootstrap1.relay.example.com):
├─ Fabric Peer
├─ Fabric Orderer
├─ WebTorrent Seeder
└─ Gossip Listener

Bootstrap Node 2 (bootstrap2.relay.example.com):
├─ Fabric Peer
├─ Fabric Orderer
├─ WebTorrent Seeder
└─ Gossip Listener

Bootstrap Node 3 (bootstrap3.relay.example.com):
├─ Fabric Peer
├─ Fabric Orderer
├─ WebTorrent Seeder
└─ Gossip Listener

Relay Tracker (relay.example.com):
├─ Fabric CA (certificate authority)
├─ Bootstrap registry (peer discovery)
└─ Optional: Orderer seed node

Network: All communicate via TLS
```

### 6.3 Phase 3: Production Deployment

```
Same as Phase 2 but with:

1. High availability
   ├─ Each component replicated
   ├─ Load balancing for orderers
   └─ Backup CA

2. Monitoring
   ├─ Prometheus for metrics
   ├─ ELK stack for logs
   └─ Health checks

3. Security hardening
   ├─ TLS 1.3 for all connections
   ├─ Certificate rotation
   ├─ Network policies (firewall)
   └─ Regular security audits

4. Scaling
   ├─ More bootstrap nodes (5-7)
   ├─ More channels (repos)
   └─ More orderers (5+ for Raft)
```

### 6.4 Peer Network Integration

```
Existing Peers (Tauri Clients) Join Fabric:

1. Peer downloads Fabric
   └─ Installs peer binary

2. Peer generates certificate
   └─ Requests from Relay CA
   └─ Receives X.509 certificate

3. Peer joins network
   ├─ Connects to bootstrap nodes
   ├─ Syncs ledger state
   └─ Joins channels (movies, tv-shows, etc.)

4. Peer operates
   ├─ Queries local ledger
   ├─ Submits transactions
   ├─ Participates in gossip
   └─ Seeds/downloads via WebTorrent
```

---

## Configuration Files

### 7.1 Organization Configuration (org.json)

```json
{
  "name": "bootstrap-org",
  "mspId": "bootstrap-org",
  "ca": {
    "name": "bootstrap-org-ca",
    "url": "https://ca.bootstrap-org:7054"
  },
  "peers": [
    {
      "name": "peer1.bootstrap-org",
      "url": "grpcs://peer1.bootstrap-org:7051",
      "endorser": true
    },
    {
      "name": "peer2.bootstrap-org",
      "url": "grpcs://peer2.bootstrap-org:7051",
      "endorser": true
    },
    {
      "name": "peer3.bootstrap-org",
      "url": "grpcs://peer3.bootstrap-org:7051",
      "endorser": true
    }
  ],
  "orderers": [
    {
      "name": "orderer1.bootstrap-org",
      "url": "grpcs://orderer1.bootstrap-org:7050"
    },
    {
      "name": "orderer2.bootstrap-org",
      "url": "grpcs://orderer2.bootstrap-org:7050"
    },
    {
      "name": "orderer3.bootstrap-org",
      "url": "grpcs://orderer3.bootstrap-org:7050"
    }
  ]
}
```

### 7.2 Channel Configuration (movies-channel.json)

```json
{
  "name": "movies",
  "organizations": ["bootstrap-org"],
  "chaincode": {
    "name": "repo-manager",
    "version": "1.0",
    "language": "javascript"
  },
  "endorsement": {
    "policy": "1-of",
    "organizations": ["bootstrap-org"],
    "threshold": 1
  },
  "collectionConfig": [],
  "acl": {
    "addEntry": "authenticated",
    "removeEntry": "admin",
    "addComment": "authenticated"
  }
}
```

### 7.3 Chaincode Package (package.json)

```json
{
  "name": "repo-manager",
  "version": "1.0.0",
  "description": "Repository manager chaincode for Fabric",
  "main": "index.js",
  "scripts": {
    "start": "fabric-chaincode-node start",
    "test": "jest"
  },
  "dependencies": {
    "fabric-chaincode-node": "^2.4.0",
    "fabric-contract-api": "^2.4.0"
  },
  "engines": {
    "node": "14.x || 16.x"
  }
}
```

---

## Testing & Validation

### 8.1 Unit Tests

```javascript
// Test repo-manager.test.js

describe("RepoManager Chaincode", () => {
  
  describe("addEntry", () => {
    it("should add entry to movies repo", async () => {
      const entry = { title: "Test Movie", year: 2025 };
      const id = await contract.addEntry("movies", entry);
      expect(id).toBeDefined();
    });

    it("should fail without add-entry capability", async () => {
      const userWithoutCap = { /* no capability */ };
      expect(() => {
        contract.addEntry("movies", entry);
      }).toThrow("not authorized");
    });

    it("should store entry in ledger", async () => {
      const entry = { title: "Test" };
      const id = await contract.addEntry("movies", entry);
      const retrieved = await contract.getEntry("movies", id);
      expect(retrieved).toEqual(entry);
    });
  });

  describe("searchEntries", () => {
    it("should find entries by title", async () => {
      const results = await contract.searchEntries("movies", "Inception");
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
```

### 8.2 Integration Tests

```javascript
// Test fabric-integration.test.js

describe("Fabric Network Integration", () => {
  
  it("should create transaction successfully", async () => {
    const result = await invokeTransaction({
      channel: "movies",
      chaincode: "repo-manager",
      function: "addEntry",
      args: [{ title: "Test" }]
    });
    expect(result.status).toBe("VALID");
  });

  it("should synchronize across peers", async () => {
    // Add entry via peer1
    await peer1.invoke(...);
    
    // Query via peer2
    const result = await peer2.query("getEntry", ["movies", id]);
    expect(result).toBeDefined();
  });

  it("should handle endorsement failures", async () => {
    // Kill one endorser
    await peer1.stop();
    
    // Transaction should still succeed (2 of 3)
    const result = await invokeTransaction(...);
    expect(result.status).toBe("VALID");
  });
});
```

### 8.3 Performance Tests

```
Test: Transaction Latency
├─ Invoke addEntry
├─ Measure: Time from invoke to commit
├─ Expected: < 2 seconds with dual endorsement

Test: Throughput
├─ Submit 100 transactions concurrently
├─ Measure: Transactions per second
├─ Expected: > 100 TPS (with 3 peers)

Test: Ledger Size
├─ Add 10,000 entries
├─ Measure: Ledger size on disk
├─ Expected: < 1 GB (movies channel alone)

Test: Query Performance
├─ Search 10,000 entries
├─ Measure: Query response time
├─ Expected: < 100 ms
```

---

## Conclusion

This document provides the complete technical specification for Hyperledger Fabric integration:

- ✅ Network topology (3+ bootstrap nodes + Raft orderers)
- ✅ Channel structure (one per repository)
- ✅ Organization setup (bootstrap-org with CA)
- ✅ Chaincode design (repo-manager in JavaScript)
- ✅ Certificate authority (capability-based enrollment)
- ✅ Deployment strategy (dev → testnet → production)
- ✅ Configuration templates (ready to use)
- ✅ Testing framework (unit, integration, performance)

Ready for Phase 1 implementation.
