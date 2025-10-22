# Project Structure

```
rust/
├── README.md                 # Main documentation
├── QUICKSTART.md            # Quick start guide
├── setup.sh                 # Automated setup script
│
├── server/                  # Pure Rust TCP Server
│   ├── Cargo.toml          # Server dependencies
│   ├── .gitignore
│   └── src/
│       └── main.rs         # Server implementation
│
└── client/                  # Tauri + Next.js Client
    ├── package.json        # Node dependencies
    ├── next.config.js      # Next.js configuration
    ├── tsconfig.json       # TypeScript configuration
    ├── tailwind.config.js  # Tailwind CSS configuration
    ├── postcss.config.js   # PostCSS configuration
    ├── .gitignore
    │
    ├── src/                # Next.js frontend
    │   └── app/
    │       ├── globals.css # Global styles
    │       ├── layout.tsx  # Root layout
    │       └── page.tsx    # Main page (UI)
    │
    └── src-tauri/          # Tauri backend
        ├── Cargo.toml      # Tauri dependencies
        ├── build.rs        # Build script
        ├── tauri.conf.json # Tauri configuration
        ├── icons/          # Application icons
        └── src/
            └── main.rs     # Tauri commands & TCP client
```

## File Descriptions

### Server Files

**`server/src/main.rs`**
- TCP server using Tokio async runtime
- Maintains HashMap of connected clients
- Handles client registration and disconnection
- Broadcasts client list updates

**`server/Cargo.toml`**
- Dependencies: tokio, serde, serde_json

### Client Files

**`client/src/app/page.tsx`**
- Main React component
- Connection form
- Client list display
- Uses Tauri API to communicate with backend

**`client/src-tauri/src/main.rs`**
- Tauri application entry point
- Command: `connect_to_server` - Connects to TCP server
- Command: `get_clients` - Retrieves current client list
- Event: `client-list-updated` - Emitted when server sends updates
- Event: `server-disconnected` - Emitted when connection lost

**`client/src-tauri/tauri.conf.json`**
- Window configuration (size, title)
- Build settings (dev/prod paths)
- Security settings
- Bundle configuration

**`client/package.json`**
- Scripts: dev, build, tauri:dev, tauri:build
- Dependencies: Next.js, React, Tauri APIs
- Dev dependencies: TypeScript, Tailwind CSS

## Key Technologies

### Server
- **Rust**: System programming language
- **Tokio**: Async runtime for I/O operations
- **Serde/Serde JSON**: Serialization/deserialization

### Client Backend (Tauri)
- **Rust**: Same as server
- **Tauri**: Framework for building desktop apps
- **Tokio**: For async TCP client

### Client Frontend
- **Next.js 14**: React framework (App Router)
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework

## Communication Protocol

### Message Types

**Client → Server (Registration)**
```json
{
  "type": "register",
  "client_ip": "192.168.1.100",
  "client_port": 50123
}
```

**Server → Client (Client List)**
```json
{
  "type": "client_list",
  "clients": [
    {"ip": "192.168.1.100", "port": 50123},
    {"ip": "192.168.1.101", "port": 50124}
  ]
}
```

### Flow
1. Client connects to server TCP socket
2. Client sends registration message
3. Server adds client to HashMap
4. Server sends current client list
5. Server broadcasts updates on client join/leave
6. Tauri backend emits events to frontend
7. Frontend updates UI reactively

## Development Workflow

1. **Start Server**: `cd server && cargo run`
2. **Start Client Dev**: `cd client && npm run tauri:dev`
3. **Make Changes**: Edit TypeScript/React files - hot reload enabled
4. **Build for Production**: `npm run tauri:build`

## Extension Ideas

- [ ] Add authentication/authorization
- [ ] Implement chat messaging
- [ ] Add client-to-client P2P connections
- [ ] Show client online/offline status with heartbeat
- [ ] Add client metadata (username, avatar)
- [ ] Implement rooms/channels
- [ ] Add file sharing
- [ ] Implement end-to-end encryption
- [ ] Add statistics dashboard
- [ ] Create admin panel for server
