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
# Server will start on port 51111 (or use: cargo run -- <port>)
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
  - TCP server listening on port 51111 (configurable via config.toml or CLI arg)
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
You can set the server port in `config.toml` (default: 51111). You can also override via CLI: `server <port>`.

### Client
The client allows you to configure:
- Server host/IP (e.g., 127.0.0.1)
- Server port (e.g., 51111)

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

## DCC vs Server Responsibilities

- DCC (Direct Client-to-Client) chat and file transfers are strictly peer-to-peer. The server is NOT used to relay DCC requests or file data.
- The server’s responsibilities are limited to:
  - Registering clients and broadcasting the active client list
  - Relaying group chat messages in server rooms/channels
  - Heartbeats and connection lifecycle
- Client responsibilities for DCC:
  - Initiate direct peer connections using the client’s TCP listener
  - Exchange DCC signaling (request/opened/file-offer/accept/chunk/cancel) directly with the peer
  - Stream file bytes directly between peers; server is never on the data path

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

# Flashback

This repository contains a Rust TCP server and a Tauri (Next.js) desktop client.

Quick start
- Server: cd server && cargo run
- Client (desktop): cd client && npm run tauri:dev

End-to-end (E2E) testing (Tauri-centered)
- We use WebdriverIO + tauri-driver for E2E. Cypress e2e is deprecated (component tests may remain).
- See docs/E2E.md for setup and running instructions.
- Run: cd client && npm run e2e (after installing prerequisites and starting tauri-driver).

Notes
- Windows paths in docs use backslashes.
- The server listens on a single default port 51111 unless you pass a custom port or set it in config.toml.


E2E quick-run scripts
- Windows (PowerShell):
  scripts\e2e-win.ps1             # uses runner by default
  scripts\e2e-win.ps1 -Build      # build binary and use APP_PATH
- macOS:
  chmod +x scripts/e2e-macos.sh && scripts/e2e-macos.sh         # runner
  chmod +x scripts/e2e-macos.sh && scripts/e2e-macos.sh --build  # build binary
- Linux:
  chmod +x scripts/e2e-linux.sh && scripts/e2e-linux.sh          # runner
  chmod +x scripts/e2e-linux.sh && scripts/e2e-linux.sh --build  # build binary

Notes:
- Scripts will attempt to install tauri-driver via cargo if available; otherwise print guidance.
- Runner mode starts `tauri dev`; build mode compiles a debug binary and sets APP_PATH.



## DNS: Pointing server.flashbackrepository.org to AWS NLB (Fargate)

If your DNS is managed by Vercel (recommended for this project), use a CNAME record to point the subdomain to the Network Load Balancer DNS name output by the CDK stack.

- Prerequisites: The stack must be deployed; capture the output `NlbDnsName`, e.g. `Flashb-Flash-3cFlwMFvY1qU-ce5bf79341c3f349.elb.us-east-1.amazonaws.com` and port `51111`.
- In Vercel > Domains > flashbackrepository.org > DNS, add:
  - Type: CNAME
  - Name: server
  - Value: <NLB_DNS_NAME_FROM_OUTPUT>
  - TTL: 60 (or your preferred value)
- Wait for DNS to propagate. You can verify resolution:
  - dig +short server.flashbackrepository.org
  - nslookup server.flashbackrepository.org
  - nc -vz server.flashbackrepository.org 51111

Notes:
- This service is TCP, not HTTP. A CNAME works for subdomains. For apex domains (@), use ALIAS/ANAME or Route53 alias. If you need static IPs for A records, allocate Elastic IPs on the NLB subnets (update the CDK accordingly) and create A records to those EIPs.
- TLS termination is not configured in this project (plain TCP). If you need TLS, consider an NLB TLS listener with a certificate (ACM) and update the client accordingly.

## Remote CLI End-to-End Test

A simple CLI E2E script connects a client to the deployed server via DNS, sends a message, and exits.

Usage:

- Default host and port:
  scripts/cli-e2e-remote.sh

- Custom host/port:
  scripts/cli-e2e-remote.sh server.flashbackrepository.org 51111
  # or
  HOST=server.flashbackrepository.org PORT=51111 scripts/cli-e2e-remote.sh

Artifacts:
- Logs: wdio-logs/cli-e2e-remote.log

This script builds the CLI client (debug), issues these commands to the client process, and validates expected output:
- connect-server <host:port>
- allow auto
- send-channel general <timestamped-message>
- exit

Troubleshooting:
- Ensure DNS resolves to the NLB DNS target (dig/nslookup)
- Ensure the NLB listener is active and the ECS task is healthy (AWS console)
- Check CloudWatch Logs for the ECS task (streamPrefix: flashback)



## ECS autoscaling on traffic (Fargate)

The ECS Fargate service behind the Network Load Balancer now scales the desired task count between 0 and 1 based on TCP traffic:

- Scale out to 1 when the NLB Target Group observes any active flows (ActiveFlowCount >= 1).
- Scale in to 0 when there are no active flows (ActiveFlowCount == 0) for a short sustained period.
- Capacity is capped at 1 (never scales above 1).

Notes:
- Cold start: when scaled to 0, the first incoming connection will trigger scale-out; allow time for the task to start and pass health checks before the port is reachable.
- Metrics used: CloudWatch AWS/NetworkELB ActiveFlowCount with a 1-minute period and 2 evaluation periods.
- You can adjust cooldowns/periods in infra/cdk/lib/flashback-server-stack.ts if you want faster or slower reactions.

Validation tips:
- Watch the service Desired tasks/Running tasks in the ECS console; it should drop to 0 after idle, and go to 1 when you try to connect.
- Generate traffic to trigger scale out: nc -vz server.flashbackrepository.org 51111 (repeat a couple times if needed).
