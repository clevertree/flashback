# Fabric Tauri API Bridge Implementation Guide

**Status:** Architecture Complete - Ready for Implementation  
**Date:** October 31, 2025  
**Purpose:** Define API bridge between React UI and Hyperledger Fabric backend via Tauri

---

## Overview

The Tauri API bridge provides a TypeScript/JavaScript interface between the React UI and Hyperledger Fabric network. This replaces the old git protocol logic with direct Fabric query/invoke commands.

### Architecture

```
React UI Components
    ↓
TypeScript Interface (window.flashbackApi)
    ↓
Tauri Command Router
    ↓
Rust Backend (src-tauri/src/commands/)
    ↓
Fabric Node.js SDK
    ↓
Hyperledger Fabric Network
```

---

## New API Methods (to implement in `src/integration/flashbackCryptoBridge.ts`)

### 1. Channel Management

#### `fabricGetChannels()`
Get list of available Fabric channels
```typescript
// Request
await window.flashbackApi.fabricGetChannels()

// Response
["movies", "tv-shows", "documentaries", "anime", "tutorials"]
```

#### `fabricSubscribeChannel(channelName: string)`
Subscribe to a Fabric channel
```typescript
// Request
await window.flashbackApi.fabricSubscribeChannel("movies")

// Response
"SUBSCRIBED OK"
```

#### `fabricUnsubscribeChannel(channelName: string)`
Unsubscribe from a Fabric channel
```typescript
// Request
await window.flashbackApi.fabricUnsubscribeChannel("movies")

// Response
"UNSUBSCRIBED OK"
```

### 2. Entry Queries

#### `fabricQueryEntries(channel: string, options?: { query?: string; tags?: string[] })`
Query entries from a Fabric channel
```typescript
// Request (simple)
await window.flashbackApi.fabricQueryEntries("movies")

// Request (with search)
await window.flashbackApi.fabricQueryEntries("movies", {
  query: "avatar",
  tags: ["sci-fi", "james-cameron"]
})

// Response
[
  {
    id: "entry:001",
    title: "Avatar (2009)",
    description: "Epic sci-fi film by James Cameron",
    creator: "user@example.com",
    createdAt: "2025-10-31T10:00:00Z",
    commentCount: 42,
    tags: ["sci-fi", "james-cameron", "2009"],
    torrentHash: "abc123..." // WebTorrent hash if available
  }
]
```

#### `fabricGetEntry(channel: string, entryId: string)`
Get details for a specific entry
```typescript
// Request
await window.flashbackApi.fabricGetEntry("movies", "entry:001")

// Response
{
  id: "entry:001",
  title: "Avatar (2009)",
  description: "Epic sci-fi film by James Cameron",
  creator: "user@example.com",
  createdAt: "2025-10-31T10:00:00Z",
  updatedAt: "2025-10-31T15:30:00Z",
  tags: ["sci-fi", "james-cameron", "2009"],
  torrentHash: "abc123...",
  rating: 4.8,
  ratingCount: 156
}
```

### 3. Comment Queries

#### `fabricQueryComments(channel: string, entryId: string)`
Query comments for an entry
```typescript
// Request
await window.flashbackApi.fabricQueryComments("movies", "entry:001")

// Response (only active comments, deleted ones filtered)
[
  {
    id: "comment:001",
    content: "Amazing movie!",
    rating: 5,
    commentedBy: "alice@example.com",
    createdAt: "2025-10-31T11:00:00Z",
    status: "active",
    editCount: 0
  },
  {
    id: "comment:002",
    content: "Great cinematography",
    rating: 5,
    commentedBy: "bob@example.com",
    createdAt: "2025-10-31T12:00:00Z",
    status: "active",
    editCount: 1
  }
]
```

### 4. Entry Mutations

#### `fabricAddEntry(channel: string, entry: { title: string; description?: string; tags?: string[] })`
Add a new entry to a channel
```typescript
// Request
await window.flashbackApi.fabricAddEntry("movies", {
  title: "Inception",
  description: "A mind-bending thriller",
  tags: ["thriller", "sci-fi", "christopher-nolan"]
})

// Response
{
  id: "entry:002",
  transactionId: "tx:abc123",
  status: "SUCCESS",
  message: "Entry committed to blockchain"
}
```

#### `fabricUpdateEntry(channel: string, entryId: string, updates: { title?: string; description?: string; tags?: string[] })`
Update an existing entry (owner only by default)
```typescript
// Request
await window.flashbackApi.fabricUpdateEntry("movies", "entry:001", {
  description: "Updated description",
  tags: ["sci-fi", "james-cameron", "2009", "remaster"]
})

// Response
{
  id: "entry:001",
  transactionId: "tx:def456",
  status: "SUCCESS",
  message: "Entry updated"
}
```

#### `fabricDeleteEntry(channel: string, entryId: string, reason?: string)`
Delete an entry (mark as deleted)
```typescript
// Request
await window.flashbackApi.fabricDeleteEntry("movies", "entry:001", "Spam")

// Response
{
  id: "entry:001",
  transactionId: "tx:ghi789",
  status: "SUCCESS",
  message: "Entry marked deleted"
}
```

### 5. Comment Mutations

#### `fabricAddComment(channel: string, entryId: string, comment: { content: string; rating?: number })`
Add a comment to an entry
```typescript
// Request
await window.flashbackApi.fabricAddComment("movies", "entry:001", {
  content: "Outstanding visual effects!",
  rating: 5
})

// Response
{
  id: "comment:003",
  entryId: "entry:001",
  transactionId: "tx:jkl012",
  status: "SUCCESS",
  message: "Comment added"
}
```

#### `fabricUpdateComment(channel: string, entryId: string, commentId: string, updates: { content?: string; rating?: number })`
Update a comment (owner only by default)
```typescript
// Request
await window.flashbackApi.fabricUpdateComment("movies", "entry:001", "comment:001", {
  content: "Still amazing after rewatch!",
  rating: 5
})

// Response
{
  id: "comment:001",
  transactionId: "tx:mno345",
  status: "SUCCESS",
  message: "Comment updated",
  editCount: 1
}
```

#### `fabricDeleteComment(channel: string, entryId: string, commentId: string, reason?: string)`
Delete a comment (mark as deleted)
```typescript
// Request
await window.flashbackApi.fabricDeleteComment("movies", "entry:001", "comment:001", "Off-topic")

// Response
{
  id: "comment:001",
  transactionId: "tx:pqr678",
  status: "SUCCESS",
  message: "Comment marked deleted",
  deletedBy: "user@example.com"
}
```

---

## Removed API Methods (deprecated git protocol)

These methods should be removed or deprecated as they are replaced by Fabric equivalents:

❌ `apiCloneRepository()` → Use `fabricSubscribeChannel()`  
❌ `apiGetRepositories()` → Use `fabricGetChannels()`  
❌ Repository hosting logic → Replaced by Fabric peer-to-peer sync  
❌ RemoteHouse file server APIs → Only used for friend connections now

---

## CLI Commands (Rust Backend)

New Fabric CLI commands in `client/src-tauri/src/cli/commands.rs`:

```rust
// Query entries
fabric query-entries movies "avatar"

// Query comments
fabric query-comments movies entry:001

// Get available channels
fabric get-channels

// Subscribe to channel
fabric subscribe movies

// Unsubscribe from channel
fabric unsubscribe movies

// Add entry
fabric add-entry movies "Avatar" "Epic sci-fi film"

// Add comment
fabric add-comment movies entry:001 "Amazing movie"
```

---

## Implementation Roadmap

### Phase 1: Core API Bridge (Week 1)
- [ ] Create `FabricApiMethods` enum in `commands.rs`
- [ ] Implement Tauri command handlers
- [ ] Add channel management methods
- [ ] Add query methods (entries, comments)
- [ ] Test basic query flows

### Phase 2: Mutation Methods (Week 2)
- [ ] Implement entry mutations (add, update, delete)
- [ ] Implement comment mutations
- [ ] Add permission checking (owner-only edits)
- [ ] Test with Fabric test network
- [ ] Error handling for blockchain failures

### Phase 3: Integration Testing (Week 3)
- [ ] Test RepoBrowser with Fabric backend
- [ ] Test channel subscription UI
- [ ] Test comment ownership enforcement
- [ ] Performance testing (large result sets)
- [ ] Load testing (many entries)

### Phase 4: Production Hardening (Week 4)
- [ ] Caching layer for frequently queried data
- [ ] Pagination for large result sets
- [ ] Rate limiting on API calls
- [ ] Logging and monitoring
- [ ] Error recovery mechanisms

---

## Error Handling

All API methods should handle these error cases:

```typescript
// Network errors
"Fabric network unreachable"

// Permission errors
"User not authorized to edit this entry"
"Only comment owner can edit comments"

// Validation errors
"Invalid channel name"
"Entry title cannot be empty"

// Blockchain errors
"Transaction failed: Endorsement policy not satisfied"
"Chaincode error: Entry not found"

// Rate limiting
"Too many requests. Please wait before trying again"
```

---

## Type Definitions (TypeScript)

```typescript
// In client/src/apiTypes.ts

export interface BlockchainEntry {
  id: string;
  title: string;
  description?: string;
  creator?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  rating?: number;
  ratingCount?: number;
  commentCount?: number;
  torrentHash?: string;
}

export interface BlockchainComment {
  id: string;
  entryId?: string;
  content: string;
  rating?: number;
  commentedBy: string;
  createdAt: string;
  updatedAt?: string;
  deletedBy?: string;
  status: 'active' | 'deleted' | 'flagged';
  editCount?: number;
}

export interface FabricTransaction {
  id: string;
  transactionId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
  error?: string;
}

export interface ChannelInfo {
  name: string;
  description?: string;
  entryCount?: number;
  commentCount?: number;
  subscribed: boolean;
}
```

---

## Security Considerations

### 1. Permission Verification
- All edit/delete operations verified server-side via X.509 certificates
- Comment ownership checked via `commentedBy` field
- Admin capability checked from certificate attributes

### 2. Input Validation
- Channel names validated against whitelist
- Entry IDs validated for format
- Comment content length limits enforced
- Tags sanitized for special characters

### 3. Rate Limiting
- Max 100 queries per minute per user
- Max 10 mutations per minute per user
- Sliding window rate limiting

### 4. Audit Trail
- All transactions logged on blockchain
- Timestamps preserved for all changes
- Editor tracked for all mutations
- Delete operations never truly erase data

---

## Performance Optimization

### Caching Strategy
```typescript
// Client-side cache with 5-minute TTL
const cache = new Map<string, { data: any; expires: number }>();

function getCachedEntries(channel: string) {
  const key = `entries:${channel}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  return null;
}
```

### Pagination
```typescript
// Query with pagination
await window.flashbackApi.fabricQueryEntries("movies", {
  limit: 20,
  offset: 0
})
```

### Indexing
- Entries indexed by `id`, `creator`, `tags`, `createdAt`
- Comments indexed by `entryId`, `commentedBy`, `status`
- Queries use indexed fields for performance

---

## Next Steps

1. **Implement Rust backend** (`src-tauri/src/commands/fabric.rs`)
   - Connect to Fabric SDK
   - Call chaincode methods
   - Return JSON results

2. **Update TypeScript bridge** (`src/integration/flashbackCryptoBridge.ts`)
   - Implement all API methods
   - Call Tauri invoke commands
   - Parse and return results

3. **Test with local Fabric** 
   - Deploy test network with 3 peers
   - Create test channels (movies, tv-shows)
   - Test all query/mutation flows

4. **Integrate with UI components**
   - RepoBrowser uses new API
   - BroadcastSection manages subscriptions
   - Error messages bubble to user

---

## References

- Hyperledger Fabric Node.js SDK: https://hyperledger.github.io/fabric-sdk-node/
- Tauri Command Documentation: https://tauri.app/v1/guides/features/command
- Chaincode Development: See `FABRIC_IMPLEMENTATION_GUIDE.md`

