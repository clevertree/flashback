# Phase 3 Clarification Summary

**Date:** October 30, 2025  
**Phase:** 3 - Friends List & Health Checks  
**Status:** Specification Complete, Ready for Implementation

---

## User's Phase 3 Clarification

> "The relay tracker already provides a client socket list based on email, so users can already find each other. Client to client peer discovery sounds good. Once a peer is discovered by relay server or otherwise, it can be added to a 'friends list' based on email, which pings the connection for a health check to see if it's online, and if not, pings the relay server for the most recent broadcast socket returned by the server and then retests the connection. If that fails, the friend is offline. each friend on the friend list shows a button to 'visit' just like the peer list."

---

## Key Clarifications Documented

### 1. Discovery Mechanism ✅
- **Already Works (Phase 2):** Relay Tracker provides client socket list by email
- **No additional discovery needed** - use existing relay functionality
- Users find each other via Relay Tracker's client list

### 2. Friends List Concept ✅
- **Optional persistence layer** on top of Relay Tracker
- Users can add peers to a **"Friends List"** (email-based)
- Friends List is **locally stored** (localStorage)
- Each friend entry remembers:
  - Email address (unique identifier)
  - Cached socket (IP + port from last broadcast)
  - Online/offline status
  - Last seen timestamp

### 3. Health Check Algorithm ✅
Exactly as described:

```
For each friend:
  1. Try connection to cached socket (IP:port)
     ├─ Success → Mark online [●], update timestamp, done
     └─ Failure → Proceed to step 2

  2. Query Relay Tracker for latest socket by email
     ├─ Relay returns new socket → Try connection
     │  ├─ Success → Mark online [●], cache new socket, done
     │  └─ Failure → Proceed to step 3
     └─ Relay returns nothing → Mark offline [○], done

  3. Mark friend as offline [○]
```

### 4. Friends List UI ✅
- Shows all friends with status badges
- **"Visit" button** for each friend (just like peer list)
- **"Add Friend" dialog** to add by email
- **"Remove Friend" button** to delete
- Status indicators: online [●], offline [○], checking [◐], unknown [?]

### 5. Visit Fallback ✅
When visiting a friend:
1. Try RemoteHouse with cached socket
2. If fails → Query relay for new socket
3. If new socket works → Update cache, show files
4. If all fails → Show error message

---

## Architecture Impact

### Three-Layer Model

```
Discovery Layer (Relay Tracker)
  ↓
  Provides list of online peers by email
  ↓
  (User adds peer to Friends List)
  ↓
Relationship Layer (Friends List)
  ↓
  Stores email + cached socket locally
  Monitors online/offline status
  ↓
  (User clicks "Visit")
  ↓
Connection Layer (RemoteHouse + Fallback)
  ↓
  Try cached socket
  Fallback to relay if needed
  Show files
```

### What This Enables

1. **No continuous discovery needed**
   - Relay only queried when health check fails
   - Reduces load on centralized relay
   - Works with relay downtime (cached sockets)

2. **Persistent relationships**
   - Friends stay in list even if offline
   - Status updates automatically
   - No re-adding required

3. **Resilient connections**
   - Direct socket preferred (faster)
   - Relay fallback when needed
   - Graceful offline handling

4. **Network efficiency**
   - Minimal relay queries (only on failure)
   - Direct peer connections (no relay proxy)
   - Periodic health checks (not continuous)

---

## Implementation Checklist

### Phase 3.1: Storage & UI
- [ ] Add `FriendsListConfig` to `client/src/app/config.ts`
- [ ] Create `FriendsList` React component
  - Display all friends with status
  - Add/remove friend UI
  - Manual refresh button
- [ ] Add "Friends" tab to peer discovery section
- [ ] localStorage persistence

### Phase 3.2: Health Check Service
- [ ] Create `client/src-tauri/src/health_check.rs` Rust module
  - Implement periodic timer (configurable, default 60s)
  - For each friend: ping cached socket
  - On failure: query relay for new socket
  - Update friend status
- [ ] Integrate with Tauri event system
- [ ] Emit `friends-status-updated` event on changes

### Phase 3.3: Relay Integration
- [ ] Add `/health` endpoint to Peer Server
  - GET /health → { status: "ok", email, uptime }
  - Lightweight response
  - No authentication needed
- [ ] Query relay endpoint for latest socket by email
  - GET /api/clients/socket?email=user@example.com
  - Use in health check fallback

### Phase 3.4: RemoteHouse Enhancements
- [ ] Accept `friend` prop (in addition to `peer`)
- [ ] Implement socket fallback mechanism
  - Try cached socket first
  - Query relay if fails
  - Update cache if new socket works
- [ ] Show connection status in header

---

## Configuration

### New Settings

```typescript
// In Settings UI
{
  // Health Check Interval (milliseconds)
  healthCheckInterval: 60000,        // Default: 60 seconds
  
  // Health Check Timeout
  healthCheckTimeout: 5000,          // Default: 5 seconds
  
  // Auto-check on app start
  autoCheckOnStart: true
}
```

### API Endpoints

**Peer Server (new)**
```
GET /health
Response: { status: "ok", email: "user@example.com", uptime: 12345 }
```

**Relay Tracker (new query)**
```
GET /api/clients/socket?email=user@example.com
Response: { email, socket: { host, port }, timestamp }
Error 404: Not currently broadcasting
```

---

## Example User Flow

### Setup Phase (Once)
```
1. User A broadcasts files (BroadcastSection)
   └─ Peer Server starts, socket emitted to relay
   
2. User B opens Flashback, queries relay
   └─ Sees User A in "Available Peers"
   
3. User B clicks "Add to Friends" on User A
   └─ Friend saved: email=user.a@example.com
   
4. Health check immediately pings User A
   └─ Status: online [●]
```

### Active Phase (Recurring)
```
Every 60 seconds (default):
  ├─ Health check runs for all friends
  ├─ Pings User A at cached socket
  ├─ On success: status stays online [●]
  └─ On failure: queries relay for new socket
     ├─ New socket found: tries connection
     │  ├─ Success: online [●], cache updated
     │  └─ Failure: offline [○]
     └─ No socket: offline [○]
```

### Visit Phase (On-demand)
```
1. User B clicks "Visit user.a@example.com"
   
2. RemoteHouse loads with cached socket
   ├─ Try direct connection
   ├─ Success → Show files ✓
   └─ Failure → Proceed to step 3
   
3. Query relay for latest socket
   ├─ Relay has new socket
   └─ Try connection
      ├─ Success → Show files ✓, update cache
      └─ Failure → "Friend is offline" error
```

### Offline Phase (When peer is down)
```
1. User A shuts down Flashback
   
2. Next health check (60s later)
   ├─ Pings cached socket → Fails
   ├─ Queries relay → No socket
   └─ Status: offline [○]
   
3. User B sees User A with offline badge [○]
   └─ "Visit" button still exists but marked disabled
   
4. User A comes back online
   ├─ Broadcasts new socket to relay
   ├─ Next health check pings and succeeds
   └─ Status: online [●]
```

---

## Benefits of This Design

| Benefit | Reason |
|---------|--------|
| **Resilient** | Works when relay is down (cached sockets) |
| **Efficient** | Minimal relay queries (only on failure) |
| **Fast** | Direct peer connections (no relay proxy) |
| **Scalable** | Relay not in every data transfer path |
| **Private** | Friends list never shared with relay |
| **Simple** | Email-based, no complex authentication |
| **Familiar** | Like "Friends" in traditional apps |

---

## Files Created/Updated

### New Documentation
- ✅ `PHASE_3_FRIENDS_LIST.md` - Complete specification
- ✅ `PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md` - Quick reference
- ✅ `ARCHITECTURE_INDEX.md` - Updated with Phase 3 docs

### Future Implementation Files (Phase 3)
- 🔜 `client/src-tauri/src/health_check.rs` - Health check service
- 🔜 Updates to `client/src/app/config.ts` - Friends list config
- 🔜 New component: `FriendsList.tsx`
- 🔜 Updates to `RemoteHouse.tsx` - Fallback mechanism
- 🔜 `/health` endpoint in `http_server.rs`

---

## Next Steps

### Phase 2 Completion
- ✅ E2E tests written for Peer Server
- ✅ Architecture documented
- ⏳ (Optional) Verify tests compile, add data-cy attributes

### Phase 3 Planning (Ready to Start)
- ✅ Specification complete
- ✅ User flows documented
- ✅ Implementation checklist created
- ⏳ Choose to start implementation or continue with Phase 2 verification

---

## Relationship to Existing Components

```
Relay Tracker (Centralized)
  ↓ provides socket by email
FriendsList Storage (Local)
  ├─ /health endpoint ← pings for health check
  └─ Health Check Service (Rust/Async)
      ├─ pings /health
      └─ queries relay if fails

RemoteHouse (File Browser)
  ├─ accepts friend parameter
  ├─ tries cached socket
  ├─ fallback: queries relay
  └─ shows files when connected
```

---

## Key Design Decisions

1. **Email as unique identifier**
   - Simple, familiar, no new accounts
   - Works with existing relay tracker

2. **Cached sockets reduce relay load**
   - Most health checks use cache
   - Relay only hit on failure
   - Scales better than constant polling

3. **Friends list is local only**
   - No server-side sync needed
   - Each device has independent friends list
   - Privacy-preserving

4. **Async health checks**
   - Don't block UI
   - Run in background
   - Configurable interval

5. **Graceful offline handling**
   - Friend stays in list even if offline
   - Automatic retry on next health check
   - Manual refresh available

---

## Related Documentation

- **PHASE_3_FRIENDS_LIST.md** - Full specification with all details
- **PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md** - Quick lookup guide
- **COMPLETE_ARCHITECTURE_OVERVIEW.md** - System context
- **RELAY_VS_PEER_QUICK_REFERENCE.md** - Component comparison

---

**Status:** 🟢 **Phase 3 specification complete and ready for implementation**

**Documentation:** 📚 **Comprehensive - Phase 3 fully documented with examples, diagrams, and implementation roadmap**

