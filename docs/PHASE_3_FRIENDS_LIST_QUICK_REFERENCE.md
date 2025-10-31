# Phase 3: Friends List - Quick Reference

## What is Phase 3?

Add a **Friends List** feature where users can:
- **Add friends** by email (discovered via Relay Tracker or entered manually)
- **Monitor online status** via periodic health checks
- **Visit friends** with automatic fallback when peer server is offline

## Key Differences from Phase 2

| Feature | Phase 2 | Phase 3 |
|---------|---------|---------|
| **Peer Discovery** | Query relay server for clients | Same + remember friends |
| **Connection** | Direct socket from relay | Try cached socket first |
| **Status** | None | Real-time online/offline |
| **Fallback** | None | Auto-query relay if socket fails |
| **Persistence** | None | Friends list saved locally |

## Quick Data Model

```typescript
interface Friend {
  email: string              // user@example.com (unique)
  displayName?: string       // "Alice" (optional)
  cachedSocket?: {           // Last known broadcast socket
    host: string             // 127.0.0.1 (only their peer server)
    port: number             // e.g., 54321
  }
  status: 'online' | 'offline' | 'checking' | 'unknown'
  lastSeen?: number          // Timestamp
}
```

## Health Check Flow (Simple)

```
┌─ Every 60 seconds (default)
│
├─ For each friend:
│  ├─ Ping their Peer Server at cached socket
│  │  ├─ Success: status = online, cache updated
│  │  └─ Fail: proceed to fallback
│  │
│  └─ If failed, query Relay Tracker:
│     ├─ "Give me latest socket for user@example.com"
│     ├─ Try new socket
│     │  ├─ Success: status = online, cache updated
│     │  └─ Fail: status = offline
│     └─ If relay has no socket: status = offline
│
└─ UI updates to show [●] online or [○] offline
```

## Implementation Tasks (Phase 3 Components)

### 3.1 Storage & UI
- [ ] Add friends array to config (localStorage)
- [ ] Create FriendsList React component
- [ ] Add/remove friend UI
- [ ] Display friends with status badges

### 3.2 Health Check Engine
- [ ] Create Rust health check module
- [ ] Implement periodic timer
- [ ] Ping `/health` endpoint on peer servers
- [ ] Handle retry + relay fallback

### 3.3 Relay Integration
- [ ] Query relay for latest socket by email
- [ ] Handle relay unavailable gracefully
- [ ] Cache relay responses temporarily

### 3.4 Visit Fallback
- [ ] RemoteHouse: try cached socket first
- [ ] If fails: query relay for new socket
- [ ] If new socket works: update cache
- [ ] Show connection status in RemoteHouse

## User Scenarios

### Scenario 1: Add Friend (Both Online)
```
1. User A opens Relay Tracker peer list
2. Sees "user.b@example.com" broadcasting
3. Clicks "Add to Friends" → saved locally
4. Health check immediately pings User B
5. Status shows [●] online
```

### Scenario 2: Visit Friend (Both Online)
```
1. User A clicks "Visit user.b@example.com" in Friends List
2. Health check has cached User B's socket (host:port)
3. RemoteHouse connects directly to cached socket
4. Files load successfully
```

### Scenario 3: Visit Friend (Friend Offline, Then Online)
```
1. User A clicks "Visit user.b@example.com"
2. Cached socket fails (User B is offline or moved)
3. System queries Relay Tracker for latest socket
4. Relay returns empty (User B not broadcasting)
5. Show error: "user.b@example.com is not currently broadcasting"

[Later...]

6. User B starts broadcasting from new location
7. Relay has new socket
8. User A retries "Visit" (or auto-refresh triggers)
9. Health check queries relay, gets new socket
10. RemoteHouse connects successfully
```

### Scenario 4: Health Check - Relay Unavailable
```
1. Relay Tracker server is down
2. Health check tries cached socket first
3. If cached socket works: stays online [●]
4. If cached socket fails: stays offline [○]
   (No fallback to relay since it's unavailable)
5. When relay comes back up: next health check queries it
```

## Configuration Settings

**Health Check Interval** (default: 60000ms = 60 seconds)
- How often to ping all friends
- Shorter = more up-to-date status, more network traffic
- Longer = less traffic, status updates slower

**Health Check Timeout** (default: 5000ms = 5 seconds)
- How long to wait for peer server response
- If no response after timeout: try relay fallback
- Too long = UX feels slow, too short = false offline statuses

## API Endpoints Needed

### Peer Server (friend's Rust app) - NEW
```
GET /health HTTP/1.1
Host: 127.0.0.1:54321

Response (200 OK):
{
  "status": "ok",
  "email": "user@example.com",
  "uptime": 12345
}
```

### Relay Tracker (centralized server) - EXISTING, NEW QUERY
```
GET /api/clients/socket?email=user@example.com

Response (200 OK):
{
  "email": "user@example.com",
  "socket": {
    "host": "192.168.1.50",
    "port": 54321
  },
  "timestamp": 1698700800000
}

Response (404 Not Found):
- Client not currently broadcasting
```

## Component Interaction

```
FriendsList Component
├─ Displays all friends with status badges
├─ "Visit friend@example.com" button
│  └─ Calls RemoteHouse with fallback mechanism
├─ "Remove friend@example.com" button
├─ "Add Friend" dialog
└─ "Manual Refresh" button

Health Check Service (Rust/background)
├─ Runs timer every 60s
├─ For each friend:
│  ├─ Ping cached socket (if available)
│  ├─ Query relay if failed
│  └─ Update friend status
└─ Emits event: "friends-status-updated"

RemoteHouse Component
├─ Receives friend + cached socket
├─ Tries connection to cached socket
├─ On failure: queries relay for new socket
├─ On failure: shows error
└─ On success: displays friend's files
```

## What Stays the Same (Phase 2)

- ✅ Peer Server HTTP endpoints (`/api/files`, `/content/*`, `/download/*`)
- ✅ RemoteHouse file browser UI and file preview
- ✅ BroadcastSection and socket emission to relay
- ✅ Relay Tracker client list endpoint
- ✅ Settings and configuration system

## What's New (Phase 3)

- 🆕 Friends List storage (localStorage)
- 🆕 FriendsList React component
- 🆕 Health check background service (Rust)
- 🆕 `/health` endpoint on Peer Servers
- 🆕 Relay fallback when peer socket fails
- 🆕 Status indicators (online/offline/checking)
- 🆕 Health check settings (interval, timeout)

## Status Icons

```
[●] Online       - Friend is broadcasting and responding
[○] Offline      - Friend not broadcasting or not responding
[◐] Checking     - Health check in progress
[?] Unknown      - New friend, never checked yet
```

## Common Questions

**Q: How do users discover each other?**
A: Via Relay Tracker (Phase 2 feature). Friends List just remembers them.

**Q: What if friend is offline?**
A: Status shows [○] offline. "Visit" button is disabled. Try again later when they come online.

**Q: What if Relay Tracker is down?**
A: Health checks use cached socket. If socket fails, friend stays offline. No new friends can be discovered until relay is back.

**Q: Can I use a friend's files without them being in my Friends List?**
A: Yes, if you have their socket (IP + port) from elsewhere, you can visit directly. Friends List is just a convenience.

**Q: Are friends synced across my devices?**
A: No, Friends List is stored locally on each device. Use Relay Tracker to discover friends on other devices.

**Q: Can I see when a friend is looking at my files?**
A: No, your Peer Server just serves files. No tracking. Health checks are minimal (`/health` ping only).

**Q: What happens if a friend moves to a different network?**
A: Their new socket gets broadcast to Relay Tracker. Next health check queries relay and gets the new socket. Works automatically.

**Q: Can friends see each other's Friends Lists?**
A: No, Friends List is private and stored locally only.

## See Also

- `PHASE_3_FRIENDS_LIST.md` - Full Phase 3 specification
- `COMPLETE_ARCHITECTURE_OVERVIEW.md` - System architecture
- `SERVER_ARCHITECTURE.md` - Relay Tracker details
