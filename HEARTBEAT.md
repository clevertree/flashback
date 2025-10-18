# Persistent Connections & Heartbeat Configuration

## Overview

The server and client now support persistent connections with automatic heartbeat monitoring. This ensures that connections remain alive and dead connections are automatically cleaned up.

## Configuration File

The server reads configuration from `config.toml` in the server directory:

```toml
[server]
port = 8080
heartbeat_interval = 60        # Seconds between client pings
connection_timeout = 120       # Seconds before disconnecting inactive client
host = "0.0.0.0"
max_clients = 100
```

### Configuration Options

- **port**: The primary port to bind to (defaults to 8080 if not specified)
- **heartbeat_interval**: How often clients should send ping messages (default: 60 seconds)
- **connection_timeout**: How long to wait before considering a client dead (default: 120 seconds)
- **host**: The host address to bind to (default: "0.0.0.0")
- **max_clients**: Maximum number of clients allowed (default: 100)

## How It Works

### Client Behavior

1. Client connects to server and sends registration
2. Client automatically sends a `Ping` message every `heartbeat_interval` seconds
3. Client receives `Pong` responses from server
4. Connection remains open as long as pings are sent

### Server Behavior

1. Server accepts client registration
2. Server tracks `last_ping` timestamp for each client
3. When receiving a `Ping` message:
   - Updates the client's `last_ping` timestamp
   - Sends back a `Pong` response
4. Background task checks all clients every 10 seconds:
   - If a client hasn't pinged within `connection_timeout` seconds
   - Client is removed and disconnection is logged
5. When a client disconnects:
   - Client is removed from the connection map
   - Updated client list is broadcast to all remaining clients

## Message Protocol

The system now supports 4 message types:

```json
// Registration (client → server)
{
  "type": "register",
  "client_ip": "192.168.1.100",
  "client_port": 3000
}

// Client List (server → client)
{
  "type": "client_list",
  "clients": [
    {"ip": "192.168.1.100", "port": 3000},
    {"ip": "192.168.1.101", "port": 3001}
  ]
}

// Ping (client → server)
{
  "type": "ping"
}

// Pong (server → client)
{
  "type": "pong"
}
```

## Running the System

### Start Server
```bash
cd server
cargo run
```

The server will:
- Load configuration from `config.toml` (or use defaults)
- Display heartbeat and timeout settings
- Auto-select an available port (8080-8085)
- Start the connection timeout checker

### Start Client
```bash
cd client
npm run tauri dev
```

The client will:
- Connect to the specified server
- Send registration
- Automatically ping every 60 seconds
- Log ping/pong activity to console

## Monitoring

### Server Logs

```
⚙️  Configuration loaded:
   Heartbeat interval: 60s
   Connection timeout: 120s
   Max clients: 100

✅ Successfully bound to 0.0.0.0:8080
🚀 Server is running!

✅ New connection from: 127.0.0.1:54321
📝 Registered client: 192.168.1.100:3000 (socket: 127.0.0.1:54321)
💓 Received pong from server
⏱️  Client timeout: 192.168.1.101:3001 (no ping for 120s)
👋 Client disconnected: 192.168.1.100:3000
```

### Client Logs

```
Connected to server
Sent registration message
Received client list: 2 clients
💓 Sent ping to server
💓 Received pong from server
```

## Troubleshooting

### Clients Getting Disconnected

If clients are being disconnected unexpectedly:
1. Check that `heartbeat_interval` < `connection_timeout`
2. Recommended: `connection_timeout` = 2 × `heartbeat_interval`
3. Check network stability

### Missing config.toml

If `config.toml` is not found, the server will use default values:
- Port: 8080
- Heartbeat interval: 60 seconds
- Connection timeout: 120 seconds

### Adjusting Ping Frequency

To change how often clients ping:
1. Edit `server/config.toml` and change `heartbeat_interval`
2. Restart the server
3. Note: Client ping interval is currently hardcoded to 60s in the code
4. To match server config, edit `client/src-tauri/src/main.rs` line with `Duration::from_secs(60)`

## Technical Details

### Connection State Management

- Server maintains: `Arc<RwLock<HashMap<SocketAddr, ClientInfo>>>`
- Each `ClientInfo` contains: IP, port, and `last_ping` timestamp
- Timeout checker runs every 10 seconds in background task
- Read timeout on socket prevents indefinite blocking

### Thread Safety

- `Arc` (Atomic Reference Counting) allows multiple ownership
- `RwLock` allows multiple readers or single writer
- `last_ping` wrapped in `Arc<RwLock>` for thread-safe updates

### Performance Considerations

- Ping messages are small (just `{"type":"ping"}`)
- Minimal network overhead (every 60 seconds)
- Timeout checker uses read-only access (non-blocking)
- Only removes disconnected clients (no expensive operations)
