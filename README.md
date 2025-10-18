# Client-Server Application with Tauri and Next.js

A distributed client-server application where clients connect to a central server and can view all connected clients.

## Architecture

- **Server**: Pure Rust TCP server that maintains a list of connected clients
- **Client**: Tauri app with Next.js frontend that connects to the server

## Prerequisites

1. **Rust**: Install from [rustup.rs](https://rustup.rs/)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js**: Version 18+ (for Next.js)
   ```bash
   # Check if already installed
   node --version
   ```

3. **Tauri CLI**: 
   ```bash
   cargo install tauri-cli
   ```

## Project Structure

```
rust/
├── server/          # Pure Rust server
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
└── client/          # Tauri + Next.js client
    ├── package.json
    ├── next.config.js
    ├── src/         # Next.js frontend
    └── src-tauri/   # Tauri backend
        ├── Cargo.toml
        └── src/
            └── main.rs
```

## Setup & Running

### 1. Install Rust (if not already installed)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Start the Server
```bash
cd server
cargo run
# Server will start on port 8080
```

### 3. Start the Client(s)
In a new terminal:
```bash
cd client
npm install
npm run tauri:dev:auto   # Auto-detects available port
```

**To run multiple clients**, open new terminals and run the same command:
```bash
# Terminal 2
npm run tauri:dev:auto   # Uses port 3000

# Terminal 3  
npm run tauri:dev:auto   # Uses port 3001

# Terminal 4
npm run tauri:dev:auto   # Uses port 3002
```

Each client will automatically find an available port! See `MULTIPLE_CLIENTS_SOLVED.md` for details.

## Features

- **Server**:
  - TCP server listening on port 8080 (auto-selects 8081-8085 if busy)
  - Maintains list of connected clients (IP + port)
  - Broadcasts client list to all connected clients
  - Handles client disconnections gracefully
  - **Heartbeat monitoring** (60s ping interval)
  - **Connection timeout** (120s without ping)
  - **Group chat broadcasting** (messages not stored)
  - Configurable via `config.toml`

- **Client**:
  - Tauri desktop application
  - Next.js React frontend
  - Connects to server with configurable IP/port
  - Displays list of all connected clients in real-time
  - Shows connection status
  - **Real-time group chat** with all connected clients
  - **Automatic heartbeat** to maintain connection
  - **Multi-instance support** with auto-port detection

## Configuration

### Server
Edit `server/src/main.rs` to change the server port (default: 8080)

### Client
The client UI allows you to configure:
- Server IP address (default: 127.0.0.1)
- Server port (default: 8080)

## Protocol

The server and client communicate using a simple JSON protocol over TCP:

**Client → Server (on connect):**
```json
{
  "type": "register",
  "client_ip": "192.168.1.100",
  "client_port": 50123
}
```

**Server → Client (broadcast):**
```json
{
  "type": "client_list",
  "clients": [
    {"ip": "192.168.1.100", "port": 50123},
    {"ip": "192.168.1.101", "port": 50124}
  ]
}
```

**Heartbeat (client → server, every 60s):**
```json
{
  "type": "ping"
}
```

**Chat message (client → server → all clients):**
```json
{
  "type": "chat",
  "from_ip": "192.168.1.100",
  "from_port": 50123,
  "message": "Hello everyone!",
  "timestamp": "2025-10-18T10:30:45.123Z"
}
```

## Documentation

- `QUICKSTART_CHAT.md` - Quick 3-command start guide
- `MULTIPLE_CLIENTS_SOLVED.md` - Running multiple clients (SOLVED!)
- `HEARTBEAT.md` - Persistent connections & configuration
- `CHAT_FEATURE.md` - Complete chat documentation
- `RUNNING_MULTIPLE_CLIENTS.md` - Detailed multi-client guide
- `MULTIPLE_CLIENTS_VISUAL_GUIDE.md` - Visual diagrams

## Development

### Building for Production

**Server:**
```bash
cd server
cargo build --release
./target/release/server
```

**Client:**
```bash
cd client
npm run tauri build
```

The built application will be in `client/src-tauri/target/release/bundle/`
# flashback
