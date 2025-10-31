# Next Phase: Friends List & Health Monitoring

**Last Updated:** October 31, 2025  
**Estimated Effort:** 5-9 weeks  
**Status:** Ready to implement

---

## Overview

Implement a **Friends List** feature with automatic online/offline monitoring. This complements the existing peer discovery system by providing persistent connections with status awareness.

---

## Core Features

### 1. Friends List Management
**What:** Persistent list of favorite peers (email-based)

**User Actions:**
- Add friend by email (discovered via relay or manual entry)
- Remove friend from list
- View friend status at a glance
- Manual refresh to check all friends

**Storage:** localStorage (client-side only)

---

### 2. Automatic Health Monitoring  
**What:** Background service that pings friends periodically

**Behavior:**
- Check every 60 seconds (configurable)
- Try cached socket first (last known address)
- On failure: query relay for updated socket
- Update status badge (online/offline/checking)

**Benefits:**
- Know who's online before clicking
- Automatic fallback to relay on address change
- No manual refresh needed

---

### 3. Smart Connection Fallback
**What:** Intelligent retry when visiting offline friends

**Flow:**
```
User clicks "Visit friend@example.com"
  ├─ Try cached socket (127.0.0.1:54321)
  │  └─ Success → Load files ✓
  │
  └─ Failure → Query relay for latest socket
     ├─ Try new socket (127.0.0.1:54999)
     │  └─ Success → Load files ✓
     │
     └─ Failure → Show "Friend is offline"
```

---

## Implementation Roadmap

### Phase 3.1: Storage & UI (1-2 weeks)

**Tasks:**
- [ ] Add `FriendsListConfig` to `client/src/app/config.ts`
  ```typescript
  interface FriendsListConfig {
    friends: Friend[]
    autoCheckInterval?: number      // default: 60000ms
    healthCheckTimeout?: number     // default: 5000ms
  }
  
  interface Friend {
    email: string
    displayName?: string
    lastSeen?: number
    cachedSocket?: {host: string, port: number}
    status: 'online' | 'offline' | 'checking' | 'unknown'
    addedAt: number
  }
  ```

- [ ] Create `FriendsList.tsx` component
  - Friend entries with status badges
  - "Add Friend" dialog (email + optional display name)
  - "Visit" button (navigates to RemoteHouse)
  - "Remove" button
  - Manual refresh button

- [ ] Add Friends tab to peer discovery section
  - Separate from "Available Peers" list
  - Toggle between tabs

- [ ] Implement localStorage persistence
  - Load on app start
  - Save on any change (add/remove/status update)

**Deliverables:**
✅ FriendsListConfig data model
✅ FriendsList UI component
✅ localStorage integration
✅ Basic add/remove functionality

---

### Phase 3.2: Health Check Service (2-3 weeks)

**Tasks:**
- [ ] Create `client/src-tauri/src/health_check.rs`
  - Async health check function
  - HTTP client for `/health` endpoint
  - Timeout handling (5s default)

- [ ] Implement periodic monitoring loop
  ```rust
  async fn start_health_check_loop(interval: Duration) {
    loop {
      for friend in get_friends_list() {
        check_friend_health(friend).await;
      }
      tokio::time::sleep(interval).await;
    }
  }
  ```

- [ ] Add relay query handler
  ```rust
  async fn query_relay_for_socket(email: &str) -> Result<Socket> {
    // GET relay.flashback.com/api/relay/broadcast/lookup?email=...
  }
  ```

- [ ] Integrate with Tauri event system
  - Emit `friend-status-changed` events
  - Frontend listens and updates UI
  - Emit `health-check-completed` after each round

- [ ] Socket caching logic
  - Store successful socket in friend config
  - Clear cache on health check failure
  - Update cache when relay returns new socket

**Deliverables:**
✅ Health check Rust module
✅ Periodic monitoring loop
✅ Relay integration
✅ Event system for status updates
✅ Socket caching

---

### Phase 3.3: Peer Server Enhancements (1-2 weeks)

**Tasks:**
- [ ] Add `/health` endpoint to Peer Server
  ```rust
  async fn handle_health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
      status: "ok",
      uptime: get_uptime_ms(),
      email: get_user_email(),
    })
  }
  ```

- [ ] Test health check endpoint
  - Verify 200 OK response
  - Test timeout behavior
  - Check performance impact

- [ ] Update relay tracker API (if needed)
  - Ensure `/api/relay/broadcast/lookup` returns latest socket
  - Add optional `status` field to response
  - Test error handling (404 if not broadcasting)

**Deliverables:**
✅ `/health` endpoint on Peer Server
✅ Relay lookup endpoint validated
✅ Error handling for offline peers

---

### Phase 3.4: RemoteHouse Integration (1-2 weeks)

**Tasks:**
- [ ] Update `RemoteHouse.tsx` to accept friend prop
  ```typescript
  interface RemoteHouseProps {
    friend?: Friend;
    initialSocket?: Socket;
  }
  ```

- [ ] Implement fallback connection logic
  ```typescript
  async function connectToFriend(friend: Friend) {
    // Try cached socket
    if (friend.cachedSocket) {
      const success = await tryConnect(friend.cachedSocket);
      if (success) return friend.cachedSocket;
    }
    
    // Fallback: query relay
    const newSocket = await queryRelayForSocket(friend.email);
    if (newSocket) {
      const success = await tryConnect(newSocket);
      if (success) {
        updateCachedSocket(friend.email, newSocket);
        return newSocket;
      }
    }
    
    throw new Error("Friend is offline");
  }
  ```

- [ ] Show connection status in UI
  - "Connecting..." spinner
  - "Connected to cached address" / "Connected via relay"
  - "Friend is offline" error state

- [ ] Handle socket switching mid-session
  - Detect connection drops
  - Automatically retry with relay fallback
  - Show reconnection UI

**Deliverables:**
✅ RemoteHouse fallback mechanism
✅ Connection status display
✅ Mid-session recovery
✅ User-friendly error messages

---

## API Changes Required

### New Peer Server Endpoint
```
GET /health

Response:
{
  "status": "ok",
  "uptime": 12345,
  "email": "user@example.com"
}

Status Codes:
- 200: Healthy
- 5xx: Unhealthy (should be treated as offline)
```

### Existing Relay Endpoint (no changes)
```
GET /api/relay/broadcast/lookup?email=user@example.com

Response:
{
  "email": "user@example.com",
  "socket": {
    "host": "192.168.1.100",
    "port": 54321
  },
  "timestamp": 1698700800000
}

Status Codes:
- 200: Peer found and online
- 404: Peer not currently broadcasting
```

---

## Configuration Options

Add to Settings UI:

```typescript
interface HealthCheckSettings {
  enabled: boolean;              // default: true
  intervalMs: number;            // default: 60000 (1 minute)
  timeoutMs: number;             // default: 5000 (5 seconds)
  autoCheckOnAppStart: boolean;  // default: true
}
```

Settings UI controls:
- **Check Interval:** Slider (30s - 5min)
- **Timeout:** Slider (1s - 30s)
- **Auto-check on startup:** Checkbox
- **Manual Refresh Now:** Button

---

## Testing Strategy

### Unit Tests
- Friend add/remove logic
- Status update calculations
- Socket caching behavior
- Health check retry logic

### Component Tests
- FriendsList rendering with various statuses
- Add friend dialog interaction
- Status badge display
- Visit button enabled/disabled logic

### E2E Tests
1. **Happy Path:**
   - Add friend to list
   - Wait for health check
   - See status change to "online"
   - Click "Visit" button
   - Load RemoteHouse with files

2. **Offline Path:**
   - Add friend (peer not broadcasting)
   - Wait for health check
   - See status "offline"
   - Visit button disabled
   - Show appropriate message

3. **Fallback Path:**
   - Add friend with cached socket
   - Friend stops/restarts peer server (new port)
   - Health check fails on cached socket
   - Query relay, get new socket
   - Status updates to "online"
   - Click "Visit" loads files with new socket

4. **Multiple Friends:**
   - Add 5 friends
   - Verify all health checks run
   - Status updates independently
   - No performance degradation

### Integration Tests
- Health check + relay query flow
- RemoteHouse + fallback mechanism
- Concurrent health checks (multiple friends)
- Event system (status changes propagate to UI)

---

## UI Mockup

```
┌─────────────────────────────────────────────┐
│ Friends List                    [+ Add]     │
├─────────────────────────────────────────────┤
│                                             │
│ [●] alice@example.com           [Visit] [×] │
│     Last seen: 2 minutes ago                │
│                                             │
│ [○] bob@example.com             [Visit] [×] │
│     Last seen: never                        │
│                                             │
│ [◐] charlie@example.com         [Visit] [×] │
│     Checking...                             │
│                                             │
│ [?] dave@example.com            [Visit] [×] │
│     Never checked                           │
│                                             │
│ [Manual Refresh]                            │
└─────────────────────────────────────────────┘

Status Indicators:
[●] Online (green)
[○] Offline (gray)
[◐] Checking (yellow)
[?] Unknown (gray, faded)
```

---

## User Scenarios

### Scenario 1: Discover and Add Friend
```
1. User sees "alice@example.com" in Available Peers
2. Clicks "Add to Friends"
3. Friend appears in Friends List with status "unknown"
4. Health check runs automatically after 60s
5. Status updates to "online" [●]
6. User can now visit alice's files
```

### Scenario 2: Friend Goes Offline
```
1. Friend "bob@example.com" is online [●]
2. Bob closes Flashback app
3. Next health check (60s later) fails
4. Status updates to "offline" [○]
5. "Visit" button disabled
6. User sees "Bob is offline" message
```

### Scenario 3: Friend Changes Address
```
1. Friend "charlie@example.com" online [●] at port 54321
2. Charlie restarts app (new port 54999)
3. Next health check tries cached socket (54321) → fails
4. Health check queries relay → gets new socket (54999)
5. Health check tries new socket → success
6. Status stays "online" [●]
7. Cached socket updated to 54999
8. User visits charlie → uses new socket automatically
```

---

## Security Considerations

### Privacy
- Friends list stored locally only (not synced to relay)
- Relay doesn't know about friendships
- Only visible to device owner

### Connection Attempts
- Health checks ping `/health` only (lightweight)
- No file access during health check
- Peer owner can log health check requests if desired

### Email-Based Identity
- No authentication required for health checks
- Relay provides socket info by email (public knowledge)
- Peer Server enforces its own access control (if any)

---

## Performance Optimization

### Health Check Batching
- Check all friends in parallel (up to 10 concurrent)
- Timeout prevents hanging checks
- Stagger checks slightly to avoid thundering herd

### Caching Strategy
- Cache successful sockets until failure
- Minimize relay queries (only on failure)
- Clear cache on prolonged offline (e.g., 1 hour)

### UI Updates
- Debounce rapid status changes
- Batch UI updates for multiple friends
- Use React memoization to prevent re-renders

---

## Dependencies

### New Dependencies
```toml
# Cargo.toml
tokio = { version = "1.35", features = ["time"] }
reqwest = { version = "0.11", features = ["json"] }
```

```json
// package.json (no new dependencies)
```

### Existing Dependencies (reused)
- Axum (peer server)
- Tauri (IPC events)
- React (UI components)
- localStorage (persistence)

---

## Estimated Timeline

| Phase | Tasks | Effort | Dependencies |
|-------|-------|--------|--------------|
| 3.1   | Storage & UI | 1-2 weeks | None |
| 3.2   | Health Check Service | 2-3 weeks | Phase 3.1 |
| 3.3   | Peer Enhancements | 1-2 weeks | Phase 3.2 |
| 3.4   | RemoteHouse Integration | 1-2 weeks | Phase 3.3 |

**Total:** 5-9 weeks (overlapping possible in phases 3.3 and 3.4)

---

## Success Metrics

### Phase 3.1 Complete
✅ Friends list UI works
✅ Can add/remove friends
✅ localStorage persists changes
✅ Manual refresh button functional

### Phase 3.2 Complete
✅ Health checks run automatically
✅ Status updates in real-time
✅ Relay fallback works
✅ Socket caching functional

### Phase 3.3 Complete
✅ `/health` endpoint responds
✅ Relay lookup returns correct data
✅ Error handling tested

### Phase 3.4 Complete
✅ RemoteHouse visits friends
✅ Fallback mechanism works
✅ Connection status displayed
✅ Mid-session recovery functional

---

## Next Steps

1. **Review this plan** with team (30 min)
2. **Start Phase 3.1** (Storage & UI)
3. **Create branch** `feature/friends-list`
4. **Follow implementation roadmap** step by step

---

## See Also

- **FEATURES_IMPLEMENTED.md** - What's already built
- **ARCHITECTURE.md** - System design overview
- **QUICK_START.md** - Development environment setup
