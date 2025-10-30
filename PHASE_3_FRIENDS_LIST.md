# Phase 3: Friends List & Health Check System

## Overview

Phase 3 implements a **friends list** feature that complements the existing peer discovery system. Users can:
1. Discover peers via **Relay Tracker** (centralized client socket list by email)
2. Add discovered peers to a **Friends List** (persistent, email-based)
3. Monitor peer **online status** via health checks
4. **Visit friends** with automatic fallback when peer server is offline

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Flashback Client (Tauri App)            │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │     Relay Tracker Discovery (Phase 2)  │    │
│  │  - Connect to relay.flashback.com      │    │
│  │  - Broadcast socket (port + email)     │    │
│  │  - Query client list by email          │    │
│  └────────────────────────────────────────┘    │
│                     ▼                            │
│  ┌────────────────────────────────────────┐    │
│  │    Friends List Management (Phase 3)   │    │
│  │  - Add/remove friends (email-based)    │    │
│  │  - Persistent storage (localStorage)   │    │
│  │  - Display friend list with status     │    │
│  └────────────────────────────────────────┘    │
│                     ▼                            │
│  ┌────────────────────────────────────────┐    │
│  │      Health Check System (Phase 3)     │    │
│  │  - Ping peer directly (cached address) │    │
│  │  - On failure: query relay for latest  │    │
│  │  - Retry connection with new socket    │    │
│  │  - Update friend status (online/offline)│   │
│  └────────────────────────────────────────┘    │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │    Peer Server (Phase 2 - unchanged)   │    │
│  │  - HTTP file serving on ephemeral port │    │
│  │  - Emits socket via event              │    │
│  └────────────────────────────────────────┘    │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Friends List Data Model

Friends are stored with their last known contact information:

```typescript
interface Friend {
  email: string                    // Unique identifier
  displayName?: string             // Optional display name
  lastSeen?: number               // Timestamp of last successful connection
  cachedSocket?: {
    host: string                  // 127.0.0.1 (peer server only on their machine)
    port: number                  // Last known port from broadcast
  }
  status: 'online' | 'offline' | 'checking' | 'unknown'
  addedAt: number                 // Timestamp when friend was added
}

interface FriendsListConfig {
  friends: Friend[]               // Array of friends
  autoCheckInterval?: number      // Health check frequency (ms), default 60000
  healthCheckTimeout?: number     // Connection timeout (ms), default 5000
}
```

### 2. Friend Discovery Flow

```
User discovers peer via Relay Tracker
        ▼
User adds peer to Friends List (stores email + display name)
        ▼
Health check system begins monitoring
        ▼
Friend appears in Friends List with status badge
        ▼
User can click "Visit" button to browse files
```

### 3. Health Check Algorithm

```
┌─────────────────────────┐
│  Health Check Trigger   │
│ (periodic or on-demand) │
└────────┬────────────────┘
         ▼
┌──────────────────────────────────────┐
│ Try direct connection to cached      │
│ socket (host:port from last broadcast)
└────────┬─────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Success   Failure
   │         │
   │         ▼
   │    ┌──────────────────────────┐
   │    │ Query Relay Tracker for  │
   │    │ latest socket by email   │
   │    └────────┬─────────────────┘
   │             ▼
   │         ┌──────────────────┐
   │         │ Try new socket   │
   │         │ from relay       │
   │         └────┬─────────────┘
   │              │
   │          ┌───┴────┐
   │          ▼        ▼
   │       Success   Failure
   │         │        │
   │         ▼        ▼
   └────────→ Update status (online/offline)
              Cache new socket if successful
```

### 4. Friend Status Indicators

- **online** (green) - Successfully pinged within last interval
- **offline** (gray) - Failed all health check attempts
- **checking** (yellow) - Currently performing health check
- **unknown** (gray, faded) - No status yet (new friend or never pinged)

## Component Structure

### FriendsList Component
```
<FriendsList>
  ├─ Friend entries (email-based)
  │  ├─ Status indicator (online/offline/checking)
  │  ├─ Email display
  │  ├─ Display name (if set)
  │  ├─ Last seen timestamp
  │  ├─ "Visit" button → navigate to files
  │  └─ "Remove" button → delete from list
  │
  ├─ Add Friend dialog
  │  ├─ Email input
  │  ├─ Display name input (optional)
  │  └─ Add button
  │
  └─ Manual refresh button (trigger all health checks)
```

### Integration Points

1. **PeerList Component** (Phase 2)
   - Show both Relay Tracker peers and Friends List
   - Add "Add to Friends" button on peer entries
   - Separate tabs: "Available Peers" | "Friends"

2. **RemoteHouse Component** (Phase 2)
   - Accept `friend` prop in addition to peer
   - When visiting friend: first try cached socket, then fallback to relay

3. **SettingsSection Component** (Phase 2)
   - Add health check interval setting
   - Add health check timeout setting
   - Show friends list size

## Implementation Phases

### Phase 3.1: Friends List Storage & UI
- [ ] Add `FriendsListConfig` to `client/src/app/config.ts`
- [ ] Create `FriendsList` React component with add/remove/display
- [ ] Add Friends tab to peer discovery section
- [ ] Implement localStorage persistence for friends list

### Phase 3.2: Health Check System
- [ ] Create Rust health check handler in `client/src-tauri/src/health_check.rs`
- [ ] Implement periodic health check loop with configurable interval
- [ ] Add Relay Tracker query handler to get latest socket for email
- [ ] Integrate health check with Tauri event system

### Phase 3.3: UI Integration & Status Display
- [ ] Add status indicators to friend entries
- [ ] Show "checking" state during health checks
- [ ] Display "last seen" timestamp
- [ ] Add manual refresh button
- [ ] Show error messages for failed health checks

### Phase 3.4: RemoteHouse Enhancements
- [ ] Update RemoteHouse to accept friend + fallback mechanism
- [ ] Try cached socket first, then relay socket
- [ ] Handle switching between sockets during session
- [ ] Show connection status in RemoteHouse header

## API / Relay Tracker Integration

### Query Latest Socket
```
GET /api/clients/socket?email=user@example.com

Response:
{
  "email": "user@example.com",
  "socket": {
    "host": "192.168.1.100",  // May differ from local 127.0.0.1
    "port": 54321
  },
  "timestamp": 1698700800000,
  "status": "online"
}

Error: 404 if client not currently broadcasting
```

### Peer Server Health Endpoint (new)
```
GET http://127.0.0.1:{port}/health

Response: 
{
  "status": "ok",
  "uptime": 12345,  // milliseconds
  "email": "user@example.com"
}

Status: 200 if healthy, 5xx if not
```

## Security Considerations

1. **Email-based identification only**
   - No user authentication required for health checks
   - Relay Tracker provides current socket info by email
   - Peers maintain their own access control

2. **Connection attempts**
   - Health checks only ping `/health` endpoint (lightweight)
   - No actual file access during health check
   - Peer owner can see health check attempts in logs

3. **Socket caching**
   - Cache prevents constant relay queries
   - Cache invalidates when health check fails
   - Force refresh via manual button if needed

4. **Privacy**
   - Friends list stored locally in client
   - Only visible to device owner
   - Relay Tracker doesn't track friendships

## Configuration

### Health Check Settings (in Settings)

```
┌──────────────────────────────────────┐
│ Health Check Configuration           │
├──────────────────────────────────────┤
│                                      │
│ Check Interval:  [60000 ms]  ▼      │
│ (how often to ping friends)          │
│                                      │
│ Timeout:         [5000 ms]   ▼      │
│ (how long to wait for response)      │
│                                      │
│ ☑ Auto-check on app start           │
│                                      │
│ [Manual Refresh Now] button          │
│                                      │
└──────────────────────────────────────┘
```

## Fallback Behavior

### When Visiting a Friend

```
User clicks "Visit friend@example.com"
    ▼
RemoteHouse loads with cached socket (if available)
    ▼
Try connection to cached address
    ▼
    ├─ Success → Show files ✓
    │
    └─ Failure
        ▼
        Query Relay Tracker for latest socket
        ▼
        Try new address
        ▼
        ├─ Success → Show files ✓
        ├─ Failure → Show error: "Friend is offline"
        │
        └─ Relay returns no socket → "Friend not currently broadcasting"
```

## Status Badge Display

```
Online     [●] user@example.com → "Visit" button active
Offline    [○] user@example.com → "Visit" button disabled + "Offline" label
Checking   [◐] user@example.com → "Visit" button disabled + "Checking..." label
Unknown    [?] user@example.com → "Visit" button active (try anyway)
```

## Example User Flow

```
1. User A broadcasts their files via BroadcastSection
   └─ Peer Server starts on ephemeral port
   └─ Socket emitted to Relay Tracker

2. User B sees User A in "Available Peers" list from Relay
   └─ User B clicks "Add to Friends"
   └─ Friend email saved: user.a@example.com

3. Health check system pings User A periodically
   ├─ Success → Status: online [●]
   └─ Failure → Status: offline [○]

4. User B clicks "Visit user.a@example.com" in Friends List
   ├─ Try cached socket from last broadcast
   ├─ If fails → Query relay for latest socket
   └─ If succeeds → Load RemoteHouse with User A's files

5. User A stops broadcasting (closes app)
   └─ Next health check fails
   └─ Status updates to offline [○]
   └─ "Visit" button disabled

6. User A broadcasts again from different location
   └─ New socket sent to Relay Tracker
   └─ Next health check queries relay, gets new socket
   └─ User B can visit again with new socket
```

## Data Flow Diagram

```
┌──────────────────┐
│  Relay Tracker   │
│  (Next.js server)│
│                  │
│ • Client list    │
│ • Socket cache   │
│ • Email index    │
└────────┬─────────┘
         │
         │ Query latest socket
         │ (on health check fail)
         │
┌────────▼──────────────────┐
│    Flashback Client        │
│                            │
│ ┌────────────────────────┐ │
│ │  Friends List Storage  │ │
│ │  • email               │ │
│ │  • cached socket       │ │
│ │  • status              │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │  Health Check Loop     │ │
│ │  • Timer (60s default) │ │
│ │  • Ping /health        │ │
│ │  • Update status       │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │   RemoteHouse Visit    │ │
│ │  • Try cached socket   │ │
│ │  • Fallback: relay     │ │
│ │  • Load files          │ │
│ └────────────────────────┘ │
│                            │
└────────┬──────────────────┘
         │
         │ Health check
         │ ping /health
         │
┌────────▼──────────────────┐
│  Friend's Peer Server      │
│  (Rust/Axum on their PC)   │
│                            │
│ • /health endpoint         │
│ • /api/files endpoint      │
│ • /content/* endpoints     │
└────────────────────────────┘
```

## Testing Strategy

### Unit Tests
- Friend add/remove/update logic
- Status update calculations
- Socket caching behavior
- Health check retry logic

### Component Tests
- FriendsList rendering
- Add friend dialog interaction
- Status indicator display
- Visit button navigation

### E2E Tests
- Add friend to list
- Health check success path
- Health check failure + relay fallback
- Visit friend with cached socket
- Visit friend when offline
- Remove friend

### Integration Tests
- Health check + Relay Tracker query
- RemoteHouse + fallback mechanism
- Multiple friends health checks (concurrent)
- Friend status updates in real-time

## Notes

- **No authentication** between peers: any client can try to connect to a peer server
- **Relay Tracker is optional**: if relay is unavailable, only cached sockets work
- **Health checks are lightweight**: only ping `/health`, not full file browsing
- **Friends list is local**: not synced across devices or shared with others
- **Automatic updates**: friend status updates in real-time as health checks run

## See Also

- `PHASE_2_IMPLEMENTATION.md` - File sharing foundation
- `COMPLETE_ARCHITECTURE_OVERVIEW.md` - Overall system design
- `ARCHITECTURE_INDEX.md` - Documentation navigation
