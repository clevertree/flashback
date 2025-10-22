# Quick Start Guide - Chat Feature

## Start Everything in 3 Commands

### Terminal 1 - Start Server
```bash
cd /Users/ari.asulin/dev/test/rust/server
cargo run
```

### Terminal 2 - Start Client 1
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

### Terminal 3 - Start Client 2
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

**Note:** Using `tauri:dev:auto` automatically finds an available port for each client.
See `RUNNING_MULTIPLE_CLIENTS.md` for details.

## Use the Chat

1. **Connect** both clients:
   - Click "Connect to Server" in each window
   - Default settings work: `127.0.0.1:8080`

2. **Send a message**:
   - Type in the message box at the bottom
   - Press Enter or click "Send"

3. **See it appear** on both clients instantly!

## What You'll See

### Server Logs
```
✅ New connection from: 127.0.0.1:50001
📝 Registered client: 127.0.0.1:50001
💓 Received pong from server
💬 Chat from 127.0.0.1:50001: Hello!
💬 Chat from 127.0.0.1:50002: Hi there!
```

### Client Window
```
┌────────────────────────────────┐
│ 💬 Group Chat                  │
├────────────────────────────────┤
│ 127.0.0.1:50001    10:30 AM   │
│ Hello!                         │
│                                │
│         You        10:31 AM    │
│         Hi there!              │
├────────────────────────────────┤
│ Type a message...     [Send]   │
└────────────────────────────────┘
```

## Features at a Glance

✅ **Real-time group chat**  
✅ **No message storage** (privacy!)  
✅ **Automatic heartbeat** (60s)  
✅ **Connection timeout** (120s)  
✅ **Multiple clients** supported  
✅ **Clean UI** with dark theme  

## That's It!

Simple, fast, private group chat with persistent connections and heartbeat monitoring.

See `CHAT_FEATURE.md` for complete documentation.
