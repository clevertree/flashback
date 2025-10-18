# Quick Start Guide

## Prerequisites Installation

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Verify Node.js (should already be installed)
```bash
node --version  # Should be 18+
npm --version
```

## Running the Application

### Option A: Automated Setup
```bash
./setup.sh
```

This will install all dependencies and provide instructions for running.

### Option B: Manual Setup

#### 1. Start the Server
```bash
cd server
cargo run
```

You should see:
```
🚀 Server listening on 0.0.0.0:8080
```

#### 2. Install Client Dependencies (first time only)
```bash
cd client
npm install
```

#### 3. Start the Client
```bash
npm run tauri:dev
```

Or if you prefer to build the client first:
```bash
npm run build
npm run tauri:dev
```

## Testing Multiple Clients

1. Keep the server running
2. Start multiple client instances by running `npm run tauri:dev` in separate terminals from the `client` directory
3. Connect each client to the server
4. Watch as all clients appear in each client's list!

## Troubleshooting

### "cargo: command not found"
- Rust is not installed or not in PATH
- Solution: Install Rust using the command above, then restart your terminal

### "Failed to connect to server"
- Make sure the server is running
- Check that you're using the correct IP and port (default: 127.0.0.1:8080)
- Check firewall settings

### "Error loading shared library"
- On Linux, you may need additional dependencies
- See: https://tauri.app/v1/guides/getting-started/prerequisites

### Port already in use
- Change the server port in `server/src/main.rs` (line with `TcpListener::bind`)
- Update the client's default port in the UI

## Architecture Overview

```
┌─────────────────┐
│  Client 1       │─┐
│  (Tauri+Next)   │ │
└─────────────────┘ │
                    │
┌─────────────────┐ │    ┌─────────────────┐
│  Client 2       │─┼───▶│  Rust Server    │
│  (Tauri+Next)   │ │    │  (TCP:8080)     │
└─────────────────┘ │    └─────────────────┘
                    │
┌─────────────────┐ │
│  Client N       │─┘
│  (Tauri+Next)   │
└─────────────────┘
```

Each client:
1. Connects to the server via TCP
2. Sends its IP and port
3. Receives updates about all connected clients
4. Displays the list in the UI

## Next Steps

- Modify the UI in `client/src/app/page.tsx`
- Change the server logic in `server/src/main.rs`
- Add authentication
- Implement chat functionality
- Add client-to-client messaging
