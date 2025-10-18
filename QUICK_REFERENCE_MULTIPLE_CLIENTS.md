# Quick Reference Card - Multiple Clients

## The One Command You Need

```bash
npm run tauri:dev:auto
```

That's it! This works for any number of client instances.

---

## Complete Setup (3 Terminals)

### Terminal 1 → Server
```bash
cd /Users/ari.asulin/dev/test/rust/server
cargo run
```

### Terminal 2 → Client 1
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

### Terminal 3 → Client 2
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

---

## What You'll See

```
Terminal 2:
✅ Using port 3000 for Next.js dev server
🪟 Client window opens

Terminal 3:
⚠️  Port 3000 is in use, trying next port...
✅ Using port 3001 for Next.js dev server
🪟 Client window opens
```

---

## In Each Client Window

1. Click **"Connect to Server"**
2. Default settings work: `127.0.0.1:8080`
3. Type message in chat box
4. Press **Enter** or click **Send**
5. See message on all clients!

---

## Troubleshooting One-Liners

```bash
# Script not working?
chmod +x client/start-client.sh

# Too many ports in use?
pkill -f "next dev"

# Check what's using port 3000
lsof -i :3000

# Kill process on port 3000
lsof -ti :3000 | xargs kill -9
```

---

## Why This Works

- Script auto-detects available ports
- Updates Tauri config temporarily
- Restores config on exit
- No manual setup needed!

---

## Full Documentation

- `MULTIPLE_CLIENTS_SOLVED.md` - Complete solution
- `PORT_CONFLICT_RESOLUTION.md` - Technical details
- `RUNNING_MULTIPLE_CLIENTS.md` - All methods
- `MULTIPLE_CLIENTS_VISUAL_GUIDE.md` - Diagrams

---

**Problem Solved**: You can now run unlimited clients! 🎉
