# Running Multiple Clients - SOLVED! ✅

## Problem
**Tauri expects port 3000 and fails if the port is 3001**

When trying to run a second client instance, you'd get an error because port 3000 was already in use.

## Solution
**Auto-port detection script that finds available ports automatically**

## Usage

### Simple - Just Run This Command for Each Client:
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```

That's it! The script will:
1. ✅ Find an available port (3000, 3001, 3002, etc.)
2. ✅ Update Tauri config temporarily
3. ✅ Start the client
4. ✅ Restore config on exit

## Example: Running 3 Clients

### Terminal 1: Server
```bash
cd /Users/ari.asulin/dev/test/rust/server
cargo run
```

### Terminal 2: Client 1
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```
Output: `✅ Using port 3000 for Next.js dev server`

### Terminal 3: Client 2
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```
Output: `⚠️  Port 3000 is in use, trying next port...`
         `✅ Using port 3001 for Next.js dev server`

### Terminal 4: Client 3
```bash
cd /Users/ari.asulin/dev/test/rust/client
npm run tauri:dev:auto
```
Output: `✅ Using port 3002 for Next.js dev server`

## What the Script Does

```bash
# Find available port
PORT=3000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; do
    PORT=$((PORT + 1))
done

# Backup config
cp src-tauri/tauri.conf.json src-tauri/tauri.conf.json.backup

# Update devPath
sed -i '' "s|\"devPath\": \"http://localhost:[0-9]*\"|\"devPath\": \"http://localhost:$PORT\"|" src-tauri/tauri.conf.json

# Start Tauri
npm run tauri dev

# Restore config on exit (via trap)
mv src-tauri/tauri.conf.json.backup src-tauri/tauri.conf.json
```

## Features

✅ **Automatic port detection** - No manual configuration  
✅ **Config backup/restore** - Original config preserved  
✅ **Safety limits** - Won't try beyond port 3020  
✅ **Color output** - Easy to see what's happening  
✅ **Cleanup on exit** - Config restored even if you Ctrl+C  

## Alternative Methods

### Method 1: Manual Port (No Script)
```bash
PORT=3001 npm run tauri dev
```

### Method 2: Production Build (No Dev Server)
```bash
npm run build
cd src-tauri
cargo build --release
./target/release/client  # Run multiple times
```

## Troubleshooting

### All ports 3000-3020 are taken
```bash
# Kill all Next.js dev servers
pkill -f "next dev"
```

### Script permission error
```bash
chmod +x start-client.sh
```

### Want to see what's using a port?
```bash
lsof -i :3000
```

## Documentation

- `RUNNING_MULTIPLE_CLIENTS.md` - Full detailed guide
- `MULTIPLE_CLIENTS_VISUAL_GUIDE.md` - Visual diagrams and examples
- `QUICKSTART_CHAT.md` - Updated with new command

## Summary

**Before:** ❌ Could only run one client at a time  
**After:** ✅ Run as many clients as you want with `npm run tauri:dev:auto`

Problem solved! 🎉
