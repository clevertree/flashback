# Troubleshooting Guide

## Server Issues

### Error: "Address already in use" (Port 8080)

**The Problem:**
```
called `Result::unwrap()` on an `Err` value: Os { code: 48, kind: AddrInUse, message: "Address already in use" }
```

**Solutions:**

#### Option 1: Let the server auto-select a different port (EASIEST)
The server will now automatically try ports 8080-8085. Just run:
```bash
cd server
cargo run
```

It will show you which port it bound to:
```
✅ Successfully bound to 0.0.0.0:8081
🚀 Server is running!
```

Then update your client to connect to that port (e.g., 8081 instead of 8080).

#### Option 2: Use a custom port
```bash
cd server
cargo run -- 9090
```

This will start the server on port 9090.

#### Option 3: Kill the process using port 8080

**Find the process:**
```bash
lsof -i :8080
```

Output will show:
```
COMMAND   PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
server  12345  username    6u  IPv4 0x123456789      0t0  TCP *:8080 (LISTEN)
```

**Kill the process:**
```bash
kill -9 12345
```
(Replace `12345` with the actual PID from the lsof output)

---

## Client Issues

### Cannot connect to server

**Check:**
1. Is the server running?
2. Are you using the correct IP and port?
3. If server is on a different port (e.g., 8081), update the port in the client UI

### Tauri dev server not starting

**Error: "npm: command not found"**
```bash
# Install Node.js from https://nodejs.org or:
brew install node  # macOS with Homebrew
```

**Error: Dependencies installation failed**
```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

---

## Rust/Cargo Issues

### "cargo: command not found"

**Install Rust:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Compilation errors

**Update Rust:**
```bash
rustup update
```

**Clean and rebuild:**
```bash
cargo clean
cargo build
```

---

## Common Port Conflicts

### Ports 8080-8085 all in use

Check what's using these ports:
```bash
for port in {8080..8085}; do
  echo "Port $port:"
  lsof -i :$port
done
```

Use a custom port:
```bash
# Server
cargo run -- 9000

# Then update client to connect to 127.0.0.1:9000
```

---

## Development Tips

### Running multiple client instances

Each client needs its own terminal:
```bash
# Terminal 1
cd client && npm run tauri:dev

# Terminal 2
cd client && npm run tauri:dev

# Terminal 3
cd client && npm run tauri:dev
```

### Viewing server logs

Server logs show:
- ✅ Client connections
- 📝 Client registrations
- 👋 Client disconnections
- 📡 Client list broadcasts

### Hot reload not working in client

1. Stop the tauri dev server (Ctrl+C)
2. Restart: `npm run tauri:dev`
3. Or rebuild: `npm run build && npm run tauri:dev`

---

## Platform-Specific Issues

### macOS

**Security popup for server/client:**
- Click "Allow" when macOS asks about network connections
- Go to System Preferences → Security & Privacy if needed

### Linux

**Missing dependencies:**
```bash
# Ubuntu/Debian
sudo apt-get install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

# Fedora
sudo dnf install webkit2gtk3-devel.x86_64 \
    openssl-devel \
    curl \
    wget \
    libappindicator-gtk3 \
    librsvg2-devel

# Arch
sudo pacman -S webkit2gtk \
    base-devel \
    curl \
    wget \
    openssl \
    appmenu-gtk-module \
    gtk3 \
    libappindicator-gtk3 \
    librsvg
```

### Windows

**Rust installation:**
- Download from https://www.rust-lang.org/tools/install
- Requires Visual Studio Build Tools

**Port conflicts:**
```powershell
# Find process using port 8080
netstat -ano | findstr :8080

# Kill process (replace PID)
taskkill /PID <PID> /F
```

---

## Getting Help

If you're still having issues:

1. Check the server terminal for error messages
2. Check the client terminal for error messages
3. Verify Rust version: `rustc --version` (should be 1.70+)
4. Verify Node version: `node --version` (should be 18+)
5. Try a clean rebuild:
   ```bash
   # Server
   cd server && cargo clean && cargo build
   
   # Client
   cd client && rm -rf node_modules && npm install
   ```

---

## Quick Reference

### Start Server
```bash
cd server
cargo run              # Auto-select port
cargo run -- 9090      # Use port 9090
```

### Start Client
```bash
cd client
npm run tauri:dev      # Development
npm run tauri:build    # Production
```

### Find Process on Port
```bash
lsof -i :8080          # macOS/Linux
netstat -ano | findstr :8080  # Windows
```

### Kill Process
```bash
kill -9 <PID>          # macOS/Linux
taskkill /PID <PID> /F # Windows
```
