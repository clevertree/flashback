# Repository Data Model: Fabric Storage Schema

**Status:** Design Phase  
**Date:** October 31, 2025  
**Version:** 1.0  
**Type:** Data Model Specification

---

## Table of Contents

1. [Overview](#overview)
2. [Key-Value Store Design](#key-value-store-design)
3. [Data Structures](#data-structures)
4. [Ledger Keys](#ledger-keys)
5. [Queries & Indexing](#queries--indexing)
6. [Storage Constraints](#storage-constraints)
7. [Migration Strategy](#migration-strategy)
8. [Example Workflows](#example-workflows)

---

## Overview

### Data Storage Philosophy

**Blockchain Storage (Text & Links Only):**
- Repository entries (movies, shows, documentaries)
- Comments and reviews
- Torrent hashes (links to files)
- User information (in optional global users channel)
- Transaction history

**NOT in Blockchain (via WebTorrent):**
- Media files (binary)
- Large documents
- File access requests (P2P only)
- User IP addresses

### Storage Architecture

**Each Hyperledger Fabric channel = one repository**

```
User Device (Tauri Client)
├─ Local Cache (LevelDB)
│  ├─ Full copy of ledger state for each channel
│  ├─ Used when offline
│  └─ Synced with blockchain
│
├─ WebTorrent
│  ├─ Downloaded files
│  ├─ Seeding media
│  └─ DHT discovery
│
└─ Private Data (NOT on chain)
   ├─ User private key
   ├─ Access requests
   └─ Download history

Hyperledger Fabric Network
├─ Channel: movies (Repository 1)
│  ├─ World State (LevelDB on each peer)
│  │  ├─ entry:movie-001           ← No repo prefix (channel IS repo)
│  │  ├─ comment:movie-001:review-123
│  │  └─ torrent:movie-001:hash-abc
│  │
│  └─ Block Store (immutable history)
│     └─ All transactions for movies only
│
├─ Channel: tv-shows (Repository 2)
│  ├─ World State (LevelDB on each peer)
│  │  ├─ entry:show-001
│  │  ├─ comment:show-001:review-456
│  │  └─ torrent:show-001:hash-def
│  │
│  └─ Block Store
│     └─ All transactions for tv-shows only
│
└─ Channel: users (Optional - Global)
   ├─ World State
   │  ├─ user:alice@example.com
   │  └─ user:bob@example.com
   │
   └─ Block Store (user updates only)
```

**Key Benefit:** Channels provide physical isolation. Each repo has its own ledger, orderer, and state.

---

## Key-Value Store Design

### LevelDB Key Naming Convention

**Format:** `<type>:<identifier>:<sub-identifier>`

**Important:** The channel/repository is implicit (it's which Fabric channel you're on).

**Examples:**

```
// On movies channel:
entry:movie-001              → Movie entry
entry:movie-002              → Another movie
comment:movie-001:review-789 → Comment on movie
torrent:movie-001:primary    → Torrent metadata

// On tv-shows channel:
entry:show-001               → TV show entry
entry:show-002               → Another show
comment:show-001:review-456  → Comment on show
torrent:show-001:primary     → Torrent metadata

// On users channel (optional global):
user:alice@example.com       → User profile
user:bob@example.com         → Another user

// Metadata (per channel):
metadata:stats               → Repository statistics
metadata:last-updated        → Last update timestamp
```

### Key Design Principles

1. **No Repo Prefix:** Channel name IS the repository. No duplication.
2. **Flat Structure:** LevelDB is key-value, use simple hierarchy
3. **Queryable:** Keys allow range queries (all entries, all comments, etc.)
4. **Namespace Isolation:** Different channels don't interfere
5. **Metadata Tracking:** Separate metadata keys for statistics
6. **Immutable:** Once written, can't change (only add new versions)

---

## Data Structures

### 1. Entry Schema

**Location:** `entry:<entryId>` (on the appropriate channel/repository)

```javascript
{
  // Identifiers
  id: "movie-001",                              // Unique within repo/channel
  // NOTE: repo/channel is implicit (determined by which channel code runs on)
  
  // Content
  title: "Inception",                           // Required
  description: "A mind-bending thriller...",    // Required
  year: 2010,                                   // Optional (year or date)
  duration: 148,                                // Optional (minutes for media)
  
  // Media Links (ONLY hashes, not file data)
  torrentHash: "abc123def456789...",            // WebTorrent hash
  fileSize: 2147483648,                         // Bytes (2GB)
  fileType: "video/mp4",                        // MIME type
  
  // Metadata
  genres: ["sci-fi", "thriller"],               // Array of strings
  tags: ["classic", "2010s"],                   // User-defined tags
  metadata: {                                   // Extensible object
    imdbId: "tt1375666",
    director: "Christopher Nolan",
    cast: ["Leonardo DiCaprio", "Ellen Page"],
    country: "USA",
    language: "English"
  },
  
  // Tracking
  addedBy: "alice@example.com",                 // Creator (from cert)
  addedAt: "2025-10-31T10:00:00Z",             // ISO 8601 timestamp
  updatedAt: "2025-10-31T10:00:00Z",           // Last update
  version: 1,                                   // Version number
  
  // Statistics
  rating: 8.8,                                  // Average rating (computed)
  comments: 42,                                 // Comment count (cached)
  downloads: 1234,                              // Download count (from DHT)
  
  // Status
  status: "active",                             // "active", "archived", "deleted"
  visibility: "public"                          // "public", "private", "friends"
}
```

**Size:** ~1-2 KB per entry (text only)

### 2. Comment Schema

**Location:** `comment:<entryId>:<commentId>` (on the same channel as the entry)

```javascript
{
  // Identifiers
  id: "review-789",                             // Unique within entry
  entryId: "movie-001",                         // Parent entry
  // NOTE: repo/channel is implicit (same as entry)
  
  // Content
  content: "Great movie! Loved the plot.",      // Comment text
  type: "review",                               // "review", "rating", "annotation"
  rating: 5,                                    // 1-5 stars (optional)
  
  // Tracking
  commentedBy: "bob@example.com",               // Commenter (from cert)
  commentedAt: "2025-10-31T11:00:00Z",         // Timestamp
  updatedAt: "2025-10-31T11:00:00Z",           // Edit timestamp
  
  // Status
  status: "active",                             // "active", "flagged", "deleted"
  likes: 23                                     // Like count (cached)
}
```

**Size:** ~500 bytes per comment

### 3. Torrent Metadata

**Location:** `torrent:<entryId>:<variant>` (on the same channel as the entry)

```javascript
{
  // Identifiers
  entryId: "movie-001",
  // NOTE: repo/channel is implicit
  variant: "primary",                           // "primary", "mirror", "sd"
  
  // Torrent Data
  hash: "abc123def456789...",                   // WebTorrent hash (infohash)
  name: "Inception (2010).mp4",                 // File name
  size: 2147483648,                             // Total size (bytes)
  pieces: 1024,                                 // Number of pieces
  pieceLength: 2097152,                         // Bytes per piece (2MB)
  
  // Quality Metadata
  bitrate: 8000,                                // kbps
  resolution: "1920x1080",                      // For video
  frameRate: 23.976,                            // fps
  codec: "h264",                                // Video codec
  
  // Seeding Info
  seeders: 12,                                  // Current seeders
  leechers: 45,                                 // Current leechers
  completedCount: 234,                          // Historical seeds
  
  // Tracking
  createdAt: "2025-10-31T10:00:00Z",           // When added
  createdBy: "alice@example.com",               // Creator
  
  // Status
  status: "active",                             // "active", "deprecated", "deleted"
  magnet: "magnet:?xt=urn:btih:..."            // Magnet link (optional)
}
```

**Size:** ~500 bytes per torrent metadata

### 4. User Profile

**Location:** `user:<email>`

```javascript
{
  email: "alice@example.com",                   // Unique identifier
  
  // Identity
  publicKey: "-----BEGIN PUBLIC KEY-----...",   // X.509 public key
  certificateThumbprint: "abc123...",           // For quick lookup
  
  // Profile
  displayName: "Alice",                         // Optional display name
  avatar: "ipfs://QmXxxx",                      // Optional avatar URL (IPFS/torrent)
  bio: "Movie enthusiast",                      // Bio (short)
  
  // Capabilities (from certificate)
  capabilities: ["add-entry", "comment"],       // What user can do
  repositories: ["movies", "tv-shows"],         // Which repos
  
  // Statistics
  entriesAdded: 45,                             // Count
  commentsAdded: 123,                           // Count
  reputation: 8.5,                              // 1-10 score
  joinedAt: "2025-01-01T00:00:00Z",            // Account age
  
  // Status
  status: "active",                             // "active", "suspended", "deleted"
  verified: true                                // Email verified
}
```

**Size:** ~1 KB per user

### 5. Repository Statistics (Metadata)

**Location:** `metadata:<repo>:<key>`

```javascript
// metadata:movies:stats
{
  repo: "movies",
  
  statistics: {
    totalEntries: 1234,                         // All entries
    activeEntries: 1200,                        // Non-deleted
    totalComments: 45678,                       // All comments
    totalUsers: 567,                            // Unique users
    lastEntryId: 1234,                          // For ID generation
  },
  
  timing: {
    lastUpdated: "2025-10-31T23:59:59Z",       // Latest entry added
    createdAt: "2025-01-01T00:00:00Z",         // Repo creation
  },
  
  stats: {
    averageEntrySize: 1247,                     // Bytes
    averageCommentSize: 523,                    // Bytes
    totalStorageSize: 1564321,                  // Bytes (ledger only)
  }
}
```

**Size:** ~500 bytes per repo

---

## Ledger Keys

### Complete Key Listing

| Category | Key Pattern | Example | Purpose |
|----------|-------------|---------|---------|
| **Entries** | `entry:<entryId>` | `entry:movie-001` | Store media entry |
| **Comments** | `comment:<entryId>:<commentId>` | `comment:movie-001:rev-789` | Store comment/review |
| **Torrents** | `torrent:<entryId>:<variant>` | `torrent:movie-001:primary` | Store torrent metadata |
| **Users** | `user:<email>` | `user:alice@example.com` | Store user profile (users channel) |
| **Metadata** | `metadata:<key>` | `metadata:stats` | Repository statistics |

**Note:** Repo/channel is implicit (determined by which Fabric channel code runs on)

### Key Ranges for Queries

**Fabric range queries:**

```javascript
// Get all entries in this repo/channel
startKey: "entry:",
endKey:   "entry:zzz"
// Returns: all entries in current channel

// Get all comments for movie-001
startKey: "comment:movie-001:",
endKey:   "comment:movie-001:zzz"
// Returns: all comments on that entry

// Get all torrents for movie-001
startKey: "torrent:movie-001:",
endKey:   "torrent:movie-001:zzz"
// Returns: all torrent variants
```

---

## Queries & Indexing

### 1. Common Queries

**Query: Get all movies from 2010**

```javascript
// Chaincode (JavaScript)
async searchEntries(ctx, query) {
  // Query all entries in THIS channel (no repo parameter!)
  const iterator = await ctx.stub.getStateByRange("entry:", "entry:zzz");
  
  const results = [];
  while (true) {
    const result = await iterator.next();
    if (result.done) break;
    
    const entry = JSON.parse(result.value.value.toString());
    
    // Filter by query (year == 2010)
    if (this.matchesQuery(entry, query)) {
      results.push(entry);
    }
  }
  
  return results;
}

matchesQuery(entry, query) {
  if (query.year && entry.year !== query.year) return false;
  if (query.genre && !entry.genres.includes(query.genre)) return false;
  if (query.title && !entry.title.includes(query.title)) return false;
  return true;
}
```

**Query: Get all comments for movie-001**

```javascript
async getComments(ctx, entryId) {
  const iterator = await ctx.stub.getStateByRange(
    `comment:${entryId}:`,
    `comment:${entryId}:zzz`
  );
  
  const comments = [];
  while (true) {
    const result = await iterator.next();
    if (result.done) break;
    comments.push(JSON.parse(result.value.value.toString()));
  }
  
  return comments.sort((a, b) => 
    new Date(b.commentedAt) - new Date(a.commentedAt)
  );
}
```

### 2. Indexing Strategy

**Primary Index (by key):** Built-in (LevelDB)

**Secondary Indexes (optional custom):**

```
Metadata keys for fast lookup:

index:year:2010
  └─ Values: [movie-001, movie-234, movie-567]
  └─ Quickly find all entries from 2010

index:genre:sci-fi
  └─ Values: [movie-001, movie-045, movie-089]
  └─ Quickly find all sci-fi entries

index:entryId:movie-001
  └─ Values: [review-789, rating-234]
  └─ Quickly find comments for entry
```

**Note:** LevelDB is fast enough for most queries without secondary indexes. Add only if performance testing shows need.

---

## Storage Constraints

### Blockchain Limits

**Per Transaction:**
- Max payload: 10 MB (configurable)
- Max entries per transaction: 1 (each entry = 1 tx)
- Max comments per transaction: 1 (each comment = 1 tx)

**Per Channel:**
- Max entries: Unlimited (but grows ledger)
- Max block size: Configurable
- Estimated: 1000 entries ≈ 2-3 MB ledger

**Per Peer:**
- Disk space: Ledger + world state
- Estimated: 10,000 entries ≈ 20-30 MB

### Design Implications

**1. Don't Store Binary Data:**
```javascript
// ❌ WRONG (11 MB entry)
{
  title: "Movie",
  movieData: <binary 10 MB file>  // NO!
}

// ✅ CORRECT (1 KB entry)
{
  title: "Movie",
  torrentHash: "abc123...",  // Link only!
  fileSize: 10485760
}
```

**2. Batch Comments Wisely:**
```javascript
// ❌ BAD (1000 separate transactions)
for (comment of comments) {
  await addComment(comment);
}

// ✅ GOOD (limit to reasonable batch)
if (comments.length > 100) {
  // Split into batches
  const batches = chunks(comments, 50);
  for (const batch of batches) {
    await Promise.all(batch.map(c => addComment(c)));
  }
}
```

**3. Prune Old Data:**
```javascript
// Periodically remove deleted entries
async pruneDeleted(ctx, repo) {
  const iterator = await ctx.stub.getStateByRange(
    `entry:${repo}:`,
    `entry:${repo}:zzz`
  );
  
  for (const entry of iterator) {
    if (entry.status === "deleted" && 
        Date.now() - Date.parse(entry.deletedAt) > 30 * 24 * 60 * 60 * 1000) {
      // Delete after 30 days
      await ctx.stub.deleteState(entry.key);
    }
  }
}
```

---

## Migration Strategy

### From Git to Fabric

**If migrating existing git repositories:**

```
1. Export git data
   └─ Parse commits, blobs, refs
   └─ Extract entries, dates, authors

2. Transform to Fabric format
   └─ Convert git commit → entry
   └─ Convert commit message → torrent hash
   └─ Preserve timestamps and authors

3. Import to Fabric
   └─ Submit as chaincode transactions
   └─ Maintain immutability
   └─ Preserve git history

4. Verify migration
   └─ Compare entry counts
   └─ Verify timestamps
   └─ Check author information
```

**Example Migration Function:**

```javascript
async migrateFromGit(ctx, gitExport) {
  for (const gitCommit of gitExport.commits) {
    const entry = {
      id: gitCommit.sha.substring(0, 8),
      title: gitCommit.message.split('\n')[0],
      description: gitCommit.message,
      addedBy: gitCommit.author.email,
      addedAt: gitCommit.date,
      torrentHash: gitCommit.blobHash,
      fileSize: gitCommit.blobSize,
      // ... other fields
    };
    
    await this.addEntry(ctx, repo, entry);
  }
}
```

---

## Example Workflows

### Workflow 1: Adding a Movie

```
User Action: Add "Inception" movie to movies channel

Step 1: Create torrent
  ├─ User creates torrent of Inception.mp4 (2GB)
  └─ Torrent hash: abc123def456...

Step 2: Create entry
  {
    id: "movie-001",
    title: "Inception",
    year: 2010,
    torrentHash: "abc123def456...",
    fileSize: 2147483648,
    genres: ["sci-fi", "thriller"]
  }

Step 3: Submit chaincode transaction
  fabric.invoke({
    channel: "movies",              ← Channel IS the repo!
    chaincode: "repo-manager",
    function: "addEntry",
    args: [entry]                   ← No repo parameter!
  })
  ├─ Signed with Alice's certificate (with add-entry capability)
  └─ Endorsed by 2 peers on movies channel

Step 4: Blockchain consensus
  ├─ Transaction ordered
  ├─ Block created (only on movies channel)
  └─ All peers commit to movies ledger

Step 5: File distribution
  ├─ Alice seeds via WebTorrent
  ├─ Entry appears in movies blockchain
  ├─ Other peers see torrent hash
  └─ Other peers can download

Result: Movie is in movies blockchain and available to download
```

### Workflow 2: Commenting on Entry

```
User Action: Add review of "Inception" on movies channel

Step 1: Create comment
  {
    id: "review-789",
    entryId: "movie-001",
    content: "Great movie!",
    rating: 5,
    type: "review"
  }

Step 2: Submit chaincode transaction
  fabric.invoke({
    channel: "movies",              ← Same channel as entry
    chaincode: "repo-manager",
    function: "addComment",
    args: ["movie-001", comment]    ← Just entry ID + comment
  })
  ├─ Signed with Bob's certificate (with comment capability)
  └─ Endorsed by 2 peers on movies channel

Step 3: Blockchain consensus (on movies channel)
  ├─ Transaction ordered
  ├─ Block created (only on movies channel)
  └─ All peers commit to movies ledger

Step 4: Update statistics
  ├─ Entry's comment count incremented
  ├─ Entry's rating recalculated
  └─ Metadata updated

Result: Comment visible to all peers on movies channel
```

### Workflow 3: Searching for Movies

```
User Action: Search for sci-fi movies from 2010 on movies channel

Step 1: Query local cache (if offline)
  └─ User has local LevelDB copy of movies channel
  └─ Query instantly, no network

Step 2: Query blockchain (if online)
  fabric.query({
    channel: "movies",
    chaincode: "repo-manager",
    function: "searchEntries",
    args: [{genre: "sci-fi", year: 2010}]
  })
  ├─ Query executed on movies channel peer
  ├─ Iterates through entries (no repo filtering needed!)
  └─ Returns matching movies

Result: [Inception, Avatar, Others...]

Step 3: Download movie
  └─ User gets torrent hash from blockchain
  └─ User finds seeders via WebTorrent DHT
  └─ User downloads movie

Result: Movie is downloaded and user can watch
```

---

## Summary

This data model provides:

- ✅ **Efficient Storage:** Text only (~1 KB per entry), no redundancy
- ✅ **Immutable Ledger:** All changes tracked forever
- ✅ **Queryable:** Range queries and indexes
- ✅ **Scalable:** Grows slowly (entries, not file data)
- ✅ **Consistent:** Blockchain consensus ensures all peers agree
- ✅ **Privacy:** Metadata is public, access requests are private
- ✅ **Decentralized:** Each peer has full copy of ledger

Ready for Phase 2 implementation (Chaincode Development).
