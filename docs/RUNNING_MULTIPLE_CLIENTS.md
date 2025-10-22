# Running Multiple Clients - Solution Guide

## The Problem

When you try to run multiple Tauri clients, they all try to use port 3000 for the Next.js dev server, causing the second client to fail with a port conflict error.

## The Solution

We've created an auto-port detection script that:
1. Finds an available port (starting from 3000)
2. Updates the Tauri config automatically
3. Starts the client on that port

## Method 1: Using the Auto-Port Script (Recommended)

### Start First Client
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

### Start Second Client (New Terminal)
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

### Start Third Client (New Terminal)
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

Each instance will automatically find an available port (3000, 3001, 3002, etc.)!

## Method 2: Manual Port Assignment

If you prefer to manually specify ports:

### Terminal 1
```bash
cd /Users/ari.asulin/dev/test/rust/client
PORT=3000 npm run tauri dev
```

### Terminal 2
```bash
cd /Users/ari.asulin/dev/test/rust/client
PORT=3001 npm run tauri dev
```

### Terminal 3
```bash
cd /Users/ari.asulin/dev/test/rust/client
PORT=3002 npm run tauri dev
```

## Method 3: Using Production Build (No Port Conflicts)

For testing without port conflicts, use the production build:

### Build Once
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run build
cd src-tauri
cargo build --release
```

### Run Multiple Instances
```bash
# Terminal 1
./src-tauri/target/release/client

# Terminal 2
./src-tauri/target/release/client

# Terminal 3
./src-tauri/target/release/client
```

Production builds don't need a dev server, so no port conflicts!

## How the Auto-Port Script Works

The `start-client.sh` script:

```bash
# 1. Find available port
PORT=3000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; do
    PORT=$((PORT + 1))
done

# 2. Update Tauri config
sed -i '' "s|\"devPath\": \"http://localhost:[0-9]*\"|\"devPath\": \"http://localhost:$PORT\"|" src-tauri/tauri.conf.json

# 3. Start Tauri with that port
npm run tauri dev
```

## Complete Testing Workflow

### Step 1: Start Server
```bash
cd /Users/ari.asulin/dev/test/rust/server
cargo run
```

Expected output:
```
🚀 Starting Client-Server Application Server
✅ Successfully bound to 0.0.0.0:8080
🚀 Server is running!
```

### Step 2: Start Multiple Clients

**Terminal 2:**
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```
Output: `Using port 3000 for Next.js dev server`

**Terminal 3:**
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```
Output: `Port 3000 is in use, trying next port...`
         `Using port 3001 for Next.js dev server`

**Terminal 4:**
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```
Output: `Using port 3002 for Next.js dev server`

### Step 3: Connect All Clients
- In each client window, click "Connect to Server"
- Use default settings: `127.0.0.1:8080`
- All clients will appear in each other's "Connected Clients" list

### Step 4: Test Chat
- Send a message from any client
- See it appear on all clients instantly!

## Troubleshooting

### Script Permission Error
```bash
chmod +x /Users/ari.asulin/dev/test/rust/client/start-client.sh
```

### Port Still Shows as Taken
Kill processes using the port:
```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Script Not Found
Make sure you're in the client directory:
```bash
cd /Users/ari.asulin/dev/test/rust/client
```

### Tauri Config Not Updating
Check that sed is installed (should be by default on macOS):
```bash
which sed
```

### All Ports 3000-3010 Are Taken
Increase the range in the script or manually kill unused processes:
```bash
# Kill all node processes
pkill -f "next dev"
```

## Alternative: Use tmux for Easy Management

Create a tmux session to manage all terminals:

```bash
# Start tmux
tmux new -s chat-test

# Split into 4 panes
Ctrl+b "    # Split horizontal
Ctrl+b %    # Split vertical
# Navigate with Ctrl+b arrow keys

# In pane 1: Server
cd /Users/ari.asulin/dev/test/rust/server && cargo run

# In pane 2: Client 1
cd /Users/ari.asulin/dev/test/rust/client && npm run tauri:dev:auto

# In pane 3: Client 2
cd /Users/ari.asulin/dev/test/rust/client && npm run tauri:dev:auto

# In pane 4: Client 3
cd /Users/ari.asulin/dev/test/rust/client && npm run tauri:dev:auto

# Detach: Ctrl+b d
# Reattach: tmux attach -t chat-test
```

## Quick Reference

| Method | Command | Pros | Cons |
|--------|---------|------|------|
| Auto-Port Script | `npm run tauri:dev:auto` | ✅ Automatic<br>✅ Easy | ⚠️ Modifies config |
| Manual PORT | `PORT=3001 npm run tauri dev` | ✅ Explicit<br>✅ No config changes | ❌ Must specify each time |
| Production Build | `./target/release/client` | ✅ No conflicts<br>✅ Fast | ❌ Must rebuild for changes |

## Best Practice

For **development/testing**: Use `npm run tauri:dev:auto`  
For **demonstrations**: Use production builds  
For **single instance**: Use regular `npm run tauri dev`

## Summary

You can now easily run as many client instances as you need! The auto-port script handles everything automatically, making it simple to test the chat feature with multiple clients on one machine.
