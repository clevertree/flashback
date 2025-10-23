# Multiple Clients Demo - Visual Guide

## The Problem (Before)

```
Terminal 1                    Terminal 2
┌────────────────────┐       ┌────────────────────┐
│ $ npm run tauri dev│       │ $ npm run tauri dev│
│                    │       │                    │
│ ✅ Port 3000       │       │ ❌ Error!          │
│ ✅ Client starts   │       │ Port 3000 taken!   │
└────────────────────┘       └────────────────────┘
```

## The Solution (After)

```
Terminal 1                    Terminal 2                    Terminal 3
┌────────────────────┐       ┌────────────────────┐       ┌────────────────────┐
│ $ npm run         │       │ $ npm run          │       │ $ npm run          │
│   tauri:dev:auto  │       │   tauri:dev:auto   │       │   tauri:dev:auto   │
│                   │       │                    │       │                    │
│ ✅ Port 3000      │       │ ⚠️  Port 3000 busy │       │ ⚠️  Port 3000 busy │
│ ✅ Client starts  │       │ ✅ Port 3001       │       │ ⚠️  Port 3001 busy │
│                   │       │ ✅ Client starts   │       │ ✅ Port 3002       │
│                   │       │                    │       │ ✅ Client starts   │
└────────────────────┘       └────────────────────┘       └────────────────────┘
```

## What You'll See

### Terminal 1 (First Client)
```bash
$ cd /Users/ari.asulin/dev/test/rust/client
$ npm run tauri:dev:auto

🚀 Starting Tauri Client with Auto-Port Detection
==================================================
✅ Using port 3000 for Next.js dev server

🎯 Starting Tauri dev server...

   ▲ Next.js 14.0.4
   - Local:        http://localhost:3000

✓ Ready in 1.2s
```

### Terminal 2 (Second Client)
```bash
$ cd /Users/ari.asulin/dev/test/rust/client
$ npm run tauri:dev:auto

🚀 Starting Tauri Client with Auto-Port Detection
==================================================
⚠️  Port 3000 is in use, trying next port...
✅ Using port 3001 for Next.js dev server

🎯 Starting Tauri dev server...

   ▲ Next.js 14.0.4
   - Local:        http://localhost:3001

✓ Ready in 1.2s
```

### Terminal 3 (Third Client)
```bash
$ cd /Users/ari.asulin/dev/test/rust/client
$ npm run tauri:dev:auto

🚀 Starting Tauri Client with Auto-Port Detection
==================================================
⚠️  Port 3000 is in use, trying next port...
⚠️  Port 3001 is in use, trying next port...
✅ Using port 3002 for Next.js dev server

🎯 Starting Tauri dev server...

   ▲ Next.js 14.0.4
   - Local:        http://localhost:3002

✓ Ready in 1.2s
```

## Visual Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Your Mac / PC                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────┐                              │
│  │  Server (Port 8080)  │                              │
│  │  ├─ Client List      │                              │
│  │  ├─ Chat Broadcast   │                              │
│  │  └─ Heartbeat Check  │                              │
│  └──────────┬───────────┘                              │
│             │                                           │
│    ┌────────┼────────┬────────────────────┐            │
│    │        │        │                    │            │
│    ▼        ▼        ▼                    ▼            │
│  ┌───┐   ┌───┐   ┌───┐                ┌───┐           │
│  │ A │   │ B │   │ C │      ...       │ N │           │
│  │   │   │   │   │   │                │   │           │
│  │:3K│   │:3K│   │:3K│                │:3K│           │
│  │ 0 │   │ 1 │   │ 2 │                │ N │           │
│  └───┘   └───┘   └───┘                └───┘           │
│ Client  Client  Client               Client           │
│   1       2       3                    N              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Complete Setup Flow

### Step-by-Step Visual

```
1. Start Server
   ┌─────────────────┐
   │ Terminal 1      │
   │ $ cargo run     │
   │ [server dir]    │
   │                 │
   │ 🚀 Server ON    │
   │ Port: 8080      │
   └─────────────────┘

2. Start Client 1
   ┌─────────────────┐
   │ Terminal 2      │
   │ $ npm run       │
   │ tauri:dev:auto  │
   │                 │
   │ ✅ Port 3000    │
   │ 🪟 Window opens │
   └─────────────────┘

3. Start Client 2
   ┌─────────────────┐
   │ Terminal 3      │
   │ $ npm run       │
   │ tauri:dev:auto  │
   │                 │
   │ ✅ Port 3001    │
   │ 🪟 Window opens │
   └─────────────────┘

4. Connect All
   Each client:
   ┌─────────────────────┐
   │ Server: 127.0.0.1   │
   │ Port: 8080          │
   │ [Connect]           │
   └─────────────────────┘

5. Chat!
   ┌──────────────────────┐
   │ Type message         │
   │ Press Enter          │
   │ → All see it! 💬     │
   └──────────────────────┘
```

## What Each Client Window Shows

```
┌─────────────────────────────────────────────┐
│ Flashback                      [_][□][X]│
├─────────────────────────────────────────────┤
│                                             │
│  Connection Settings                        │
│  Server IP: [127.0.0.1    ] Port: [8080]   │
│  Your IP:   [127.0.0.1    ] Port: [50001]  │
│  [✓ Connected to 127.0.0.1:8080]           │
│                                             │
│  💬 Group Chat                              │
│  ┌─────────────────────────────────────┐   │
│  │ 127.0.0.1:50002    10:30 AM        │   │
│  │ Hello from Client 2!                │   │
│  │                                     │   │
│  │         You        10:31 AM         │   │
│  │         Hi there!                   │   │
│  │                                     │   │
│  │ 127.0.0.1:50003    10:31 AM        │   │
│  │ Client 3 here!                      │   │
│  └─────────────────────────────────────┘   │
│  [Type a message...              ][Send]   │
│                                             │
│  Connected Clients (3)                      │
│  ┌─────────────────────────────────────┐   │
│  │ 🟢 127.0.0.1:50001              │   │
│  │ 🟢 127.0.0.1:50002              │   │
│  │ 🟢 127.0.0.1:50003              │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Network Diagram

```
Internet/Network: 127.0.0.1 (localhost)

Port 8080 (Server)
    ↓
    ├─→ TCP Connection ←─ Port 50001 (Client 1)
    │                     ↓
    ├─→ TCP Connection ←─ Port 50002 (Client 2)
    │                     ↓
    └─→ TCP Connection ←─ Port 50003 (Client 3)

Dev Servers (Next.js - separate from TCP)
    Port 3000 → Client 1 UI
    Port 3001 → Client 2 UI
    Port 3002 → Client 3 UI
```

## Quick Commands Reference

```bash
# Start server
cd /Users/ari.asulin/dev/test/rust/server && cargo run

# Start client (auto-port)
cd /Users/ari.asulin/dev/test/rust/client && npm run tauri:dev:auto

# Check what's using a port
lsof -i :3000

# Kill process on a port
lsof -ti :3000 | xargs kill -9

# See all your client instances
ps aux | grep tauri
```

## Success Indicators

### ✅ Everything Working
```
Server: "✅ New connection from: 127.0.0.1:XXXXX"
Client: "✓ Connected to 127.0.0.1:8080"
Chat:   Messages appear on all clients
```

### ❌ Something Wrong
```
Client: "Failed to connect: Connection refused"
→ Check if server is running

Client: "Port 3000 already in use"
→ Use npm run tauri:dev:auto instead

Server: "⏱️  Client timeout"
→ Normal if client closes without disconnect
```

## Tips

💡 **Want more clients?** Just keep opening terminals and running `npm run tauri:dev:auto`

💡 **Ports fill up?** Kill old processes: `pkill -f "next dev"`

💡 **Lost which client is which?** Check the "Your Port" in connection form

💡 **Can't remember the command?** It's in the README: `npm run tauri:dev:auto`
