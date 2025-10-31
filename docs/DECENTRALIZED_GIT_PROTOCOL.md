# Decentralized Git Protocol Over HTTP

**Status:** Architecture Design  
**Date:** October 31, 2025  
**Version:** 1.0  
**Scope:** Git repository operations via bootstrap nodes with X.509 commit signing

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture](#architecture)
3. [Git Operations](#git-operations)
4. [Commit Signing Model](#commit-signing-model)
5. [Repository Synchronization](#repository-synchronization)
6. [Conflict Resolution](#conflict-resolution)
7. [Bootstrap Node Endpoints](#bootstrap-node-endpoints)
8. [Message Formats](#message-formats)
9. [Security Model](#security-model)
10. [Scalability & Performance](#scalability--performance)
11. [Implementation Phases](#implementation-phases)

---

## Executive Summary

### Vision

Instead of centralized git hosting (GitHub, GitLab), Flashback enables **decentralized git repositories** hosted by bootstrap nodes:

```
Traditional Git (Centralized):
  All clients → GitHub server → Central authority
  (Single point of failure, censorship possible)

Flashback Git (Decentralized):
  Client A (Bootstrap)
       ↓ git push
  Client B (Bootstrap)
       ↓ git pull
  Client C (Non-bootstrap)
       ├─ git fetch bootstrap peers
       └─ Verifies all commits with X.509 signatures
```

### Key Features

✅ **Peer-Hosted Repositories** - Bootstrap nodes host repos  
✅ **X.509 Commit Signing** - Every commit signed with user's private key  
✅ **Blockchain Verification** - Commit chain verifiable by all peers  
✅ **Decentralized Sync** - Pull from any peer, push to any bootstrap  
✅ **Conflict Detection** - Client resolves before accepting  
✅ **History Integrity** - Chain of custody via signatures

---

## Architecture

### Components

```
┌──────────────────────────────────┐
│  Bootstrap Node (Repository)     │
│  - Hosts git repository          │
│  - Verifies incoming commits     │
│  - Signs commits for other peers │
│  - HTTP API for git operations   │
└──────────────────────────────────┘
         ↑         ↓
      git pull   git push
         │         │
    ┌────┴─────────┴────┐
    │                   │
Peer (Client)      Peer (Client)
- Signs commits    - Verifies commits
- Local repo       - Syncs with bootstrap
```

### Git Repository Structure

```
repo/
├─ .git/
│  ├─ objects/              (blob, tree, commit, tag)
│  ├─ refs/
│  │  ├─ heads/             (local branches)
│  │  └─ remotes/
│  │     └─ bootstrap/      (bootstrap peer branches)
│  ├─ HEAD                  (current branch)
│  └─ config
│
├─ .flashback/              (NEW: Flashback-specific)
│  ├─ signatures.json       (Commit signatures)
│  ├─ verified_commits.log  (Verified chain)
│  └─ bootstrap_peers.json  (Known bootstrap nodes)
│
└─ (files)
```

### Data Flow

```
1. Client modifies files
   └─ git add file.txt

2. Client creates commit (local)
   └─ git commit -m "message"
   └─ Creates commit hash (SHA-256 of content)

3. Client signs commit
   └─ Sign commit hash with private key (X.509)
   └─ Store signature in .flashback/signatures.json

4. Client pushes to bootstrap peer
   └─ POST /git/push
   └─ Body: {commit_hash, commit_data, signature}

5. Bootstrap verifies and stores
   └─ Verify signature with client's certificate
   └─ Verify commit chain integrity
   └─ Store commit
   └─ Broadcast announcement to peer network

6. Other clients fetch from bootstrap
   └─ GET /git/fetch?commit_hash=...
   └─ Download commit + signature
   └─ Verify signature locally
   └─ Merge into local repository
```

---

## Git Operations

### Operation 1: Git Init (Create Repository)

**Flow:**
```
Client A decides to host "movies" repository

1. gen-repo movies
   ├─ Create local .git directory
   ├─ Initialize git repository
   ├─ Create initial commit (empty repo)
   └─ Sign initial commit

2. Register repository as bootstrap
   └─ POST /api/repos/register
   └─ Body: { name: "movies", description: "...", owner: "alice" }
   └─ Returns: repository_id

3. Repository is discoverable
   └─ Other clients can query for "movies"
   └─ Gossip protocol announces repository
```

### Operation 2: Git Pull (Download Latest)

**Flow:**
```
Client B wants to sync "movies" repository

1. Discover bootstrap peers hosting "movies"
   └─ Gossip query: "Who has movies repo?"
   └─ Response: [bootstrap_nodeA, bootstrap_nodeB]

2. Fetch refs from bootstrap
   └─ GET /git/refs
   └─ Response: { master: hash_xyz, develop: hash_abc }

3. Identify missing commits
   └─ Compare local refs with remote refs
   └─ Determine which commits to download

4. Fetch missing commits
   └─ GET /git/fetch?commit_hash=hash_1
   └─ GET /git/fetch?commit_hash=hash_2
   └─ ... (multiple requests)

5. Verify each commit
   └─ Check signature with author's certificate
   └─ Verify commit chain (parent references)
   └─ Merge into local repository

6. Merge branches
   └─ If multiple bootstrap nodes have different changes
   └─ Implement merge algorithm (3-way merge, rebase, etc.)
```

### Operation 3: Git Push (Upload Changes)

**Flow:**
```
Client C creates changes and pushes to "movies" repository

1. Create and sign local commits
   └─ Make changes to files
   └─ git commit
   └─ Sign commit with private key
   └─ Store signature in .flashback/signatures.json

2. Push to bootstrap peer
   └─ POST /git/push
   └─ Body: {
        repository: "movies",
        commits: [
          {
            hash: "commit_hash_1",
            parent: "commit_hash_parent",
            data: {...},
            author: "charlie@example.com",
            timestamp: 1698787200,
            signature: "...",  // X.509 signature
            certificate: "..."  // Author's CA cert
          }
        ],
        branch: "master"
      }

3. Bootstrap verifies push
   └─ Verify each commit's signature
   └─ Verify author's certificate with relay CA
   └─ Verify commit chain (no gaps)
   └─ Verify no conflicting commits (or merge)
   └─ Store commits in repository

4. Bootstrap announces update
   └─ Broadcast via gossip:
      "Repository movies has new commit hash_xyz"
   └─ Other bootstrap peers can sync

5. Return to client
   └─ Response: { status: "accepted", new_refs: {...} }
```

### Operation 4: Git Fetch (Just Get Objects)

**Flow:**
```
Client D wants to import specific commit

1. Request commit object
   └─ GET /git/fetch?commit_hash=hash_xyz
   └─ Response: {
        commit: {...},
        signature: "...",
        author_certificate: "..."
      }

2. Verify commit
   └─ Parse certificate (must be from relay CA)
   └─ Check signature with public key
   └─ Verify commit hash matches data

3. Import locally (without merging)
   └─ Store commit in local .git/objects
   └─ Don't update refs yet
   └─ Ready for later merge/rebase
```

### Operation 5: Git Clone (Full Repository)

**Flow:**
```
Client E clones "movies" repository for first time

1. Discover bootstrap peers
   └─ Query gossip for "movies"
   └─ Get list of bootstrap nodes

2. Request refs
   └─ GET /git/refs
   └─ Response: master, develop, release branches

3. Fetch all commits
   └─ For each ref:
      └─ Recursively fetch commit and parents
      └─ Verify signature on each
      └─ Build complete history

4. Create local copy
   └─ Initialize local .git
   └─ Import all commits
   └─ Set up branches
   └─ Checkout master
```

---

## Commit Signing Model

### X.509 Commit Signature

**What We Sign:**
```
commit_data = {
  tree: tree_hash,
  parent: parent_hash,
  author: "alice@example.com",
  author_timestamp: 1698787200,
  message: "Add movie description",
  repository: "movies"
}

canonical_form = json.dumps(commit_data, sort_keys=True)
commit_hash = sha256(canonical_form)
```

**How We Sign:**
```
// Using client's private key (never sent to server)
signature = sign_with_private_key(
  commit_hash,
  algorithm="RSA-SHA256"  // or Ed25519-SHA256
)

// signature can be verified with client's public cert
// which is available from relay CA
```

**Signature Format:**
```json
{
  "commit_hash": "abc123...",
  "signature": "base64(rsa_signature)",
  "signature_algorithm": "RSA-SHA256",
  "signing_key_id": "key_fingerprint",
  "timestamp": 1698787200,
  "author_certificate": "-----BEGIN CERTIFICATE-----\n..."
}
```

### Blockchain-Style Verification Chain

```
Genesis Commit (repo creation)
  └─ signature: signed by alice@example.com
  └─ timestamp: T0

Commit 1 (first change)
  └─ parent: Genesis Commit hash
  └─ signature: signed by alice@example.com
  └─ timestamp: T1
  └─ Verification:
     ├─ Check parent exists and is valid
     ├─ Verify signature with alice's certificate
     └─ Genesis valid? Yes → Commit 1 valid

Commit 2 (second change)
  └─ parent: Commit 1 hash
  └─ signature: signed by bob@example.com
  └─ timestamp: T2
  └─ Verification:
     ├─ Check parent exists and is valid
     ├─ Verify parent's signature (Commit 1)
     ├─ Verify this commit's signature
     └─ Commit 1 valid & this commit valid? Yes → Chain valid

... (chain continues)
```

**Verification Algorithm:**
```typescript
function verifyCommitChain(commitHash: string): boolean {
  const commit = getCommit(commitHash);
  
  // 1. Verify this commit's signature
  const cert = relay.getCertificate(commit.author);
  if (!verifySignature(commit.hash, commit.signature, cert)) {
    return false;  // Invalid signature
  }
  
  // 2. If root commit, we're done
  if (!commit.parent) {
    return true;  // Root commit valid
  }
  
  // 3. Recursively verify parent commit
  return verifyCommitChain(commit.parent);
}
```

---

## Repository Synchronization

### Scenario: Multiple Bootstrap Nodes

```
Bootstrap Node A (alice)          Bootstrap Node B (bob)
  ├─ "movies" repo                 ├─ "movies" repo
  ├─ Commits: 1, 2, 3             ├─ Commits: 1, 2, 3, 4, 5
  ├─ master: commit_3             ├─ master: commit_5
  └─ Last updated: T1             └─ Last updated: T2

Gossip announces:
  "Bob's movies has commit_4, commit_5 (master)"

Alice syncs:
  ├─ Fetch commit_4 from Bob
  ├─ Fetch commit_5 from Bob
  ├─ Verify both commits (signatures, chain)
  ├─ Update local master to commit_5
  └─ Now in sync with Bob
```

### Scenario: Conflicting Changes

```
Bootstrap Node A (alice)          Bootstrap Node B (bob)
  ├─ commit_1                     ├─ commit_1
  ├─ commit_2a (update title)     ├─ commit_2b (delete movie)
  └─ master: commit_2a            └─ master: commit_2b

Client C tries to pull:
  ├─ Sees commit_2a from Alice
  ├─ Sees commit_2b from Bob
  ├─ Both signed correctly
  ├─ But commit_2a and commit_2b have different parent
  └─ CONFLICT: Two valid histories

Resolution:
  Option 1: User chooses (interactive merge)
  Option 2: Automatic 3-way merge
  Option 3: Explicit merge commit (signed by user)

Client C creates merge commit:
  ├─ merge_commit = {
       parents: [commit_2a, commit_2b],
       author: charlie@example.com,
       message: "Merge alice and bob changes"
     }
  ├─ Sign with private key
  └─ Push merge_commit to both bootstraps
```

### Conflict Resolution Strategy

**Default: Last-Write-Wins**
```
If two commits conflict:
  - Accept the commit with later timestamp
  - Log conflict for user review
  - Notify user of overwrite
```

**Advanced: 3-Way Merge**
```
If two commits conflict:
  - Find common ancestor
  - Try to merge automatically
  - If successful: create merge commit
  - If not: mark as conflicted, ask user
```

---

## Bootstrap Node Endpoints

### Repository Management

#### GET /git/repos
**List all repositories**

```http
GET /git/repos HTTP/1.1

Response:
[
  {
    "name": "movies",
    "description": "Movie collection",
    "owner": "alice@example.com",
    "size_bytes": 1048576,
    "refs": {
      "master": "abc123...",
      "develop": "def456..."
    },
    "created_at": "2025-10-31T12:00:00Z",
    "last_updated_at": "2025-10-31T12:05:00Z",
    "peer_count": 3
  }
]
```

#### POST /git/repos
**Create new repository**

```http
POST /git/repos HTTP/1.1
Content-Type: application/json
Authorization: X-Certificate: <cert>

{
  "name": "movies",
  "description": "Movie collection",
  "default_branch": "master"
}

Response:
{
  "repository_id": "repo_movies",
  "status": "created",
  "refs": {}
}
```

### Commit Operations

#### GET /git/refs
**List references (branches)**

```http
GET /git/repos/movies/refs HTTP/1.1

Response:
{
  "master": "abc123def456...",
  "develop": "xyz789...",
  "release/1.0": "qwe123..."
}
```

#### POST /git/push
**Push commits**

```http
POST /git/repos/movies/push HTTP/1.1
Content-Type: application/json
Authorization: X-Certificate: <cert>

{
  "commits": [
    {
      "hash": "abc123...",
      "parent": "def456...",
      "tree": "ghi789...",
      "author": "alice@example.com",
      "timestamp": 1698787200,
      "message": "Add description",
      "signature": "base64(...)",
      "certificate": "-----BEGIN CERTIFICATE-----\n..."
    }
  ],
  "branch": "master",
  "force": false
}

Response:
{
  "status": "accepted",
  "new_head": "abc123...",
  "message": "1 commit pushed"
}
```

#### GET /git/fetch
**Fetch commit**

```http
GET /git/repos/movies/fetch?commit_hash=abc123 HTTP/1.1

Response:
{
  "hash": "abc123...",
  "parent": "def456...",
  "tree": "ghi789...",
  "author": "alice@example.com",
  "timestamp": 1698787200,
  "message": "Add description",
  "signature": "base64(...)",
  "certificate": "-----BEGIN CERTIFICATE-----\n..."
}
```

#### GET /git/objects/<hash>
**Download git object (blob, tree, etc.)**

```http
GET /git/repos/movies/objects/blob_abc123 HTTP/1.1

Response: (binary git object)
```

### Verification

#### GET /git/verify
**Verify commit chain**

```http
GET /git/repos/movies/verify?head=abc123 HTTP/1.1

Response:
{
  "head": "abc123...",
  "is_valid": true,
  "depth": 42,
  "signatures_verified": 42,
  "unsigned_commits": 0,
  "verification_time_ms": 245
}
```

---

## Message Formats

### Commit Object

```typescript
interface Commit {
  // Identity
  hash: string;                    // SHA-256 of content
  
  // Tree & Parents
  tree: string;                    // Tree hash
  parent?: string;                 // Parent commit hash (null for root)
  merge_parents?: string[];        // For merge commits
  
  // Author Info
  author: string;                  // "alice@example.com"
  timestamp: number;               // Unix timestamp
  
  // Content
  message: string;                 // Commit message
  metadata?: {
    repository: string;
    tags?: string[];
  };
  
  // Signature
  signature: string;               // Base64(RSA signature)
  signature_algorithm: string;     // "RSA-SHA256" | "Ed25519"
  author_certificate: string;      // X.509 certificate PEM
  
  // Metadata
  created_at: Date;
  verified_at?: Date;
}
```

### Tree Object

```typescript
interface TreeEntry {
  name: string;
  mode: string;                    // "100644", "100755", "040000"
  hash: string;                    // Object hash
  size?: number;                   // File size (if blob)
}

interface Tree {
  hash: string;
  entries: TreeEntry[];
  created_at: Date;
}
```

### Blob Object

```typescript
interface Blob {
  hash: string;
  size: number;
  content: Buffer;  // Raw file content
  created_at: Date;
}
```

---

## Security Model

### Threat: Forged Commits

**Attack:**
```
Attacker signs fake commit claiming to be from "alice@example.com"
```

**Defense:**
```
1. Verify signature with alice's certificate (from relay CA)
2. If signature doesn't match, commit is invalid
3. Relay CA only issues one cert per email
4. Therefore, only alice can create valid commits for alice@example.com
```

### Threat: Historical Rewrite

**Attack:**
```
Attacker rewrites commit history (changes parent references)
```

**Defense:**
```
1. Verification chain checks all parents are valid
2. If any parent is modified, signature becomes invalid
3. Can't forge signature without access to alice's private key
4. Therefore, history is immutable
```

### Threat: Key Compromise

**Attack:**
```
Attacker obtains alice's private key
```

**Defense:**
```
1. Attacker can now sign commits as alice
2. But: Alice can revoke her certificate via relay CA
3. Once revoked, all alice's signatures (even old ones) are invalid
4. Alice registers with new certificate
5. New commits must be signed with new key
```

### Threat: Man-in-the-Middle

**Attack:**
```
Attacker intercepts git fetch/push
```

**Defense:**
```
1. All endpoints use HTTPS (TLS)
2. Bootstrap node authenticates with certificate from relay CA
3. Commits must be signed (can't forge without key)
4. Verify signature before accepting
```

---

## Scalability & Performance

### Network Traffic

**Per Commit:**
- Commit object: ~500 bytes
- Signature: ~256 bytes (Ed25519) or ~512 bytes (RSA)
- Certificate: ~1-3 KB
- Total: ~2 KB per commit

**Repository Growth:**
- 1000 commits: ~2 MB
- 10,000 commits: ~20 MB
- 100,000 commits: ~200 MB

### Optimization: Delta Compression

```
Instead of sending full commit:
- Send commit + parent hash
- Bootstrap client fetches parent
- Store diff only

Saves bandwidth for large changes
```

### Optimization: Selective Sync

```
Client doesn't need full history:
- Only sync commits from last week
- Shallow clone (last N commits)
- Specify branch to sync

Reduces initial download size
```

---

## Implementation Phases

### Phase 1: Bootstrap Git Endpoints (Weeks 1-2)

**Bootstrap Node:**
- [ ] Implement `/git/repos` list endpoint
- [ ] Implement `/git/repos/create` endpoint
- [ ] Implement `/git/refs` endpoint
- [ ] Basic git object storage (in filesystem)
- [ ] In-memory index of commits

### Phase 2: Commit Signing (Weeks 2-3)

**Client:**
- [ ] Implement X.509 commit signing
- [ ] Store signatures locally
- [ ] Verify signatures before accepting

**Bootstrap:**
- [ ] Verify commit signatures on push
- [ ] Verify certificate from relay CA
- [ ] Reject invalid signatures

### Phase 3: Sync Operations (Weeks 3-4)

**Bootstrap:**
- [ ] Implement `/git/push` endpoint
- [ ] Implement `/git/fetch` endpoint
- [ ] Implement `/git/verify` endpoint
- [ ] Conflict detection

**Client:**
- [ ] Git pull (fetch + merge)
- [ ] Git push (sign + upload)
- [ ] Handle merge conflicts

### Phase 4: Multi-Node Sync (Weeks 4-5)

**Gossip Integration:**
- [ ] Announce repository updates
- [ ] Sync between bootstrap nodes
- [ ] Resolve conflicts between nodes

### Phase 5: Performance & Testing (Weeks 5-6)

- [ ] Delta compression
- [ ] Shallow cloning
- [ ] Load testing
- [ ] Conflict resolution tests

---

## Conclusion

This decentralized git protocol enables:
- **Peer-hosted repositories** without central authority
- **Verifiable commit history** with X.509 signatures
- **Decentralized synchronization** between bootstrap nodes
- **Conflict resolution** for divergent histories
- **Blockchain-style verification** with signature chains

By combining git's proven model with X.509 signing and decentralized bootstrap nodes, Flashback provides secure, verifiable, peer-owned repositories.
