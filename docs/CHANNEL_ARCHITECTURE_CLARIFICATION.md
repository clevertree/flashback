# Architecture Clarification: Channels vs. Key-Value Namespacing

**Status:** Design Decision  
**Date:** October 31, 2025  
**Version:** 1.0  
**Type:** Architecture Clarification

---

## The Question

**Current proposal:** One channel per repository (movies, tv-shows, etc.)  
**Your suggestion:** Use Fabric channels as the repository boundary itself

**Are these the same thing?** YES, essentially!

---

## Channel-Based Architecture (Recommended)

### What This Means

```
Fabric Network:
├─ Channel: movies
│  └─ World State (LevelDB)
│     ├─ entry:movie-001         ← "movies" is implicit (it's the channel)
│     ├─ entry:movie-002
│     ├─ comment:movie-001:review-123
│     └─ torrent:movie-001:hash-abc
│
├─ Channel: tv-shows
│  └─ World State (LevelDB)
│     ├─ entry:show-001          ← "tv-shows" is implicit (it's the channel)
│     ├─ entry:show-002
│     ├─ comment:show-001:review-456
│     └─ torrent:show-001:hash-def
│
└─ Channel: documentaries
   └─ World State (LevelDB)
      ├─ entry:doc-001           ← "documentaries" is implicit
      ├─ entry:doc-002
      └─ ...
```

### Simplified Keys (No Repo Prefix)

**Before (with repo in key):**
```
entry:movies:movie-001          ← "movies" is redundant
entry:tv-shows:show-001
```

**After (channel is repo):**
```
entry:movie-001                 ← Cleaner! Repo is implicit
entry:show-001
```

**Comments:**
```
Before: comment:movies:movie-001:review-123
After:  comment:movie-001:review-123
                    ↑
          (only need entry ID + comment ID in the channel)
```

### Why This Is Better

| Aspect | With Repo in Key | With Channels |
|--------|------------------|----------------|
| **Data Isolation** | Logical (same ledger) | Physical (separate ledger) |
| **Key Simplicity** | `entry:repo:id` (3 parts) | `entry:id` (2 parts) |
| **Query Performance** | Query all entries, filter by repo | Channel boundary = repo boundary |
| **Permissions** | At chaincode level | At channel level |
| **Storage** | Single ledger for all repos | Separate ledger per repo |
| **Scalability** | All repos compete for block space | Repos don't interfere with each other |
| **Privacy** | Harder to implement | Easy (channel privacy) |

---

## Detailed Comparison

### Architecture 1: All Repos in One Channel (What I Proposed)

```
Channel: main (contains all repos)
├─ World State
│  ├─ entry:movies:movie-001
│  ├─ entry:movies:movie-002
│  ├─ entry:tv-shows:show-001
│  ├─ entry:tv-shows:show-002
│  ├─ comment:movies:movie-001:review-123
│  ├─ comment:tv-shows:show-001:review-456
│  └─ ... (all repos mixed)
│
└─ Chaincode
   └─ repo-manager (handles all repos)
```

**Pros:**
- Single ordering service handles all transactions
- Simpler network setup
- Transactions from any repo can be batched together

**Cons:**
- ❌ One slow repo slows down all repos
- ❌ Repo A's traffic blocks repo B
- ❌ All repos compete for orderer bandwidth
- ❌ Harder to implement per-repo privacy
- ❌ Keys are longer (`entry:repo:id`)
- ❌ Queries must filter by repo prefix

---

### Architecture 2: One Channel Per Repository (Your Suggestion - Better!)

```
Channel: movies
├─ World State
│  ├─ entry:movie-001
│  ├─ entry:movie-002
│  ├─ comment:movie-001:review-123
│  └─ torrent:movie-001:hash-abc
├─ Orderer: orderer1.bootstrap-org
└─ Chaincode: repo-manager v1.0

Channel: tv-shows
├─ World State
│  ├─ entry:show-001
│  ├─ entry:show-002
│  ├─ comment:show-001:review-456
│  └─ torrent:show-001:hash-def
├─ Orderer: orderer1.bootstrap-org (same orderers)
└─ Chaincode: repo-manager v1.0

Channel: documentaries
├─ World State
│  ├─ entry:doc-001
│  └─ ...
├─ Orderer: orderer1.bootstrap-org (same orderers)
└─ Chaincode: repo-manager v1.0
```

**Pros:**
- ✅ Repos are completely isolated (separate ledgers)
- ✅ One slow repo doesn't affect others
- ✅ Simpler keys (no repo prefix needed)
- ✅ Natural permission boundaries
- ✅ Can have different endorsement policies per repo
- ✅ Can add/remove repos without touching other channels
- ✅ Easier to implement repo-level privacy

**Cons:**
- More channels to manage
- More orderer communication (per repo)
- But orderers use same service, so not really a con

---

## Implementation: One Channel Per Repo

### Network Topology (Same as Before)

```
Relay Tracker
├─ Fabric CA (issues certificates)
└─ Optional Orderer (seed)

Bootstrap Node 1, 2, 3
├─ Fabric Peers (join all channels)
├─ Fabric Orderers (Raft consensus, shared across channels)
└─ WebTorrent Seeders
```

**Key Point:** Orderers are **shared** across channels. One orderer can order blocks for movies, tv-shows, documentaries simultaneously.

### Chaincode Deployment

**Same chaincode deployed to all channels:**

```
Chaincode: repo-manager v1.0

├─ Channel: movies
│  └─ repo-manager instantiated (manages movies repo)
│
├─ Channel: tv-shows
│  └─ repo-manager instantiated (manages tv-shows repo)
│
└─ Channel: documentaries
   └─ repo-manager instantiated (manages documentaries repo)
```

**Each instance has its own state:**

```javascript
// When chaincode runs on movies channel:
await ctx.stub.putState("entry:movie-001", {...});
// Stored in movies channel's LevelDB

// When chaincode runs on tv-shows channel:
await ctx.stub.putState("entry:show-001", {...});
// Stored in tv-shows channel's LevelDB (different LevelDB!)
```

### Simplified Data Model

**Entries:**
```javascript
// Location: entry:movie-001 (on movies channel)
{
  id: "movie-001",
  title: "Inception",
  year: 2010,
  torrentHash: "abc123...",
  addedBy: "alice@example.com",
  addedAt: "2025-10-31T10:00:00Z"
}

// Location: entry:show-001 (on tv-shows channel)
{
  id: "show-001",
  title: "Breaking Bad",
  seasons: 5,
  torrentHash: "def456...",
  addedBy: "bob@example.com"
}
```

**No repo prefix needed!** The channel is the repo.

**Comments:**
```javascript
// Location: comment:movie-001:review-123 (on movies channel)
{
  id: "review-123",
  entryId: "movie-001",
  content: "Great movie!",
  commentedBy: "charlie@example.com"
}

// Location: comment:show-001:review-456 (on tv-shows channel)
{
  id: "review-456",
  entryId: "show-001",
  content: "Excellent show!",
  commentedBy: "diana@example.com"
}
```

### Simplified Chaincode

```javascript
// repo-manager.js
// (same code deployed to all channels, but operates on that channel's data)

class RepoManager {
  
  async addEntry(ctx, entryData) {
    // NO repo parameter needed! Channel IS the repo
    const key = `entry:${entryData.id}`;
    await ctx.stub.putState(key, JSON.stringify(entryData));
    return entryData.id;
  }

  async getEntry(ctx, entryId) {
    const key = `entry:${entryId}`;
    const entry = await ctx.stub.getState(key);
    return JSON.parse(entry);
  }

  async searchEntries(ctx, query) {
    // Get all entries in THIS channel
    const iterator = await ctx.stub.getStateByRange("entry:", "entry:zzz");
    
    const results = [];
    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      
      const entry = JSON.parse(result.value.value.toString());
      if (this.matchesQuery(entry, query)) {
        results.push(entry);
      }
    }
    
    return results;
  }

  async addComment(ctx, entryId, commentData) {
    const key = `comment:${entryId}:${commentData.id}`;
    await ctx.stub.putState(key, JSON.stringify(commentData));
    return commentData.id;
  }

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
    
    return comments;
  }
}
```

**Much cleaner! No repo parameter, no repo prefix in keys.**

---

## Simplified Data Model

### Entry Schema (Simplified)

**Key:** `entry:<entryId>`

```javascript
{
  id: "movie-001",                    // Unique within channel
  title: "Inception",                 // String
  year: 2010,                         // Optional
  description: "...",                 // Text
  torrentHash: "abc123...",           // WebTorrent hash (NO binary data)
  fileSize: 2147483648,               // Bytes
  genres: ["sci-fi", "thriller"],     // Array
  metadata: { ... },                  // Custom metadata
  addedBy: "alice@example.com",       // Creator
  addedAt: "2025-10-31T10:00:00Z",   // Timestamp
  rating: 8.8,                        // Average rating
  comments: 42                        // Comment count
}
```

**Size:** ~1 KB per entry (same as before)

### Comment Schema (Simplified)

**Key:** `comment:<entryId>:<commentId>`

```javascript
{
  id: "review-789",
  entryId: "movie-001",               // Reference to entry (no channel needed!)
  content: "Great movie!",
  type: "review",
  rating: 5,
  commentedBy: "bob@example.com",
  commentedAt: "2025-10-31T11:00:00Z"
}
```

**Size:** ~500 bytes per comment

### Torrent Metadata (Simplified)

**Key:** `torrent:<entryId>:<variant>`

```javascript
{
  entryId: "movie-001",               // Reference to entry
  variant: "primary",
  hash: "abc123...",
  name: "Inception.mp4",
  size: 2147483648,
  seeders: 12,
  leechers: 45
}
```

### User Profile (Same Channel or Global Channel?)

**Option A: Per-repo users**
```
Channel: movies
├─ entry:movie-001
├─ user:alice@example.com            ← Each channel has its own user list
└─ ...

Channel: tv-shows
├─ entry:show-001
├─ user:alice@example.com            ← User can appear in multiple channels
└─ ...
```

**Option B: Global users channel**
```
Channel: users (global)
├─ user:alice@example.com
├─ user:bob@example.com
└─ ...

Channels: movies, tv-shows, ...
├─ Just reference users by email
└─ Don't store user profile
```

**Recommendation:** Option B is cleaner! One source of truth for users.

---

## Simplified Key Naming

### Before (All Repos in One Channel)

```
entry:movies:movie-001
entry:movies:movie-002
entry:tv-shows:show-001
entry:tv-shows:show-002
comment:movies:movie-001:review-123
comment:tv-shows:show-001:review-456
user:alice@example.com
metadata:movies:stats
```

### After (One Channel Per Repo)

```
// On movies channel:
entry:movie-001
entry:movie-002
comment:movie-001:review-123
torrent:movie-001:primary

// On tv-shows channel:
entry:show-001
entry:show-002
comment:show-001:review-456
torrent:show-001:primary

// On users channel (optional global channel):
user:alice@example.com
user:bob@example.com
```

**Much cleaner!** Shorter keys, no repo prefix duplication.

---

## Chaincode Invocation

### Before (All Repos in One Channel)

```javascript
// Client code
const result = await fabric.invoke({
  channel: "main",                    // Single channel
  chaincode: "repo-manager",
  function: "addEntry",
  args: [
    "movies",                         // Need to specify repo
    {
      id: "movie-001",
      title: "Inception",
      ...
    }
  ]
});
```

### After (One Channel Per Repo)

```javascript
// Client code
const result = await fabric.invoke({
  channel: "movies",                  // Channel IS the repo
  chaincode: "repo-manager",
  function: "addEntry",
  args: [
    {
      id: "movie-001",
      title: "Inception",
      ...
    }
    // No repo parameter! Channel is implicit
  ]
});
```

**Cleaner API!** Channel name is the repository name.

---

## Network Architecture (Updated)

```
┌────────────────────────────────────────────┐
│         Relay Tracker                      │
├────────────────────────────────────────────┤
│ Fabric CA + Optional Orderer               │
└────────────────────────────────────────────┘
         │
    ┌────┴────┬─────────┬─────────┐
    │          │         │         │
    ▼          ▼         ▼         ▼
┌──────────┐ ┌───────┐ ┌───────┐ ┌───────┐
│Bootstrap │ │Peer B │ │Peer C │ │Peer D │
│ Node A   │ │       │ │       │ │       │
├──────────┤ ├───────┤ ├───────┤ ├───────┤
│          │ │       │ │       │ │       │
│Peer Node │ │Peer   │ │Peer   │ │Peer   │
│Orderer   │ │Node   │ │Node   │ │Node   │
│          │ │       │ │       │ │       │
│Channels: │ │Channels:│Channels:│Channels:
│ movies   │ │ movies  │ movies  │ movies
│ tv-shows │ │ tv-show │ tv-show │ tv-show
│ docs     │ │ docs    │ docs    │ docs
│ users    │ │ users   │ users   │ users
│          │ │       │ │       │ │       │
│Chaincode │ │Chaincode Chaincode Chaincode
│ repo-mgr │ │ repo-mgr │ repo-mgr │ repo-mgr
│ users    │ │ users   │ users   │ users
│          │ │       │ │       │ │       │
│WebTorrent│ │WebTorr │ │WebTorr │ │WebTorr
│Seeder    │ │Client  │ │Client  │ │Client
│          │ │       │ │       │ │       │
│LevelDB   │ │LevelDB │ │LevelDB │ │LevelDB
│(all ch)  │ │(all ch)│ │(all ch)│ │(all ch)
└──────────┘ └───────┘ └───────┘ └───────┘
```

**All peers join all channels** (or at least, same peers for all repo channels).

---

## Summary: Your Suggestion is Better

| Feature | One Big Channel | One Channel Per Repo |
|---------|-----------------|----------------------|
| **Isolation** | Logical | Physical ✅ |
| **Key Complexity** | `entry:repo:id` | `entry:id` ✅ |
| **Performance** | Repos interfere | Repos independent ✅ |
| **Scalability** | Limited | Scales per repo ✅ |
| **Privacy** | Hard to implement | Easy via channel ✅ |
| **Permissions** | Chaincode logic | Channel ACL ✅ |
| **Maintainability** | Complex | Simple ✅ |

**Verdict:** Use **one channel per repository**. It's the standard Fabric pattern and solves all the problems.

---

## Updated Data Model (Simplified)

**Updated File:** Update `/docs/REPOSITORY_DATA_MODEL.md`

### Key Changes

1. **Remove repo prefix from keys**
   - Before: `entry:movies:movie-001`
   - After: `entry:movie-001` (on movies channel)

2. **Remove repo parameter from chaincode functions**
   - Before: `addEntry(repo, entry)`
   - After: `addEntry(entry)` (channel is implicit)

3. **Simpler key ranges**
   - Before: `entry:movies:` to `entry:movies:zzz`
   - After: `entry:` to `entry:zzz` (entire channel)

4. **Optional: Global users channel**
   - One users channel for all user profiles
   - Reduces duplication
   - Single source of truth for capabilities

---

## Next Steps

1. ✅ Update **REPOSITORY_DATA_MODEL.md** (simplified keys, no repo prefix)
2. ✅ Update **FABRIC_IMPLEMENTATION_GUIDE.md** (clarify channels)
3. ⏳ Proceed with WebTorrent integration design
4. ⏳ Update RemoteHouse components

**Your suggestion significantly improves the architecture!**
