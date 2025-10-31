# Selective Channel Subscription: Peer Channel Participation

**Status:** Design Decision  
**Date:** October 31, 2025  
**Version:** 1.0  
**Type:** Architecture Specification

---

## Executive Summary

**Question:** Do peers need to download and store all repositories/channels?

**Answer:** NO! Peers can selectively join only the channels (repositories) they care about.

**Key Point:** Fabric channels are **opt-in**. A peer only:
- Joins channels it cares about
- Syncs ledger state for those channels only
- Stores blocks for those channels only
- Downloads files for those channels only

---

## Channel Subscription Model

### What This Means

```
Network: movies, tv-shows, documentaries, music, games (5 channels)

Bootstrap Node A (High-Capacity):
├─ Joins all 5 channels
├─ Stores all 5 ledgers (~50 MB total)
├─ Endorses all channels
└─ "Seed all repositories"

Regular Peer B (Limited Storage):
├─ Joins only: movies, tv-shows
├─ Stores only 2 ledgers (~20 MB)
├─ Queries only movies and tv-shows
└─ Seeds only those files

Regular Peer C (Very Limited Storage):
├─ Joins only: movies
├─ Stores only 1 ledger (~10 MB)
├─ Queries only movies
└─ Seeds only movies

Result: Peers participate proportionally to their capacity and interests!
```

### Peer Channel Participation

**Peer A: High-capacity bootstrap node**
```
Channels joined: movies, tv-shows, documentaries, music, games
Disk usage:     50 MB (all ledgers)
Bandwidth:      High (receives all blocks)
Role:           Full archival node + endorser
```

**Peer B: Consumer with specific interests**
```
Channels joined: movies, tv-shows (only what I watch)
Disk usage:     20 MB (just those 2 channels)
Bandwidth:      Medium (blocks for 2 channels)
Role:           Consumer + partial seeder
```

**Peer C: Mobile device or low-capacity**
```
Channels joined: movies (only my favorite)
Disk usage:     10 MB (just one channel)
Bandwidth:      Low (only movie blocks)
Role:           Consumer only
```

---

## How Selective Subscription Works

### Joining a Channel

```
User wants to participate in "movies" repository

Step 1: Peer discovers channel exists
  └─ Via gossip protocol
  └─ From bootstrap node registry
  └─ Channel "movies" is available

Step 2: Peer joins the channel
  $ peer channel join -c movies
  └─ Peer contacts orderer
  └─ Receives genesis block
  └─ Starts syncing ledger

Step 3: Peer syncs ledger state
  ├─ Receives all blocks for movies channel
  ├─ Executes chaincode to build state
  ├─ Stores in local LevelDB
  └─ Becomes "current" with network

Step 4: Peer is ready
  ├─ Can query movies ledger
  ├─ Can invoke transactions
  ├─ Can download movie files
  └─ Participates in gossip for movies channel
```

### NOT Joining a Channel

```
User is NOT interested in "music" repository

Option 1: Never join
  └─ Peer ignores music channel completely
  └─ No music blocks downloaded
  └─ No music ledger state stored
  └─ Zero overhead

Option 2: Join later (dynamic)
  └─ At any time, peer can: peer channel join -c music
  └─ Only then start syncing music blocks
  └─ Ledger state built incrementally
```

---

## Storage & Bandwidth Implications

### Scenario: 5 Repositories (Channels)

**Assumptions:**
- Each channel: 10,000 entries
- Per entry: ~1 KB average
- Per comment: ~500 bytes
- Per torrent: ~500 bytes
- Block overhead: ~20%

**Storage per channel:**
```
10,000 entries = 10 MB
50,000 comments = 25 MB
10,000 torrents = 5 MB
Block metadata = 2 MB
─────────────────────
Total per channel ≈ 42 MB (with 20% overhead)
```

### Peer Storage Comparison

| Peer Type | Channels Joined | Storage | Notes |
|-----------|-----------------|---------|-------|
| **Bootstrap A** | All 5 (movies, tv, docs, music, games) | 210 MB | Full archival node |
| **Peer B** | 3 channels (movies, tv, music) | 126 MB | Consumer + seeder |
| **Peer C** | 2 channels (movies, tv) | 84 MB | Limited capacity |
| **Peer D** | 1 channel (movies) | 42 MB | Mobile device |
| **Peer E** | 0 channels (observer only) | < 1 MB | Metadata only |

**Without selective subscription (all channels mandatory):**
- Every peer forced to store 210 MB
- Many peers couldn't participate (storage-limited)
- Bandwidth wasted on unwanted channels
- ❌ Doesn't scale to 100+ repositories

**With selective subscription (channels optional):**
- Peers join only what they care about
- Small devices can participate
- Bandwidth efficient
- Storage efficient
- ✅ Scales to 100+ repositories

---

## Bandwidth Implications

### Block Download Traffic

```
Scenario: New block arrives on each channel every 10 seconds

Without selective subscription (5 channels):
├─ movies block every 10s ≈ 100 KB/block
├─ tv-shows block every 10s ≈ 100 KB/block
├─ documentaries block every 10s ≈ 100 KB/block
├─ music block every 10s ≈ 100 KB/block
└─ games block every 10s ≈ 100 KB/block
─────────────────────────────────────────────
Total: 500 KB every 10s = 50 KB/s = 432 MB/day

With selective subscription (Peer joins only movies + tv-shows):
├─ movies block every 10s ≈ 100 KB/block
└─ tv-shows block every 10s ≈ 100 KB/block
─────────────────────────────────────────────
Total: 200 KB every 10s = 20 KB/s = 172 MB/day

Savings: 60% less bandwidth!
```

### WebTorrent File Download

```
Without selective subscription:
├─ User sees all movie files (even unwanted ones)
├─ DHT has all magnet links
├─ User must filter/ignore files

With selective subscription:
├─ User only sees movies/tv torrents
├─ DHT only knows about joined channels
├─ Cleaner user experience
├─ Targeted file discovery
```

---

## Implementation: How It Works in Fabric

### Peer Configuration

```javascript
// peer-config.yaml (each peer specifies channels)

peer:
  id: peer1.bootstrap-org
  chaincodes:
    - name: repo-manager
      version: "1.0"

channels:
  - name: movies
    enabled: true          ← Join this channel
    anchorPeers: []
    
  - name: tv-shows
    enabled: true          ← Join this channel
    anchorPeers: []
    
  - name: documentaries
    enabled: false         ← Don't join (yet)
    
  - name: music
    enabled: false         ← Don't join
    
  - name: games
    enabled: false         ← Don't join

// Result: peer1 only syncs movies + tv-shows channels
```

### Dynamic Channel Joining

```bash
# Peer A joins movies channel
$ peer channel join -c movies -b movies.block

# Peer A later joins tv-shows channel
$ peer channel join -c tv-shows -b tv-shows.block

# Peer A queries movies
$ peer chaincode query -C movies -n repo-manager -c '{"Args":["getEntry","movie-001"]}'

# Peer A queries tv-shows
$ peer chaincode query -C tv-shows -n repo-manager -c '{"Args":["getEntry","show-001"]}'

# Peer A cannot query documentaries (not joined)
$ peer chaincode query -C documentaries -n repo-manager -c '{"Args":["getEntry","doc-001"]}'
# Error: Channel documentaries not joined
```

### Ledger Storage Per Channel

```
/var/hyperledger/production/

├─ ledgersData/
│  ├─ chains/
│  │  ├─ movies/
│  │  │  ├─ blockstore_000000
│  │  │  ├─ blockstore_000001
│  │  │  └─ ...
│  │  │
│  │  └─ tv-shows/
│  │     ├─ blockstore_000000
│  │     └─ ...
│  │
│  └─ stateLeveldb/
│     ├─ movies/
│     │  ├─ entry:movie-001
│     │  ├─ entry:movie-002
│     │  └─ ... (movie data)
│     │
│     └─ tv-shows/
│        ├─ entry:show-001
│        └─ ... (tv show data)

// Peer has NOT joined documentaries, so:
// - No documentaries/blockstore_*
// - No stateLeveldb/documentaries/
// - 0 bytes storage for documentaries!
```

---

## User Experience: Selecting Repositories

### Client (Tauri) UI

**User Interface for Channel Selection:**

```
┌─────────────────────────────────────┐
│ Available Repositories              │
├─────────────────────────────────────┤
│                                     │
│ ☑ Movies          (10GB seeding)    │
│ ☑ TV Shows        (5GB seeding)     │
│ ☐ Documentaries   (join to seed)    │
│ ☐ Music           (join to seed)    │
│ ☐ Games           (join to seed)    │
│                                     │
│           [Join] [Leave]            │
│                                     │
└─────────────────────────────────────┘

User can:
✅ View joined channels (Movies, TV Shows)
✅ See storage/seeding status
✅ Join new channels (click "Join")
✅ Leave channels (click "Leave")
```

### Client API

```javascript
// Tauri command: List all channels
const channels = await invoke("get_available_channels");
// Returns: ["movies", "tv-shows", "documentaries", "music", "games"]

// Tauri command: Get joined channels
const joined = await invoke("get_joined_channels");
// Returns: ["movies", "tv-shows"]

// Tauri command: Join a channel
await invoke("join_channel", { channel: "documentaries" });
// Peer joins "documentaries", starts syncing

// Tauri command: Leave a channel
await invoke("leave_channel", { channel: "music" });
// Peer leaves "music", can still query history if cached locally

// Tauri command: Query a channel
const entry = await invoke("query_ledger", {
  channel: "movies",
  function: "getEntry",
  args: ["movie-001"]
});
// Only works if peer has joined movies channel

// Tauri command: Get channel storage usage
const usage = await invoke("get_channel_storage", { channel: "movies" });
// Returns: { used: 42000000, percentage: 15.2 }
```

### TypeScript Interface

```typescript
// Types for channel management

interface Channel {
  name: string;
  description?: string;
  joined: boolean;
  storageUsed: number;        // Bytes
  blockHeight: number;         // Latest block
  entryCount: number;         // Entries in channel
  lastUpdated: Date;
}

interface ChannelStats {
  channel: string;
  peers: number;              // How many peers seeding
  blockTime: number;          // Avg seconds per block
  throughput: number;         // Entries per day
}

// Get list of channels
async function getChannels(): Promise<Channel[]> {
  return await invoke("get_available_channels");
}

// Join a channel
async function joinChannel(name: string): Promise<void> {
  return await invoke("join_channel", { channel: name });
}

// Leave a channel
async function leaveChannel(name: string): Promise<void> {
  return await invoke("leave_channel", { channel: name });
}

// Get channel storage usage
async function getChannelStorage(name: string): Promise<number> {
  return await invoke("get_channel_storage", { channel: name });
}

// Query a channel
async function queryChannel(
  channel: string,
  query: any
): Promise<any> {
  return await invoke("query_ledger", { channel, ...query });
}
```

---

## Scenario: Mobile Device (Limited Storage)

### Phone Storage: 64 GB

```
Total device storage: 64 GB
OS + Apps: 40 GB
Available: 24 GB

Flashback Peer Configuration:
├─ Joined channels: movies, tv-shows
├─ Storage used: 84 MB
├─ Available: 23.9 GB
├─ Usage: 0.35% of device

User can:
✅ Store full ledger for 2 popular channels
✅ Download movies/shows via WebTorrent
✅ Seed files to other peers
✅ Query ledger offline
✅ Submit transactions
✅ Never worry about storage

Optional:
- Join documentaries (add 42 MB)
- Join music (add 42 MB)
- Total would still be < 1% of device
```

---

## Scenario: Bootstrap Node (Full Archive)

### Server Storage: 2 TB

```
Total storage: 2 TB
OS + Fabric: 50 GB
Available: 1.95 TB

Flashback Configuration:
├─ Joined channels: ALL (movies, tv-shows, documentaries, music, games, ...)
├─ Assume 20 channels, 42 MB each
├─ Storage used: 840 MB
├─ Available: 1.949 TB
├─ Usage: 0.04% of server

Bootstrap node can:
✅ Join 100+ channels with still < 5% usage
✅ Full archive and endorser
✅ Seed all files
✅ Backup for all repositories
```

---

## Advantages of Selective Subscription

### Storage Efficiency
```
❌ Without: Every peer must store all channels (wasteful)
✅ With:    Each peer stores only what it needs
```

### Bandwidth Efficiency
```
❌ Without: 50 KB/s download (all blocks, even unwanted)
✅ With:    20 KB/s download (only joined channels)
```

### User Control
```
❌ Without: Forced to participate in everything
✅ With:    Choose which repositories to support
```

### Scalability
```
❌ Without: Limited to ~5-10 channels before storage/bandwidth issues
✅ With:    Can scale to 100+ channels without overload
```

### Dynamic Participation
```
❌ Without: Static decision at setup time
✅ With:    Join/leave channels anytime
```

### Device Flexibility
```
❌ Without: Only high-capacity devices can participate
✅ With:    Mobile devices, Raspberry Pi, etc. can join 1-2 channels
```

---

## Network Topology: With Selective Subscription

```
Relay Tracker
├─ Channel registry (all available channels)
└─ Bootstrap registry (all peers + their channels)

Bootstrap Node A
├─ Joined channels: ALL
├─ Storage: Full archive
└─ Role: Authoritative + seeder

Peer B (Content Creator)
├─ Joined channels: movies, tv-shows
├─ Storage: Popular channels
└─ Role: Active contributor + seeder

Peer C (Casual Consumer)
├─ Joined channels: movies
├─ Storage: Minimal
└─ Role: Consumer only

Peer D (Mobile)
├─ Joined channels: movies
├─ Storage: < 100 MB
└─ Role: Mobile consumer

Network Benefits:
- Peers join based on interests/capacity
- No forced participation
- Efficient bandwidth/storage usage
- Democratic participation (any device can join something)
- Sustainable P2P network
```

---

## Discovery: How Peers Find Channels

### Channel Registry (Stored Where?)

**Option 1: Broadcast on startup via gossip**
```
Bootstrap Node A announces:
  "I'm the authoritative source for channels"
  "Available channels: [movies, tv-shows, ...]"

Peers gossip this info:
  Peer B gets it
  Peer C gets it
  Peer D gets it
```

**Option 2: Stored on relay tracker**
```
Relay Tracker maintains:
  GET /channels → ["movies", "tv-shows", "documentaries", ...]
  GET /channel/movies → { name, description, joined: 234 peers, blockHeight: 50000 }

Peers query on startup:
  curl https://relay.example.com/channels
  → Get list of all available channels
```

**Recommendation:** Use both!
- Bootstrap nodes gossip for resilience
- Relay tracker as centralized index for discovery

### Client Discovery Flow

```
User starts Tauri app

Step 1: Query relay tracker for channels
  GET /channels
  → ["movies", "tv-shows", "documentaries", "music", "games"]

Step 2: Get channel info
  GET /channel/movies
  → { joined: 234 peers, blocks: 50000, size: 42MB }

Step 3: Show to user
  "Available repositories you can join:"
  - Movies (234 peers, 42 MB, 50K blocks)
  - TV Shows (189 peers, 38 MB, 45K blocks)
  - Documentaries (45 peers, 30 MB, 20K blocks)
  - Music (12 peers, 15 MB, 8K blocks)
  - Games (8 peers, 12 MB, 5K blocks)

Step 4: User selects
  "I want to join: Movies, TV Shows"

Step 5: Peer joins
  peer channel join -c movies
  peer channel join -c tv-shows
```

---

## Fallback: What If Peer Rejoins Later?

```
Scenario: Peer was on channel movies, left for months, rejoins

Option 1: Full resync (starts fresh)
├─ Peer joins movies channel again
├─ Downloads all blocks from genesis
├─ Rebuilds ledger state
├─ Time: Depends on channel size

Option 2: Partial resync (from checkpoint)
├─ Peer checks local cache
├─ Checks with other peers: "What's my missing blocks?"
├─ Downloads only missing blocks since last sync
├─ Rebuilds state from checkpoint
├─ Time: Much faster if cache exists

Recommendation: Keep local cache after leaving
└─ Allows fast resync if rejoining later
```

---

## Summary

### Key Points

| Question | Answer |
|----------|--------|
| **Do peers need ALL channels?** | NO! Selective subscription. |
| **Can a peer join only some channels?** | YES! Join only what you care about. |
| **Can peers leave channels?** | YES! Leave anytime to free storage. |
| **Can peers rejoin later?** | YES! Resync from checkpoint. |
| **Is this scalable?** | YES! 100+ channels no problem. |
| **Works on mobile?** | YES! Join 1-2 channels on phone. |
| **Storage overhead?** | Minimal! Only joined channels stored. |
| **Bandwidth overhead?** | Only joined channels transmitted. |

### Implementation

1. **Peer-side:** Fabric configuration specifies channels to join
2. **Client-side:** Tauri API for join/leave/query
3. **UI-side:** Channel selection screen with storage info
4. **Discovery:** Relay tracker + gossip for channel registry
5. **Scalability:** Works with 10, 100, or 1000 channels

### Result

✅ Efficient, scalable, user-controlled participation  
✅ Works on devices of any storage capacity  
✅ Bandwidth proportional to interest, not network size  
✅ Democratic P2P network without forced participation
