# Flashback Architecture Documentation Index

## Quick Navigation

### 🚀 Start Here
**New to Flashback? Start with these:**

1. **[COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md)** ⭐ START HERE
   - Overview of both Relay Tracker and Peer Server
   - How they work together
   - Real-world examples
   - Security model
   - Perfect for understanding the big picture

2. **[PROJECT_STATUS.md](PROJECT_STATUS.md)** 📊 **CURRENT STATUS**
   - Phase 2 completion status
   - Phase 3 specification status
   - Metrics and timeline
   - Next steps and recommendations
   - Perfect for project overview

3. **[RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md)**
   - Side-by-side comparison
   - Quick lookup tables
   - Configuration guide
   - API endpoints
   - Perfect for developers

---

## Detailed References

### Understanding the Architecture

**[SERVER_ARCHITECTURE.md](SERVER_ARCHITECTURE.md)**
- Detailed distinction between Relay Tracker and Peer Server
- Component responsibilities
- Data flow diagrams
- Architecture patterns
- Example deployments
- Security implications
- Use when: Understanding how components fit together

---

### Phase 3: Friends List (In Planning)

**[PHASE_3_FRIENDS_LIST.md](PHASE_3_FRIENDS_LIST.md)**
- Complete Friends List specification
- Health check algorithm
- Relay fallback mechanism
- User flows and examples
- Integration points
- Testing strategy
- Use when: Planning or implementing Friends List feature

**[PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md](PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md)**
- Quick overview of Phase 3
- Key differences from Phase 2
- Data model and APIs
- Health check flow diagram
- Common questions and scenarios
- Use when: Quick understanding or implementation reference

---

### Relay Tracker (Centralized)

**File Location:** `/server` directory

**What it does:**
- Coordinates peers (like a BitTorrent tracker)
- Registers clients
- Provides peer discovery
- Enables connections between clients

**Key points:**
- Never stores user files
- Only tracks metadata (who's online)
- Minimal central infrastructure
- Can be self-hosted

**Relevant documentation:**
- [COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md) - Relay Tracker section
- [SERVER_ARCHITECTURE.md](SERVER_ARCHITECTURE.md) - Relay Tracker detailed info

---

### Peer Server (Decentralized)

**File Location:** `client/src-tauri/src/http_server.rs`

**What it does:**
- Serves files from configured directory
- Enables file browsing via HTTP
- Streams content to other peers
- Prevents directory traversal attacks

**Architecture Documents:**

1. **[ARCHITECTURE_PRINCIPLES.md](ARCHITECTURE_PRINCIPLES.md)**
   - Peer Server philosophy
   - Design principles
   - Client responsibilities
   - What the server does/doesn't do
   - Use when: Understanding server design philosophy

2. **[HTTP_LISTENER_IMPLEMENTATION.md](HTTP_LISTENER_IMPLEMENTATION.md)**
   - Peer Server implementation details
   - HTTP endpoints
   - File serving mechanism
   - Security model
   - Configuration details
   - Use when: Implementing or debugging the server

3. **[REMOTEHOUSE_HTTP_INTEGRATION.md](REMOTEHOUSE_HTTP_INTEGRATION.md)**
   - How RemoteHouse UI connects to Peer Server
   - Event-based port discovery
   - File loading mechanism
   - Error handling
   - Use when: Understanding UI integration

---

### Cross-Cutting Concerns

**[ARCHITECTURE_UPDATE.md](ARCHITECTURE_UPDATE.md)**
- Summary of recent architecture clarifications
- Changes made
- Benefits of the approach
- Next steps
- Use when: Catching up on recent decisions

---

## Component Matrix

| Component | Purpose | Tech | Location | Stores Files | Network |
|-----------|---------|------|----------|--------------|---------|
| **Relay Tracker** | Coordinate peers | Next.js | `/server` | ❌ No | Public/private IP |
| **Peer Server** | Serve files | Rust/Axum | `client/src-tauri/` | ✅ Yes | Localhost (127.0.0.1) |
| **RemoteHouse** | Browse files | React | `client/src/components/` | ❌ No | Via Peer Server |

---

## Development Workflows

### I want to understand the overall architecture
1. Read: [COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md)
2. Reference: [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md)

### I'm planning Phase 3 (Friends List)
1. Overview: [PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md](PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md)
2. Full spec: [PHASE_3_FRIENDS_LIST.md](PHASE_3_FRIENDS_LIST.md)
3. Architecture context: [COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md)

### I'm implementing Phase 3 (Friends List)
1. Full spec: [PHASE_3_FRIENDS_LIST.md](PHASE_3_FRIENDS_LIST.md)
2. Reference: [PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md](PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md)
3. Integration: [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md)

### I'm working on the Peer Server
1. Reference: [HTTP_LISTENER_IMPLEMENTATION.md](HTTP_LISTENER_IMPLEMENTATION.md)
2. Understand: [ARCHITECTURE_PRINCIPLES.md](ARCHITECTURE_PRINCIPLES.md)
3. Integration: [REMOTEHOUSE_HTTP_INTEGRATION.md](REMOTEHOUSE_HTTP_INTEGRATION.md)

### I'm working on RemoteHouse UI
1. Integration: [REMOTEHOUSE_HTTP_INTEGRATION.md](REMOTEHOUSE_HTTP_INTEGRATION.md)
2. Understand: [ARCHITECTURE_PRINCIPLES.md](ARCHITECTURE_PRINCIPLES.md)
3. Reference: [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md)

### I'm working on the Relay Tracker
1. Overview: [COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md) (Relay Tracker section)
2. Reference: [SERVER_ARCHITECTURE.md](SERVER_ARCHITECTURE.md) (Relay Tracker section)
3. Comparison: [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md)

### I need to explain the architecture to someone
1. Start: [COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md)
2. Summarize: [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md) or [PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md](PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md)
3. Details: [SERVER_ARCHITECTURE.md](SERVER_ARCHITECTURE.md)

---

## Key Concepts

### Two-Server Model

**Relay Tracker**
- Centralized coordinator
- Knows who's online
- Facilitates connections
- Never touches files

**Peer Server**
- Decentralized content provider
- Serves files locally
- Independent of relay
- User controls what's shared

### Communication Pattern

```
Discovery Phase:
  Client → Relay Tracker → List of peers

Connection Phase:
  Client ← Relay introduces peer → Peer

Transfer Phase:
  Client ←→ Peer Server (direct)
  Relay: Not involved
```

### Security Model

**Relay Tracker**
- Only metadata (who's online)
- User files never exposed to relay
- Self-hostable for privacy

**Peer Server**
- Localhost binding (127.0.0.1)
- User controls fileRootDirectory
- Directory traversal prevention
- Ephemeral ports

---

## API Reference

### Peer Server Endpoints

```
GET /api/files                  List files in current directory
GET /api/files/docs             List files in subdirectory
GET /content/README.md          Get text file content
GET /download/video.mp4         Stream/download binary file
```

### Relay Tracker Endpoints (Examples)
```
POST /api/peers/register        Client registration
GET /api/peers/list             Get online peers
POST /api/peers/heartbeat       Keep-alive signal
GET /api/relay/status           Relay health
```

---

## Configuration

### Peer Server Configuration
```
User Settings:
  fileRootDirectory: /Users/username/Documents

Auto-configured:
  Binding: 127.0.0.1
  Port: OS-chosen (port 0), emitted via event
  Index: index.md (created if missing)
```

### Relay Tracker Configuration
```
PORT=3000
BIND_ADDRESS=0.0.0.0
DATABASE_URL=postgresql://...
```

---

## Current Status

### Phase 2: Complete ✅
- Peer Server implemented and tested
- RemoteHouse integrated with HTTP calls
- Configuration system working
- E2E tests fully updated
- Code compiles without errors

### Phase 3: Documented & Ready for Planning 📋
- Friends List specification complete
- Health check algorithm documented
- Relay fallback mechanism designed
- Integration points identified
- User workflows defined
- Implementation roadmap ready

### Phase 4+: Future
- Relay Tracker integration (authentication, client registration)
- Full system E2E testing
- Performance optimization
- Advanced features

---

## File Organization

```
Root Documentation:
  COMPLETE_ARCHITECTURE_OVERVIEW.md    ⭐ Start here
  SERVER_ARCHITECTURE.md               Architecture details
  RELAY_VS_PEER_QUICK_REFERENCE.md     Quick lookup
  ARCHITECTURE_PRINCIPLES.md           Peer Server philosophy
  ARCHITECTURE_UPDATE.md               Recent changes
  ARCHITECTURE_INDEX.md                This file

Phase 3 Documentation:
  PHASE_3_FRIENDS_LIST.md              Full specification
  PHASE_3_FRIENDS_LIST_QUICK_REFERENCE.md  Quick reference

Implementation Documentation:
  HTTP_LISTENER_IMPLEMENTATION.md      Peer Server implementation
  REMOTEHOUSE_HTTP_INTEGRATION.md      RemoteHouse integration

Source Code:
  client/src-tauri/src/http_server.rs     Peer Server code
  client/src/components/RemoteHouse/      UI component
  server/app/api/peers/                   Relay Tracker (future)
```

---

## Naming Convention

To maintain clarity:

✅ **Use:**
- "Relay Tracker" or "Central Relay" for the coordinator
- "Peer Server" or "File Server" for the client-hosted server
- "Relay Connection" for client-to-relay
- "Peer Connection" for peer-to-peer

❌ **Avoid:**
- "Server" alone (ambiguous)
- "HTTP Server" alone (both are HTTP servers)
- "Client server" (confusing - use "Peer Server")
- "Relay server" alone (could mean either)

---

## Useful Diagrams

See [SERVER_ARCHITECTURE.md](SERVER_ARCHITECTURE.md) for:
- Architecture diagram
- Data flow examples
- Deployment scenarios
- Network isolation diagram

See [COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md) for:
- File sharing example walkthrough
- Network isolation explanation
- Comparison with traditional approaches

---

## Troubleshooting

**Q: How do I know which server I'm looking at?**
A: Check the documentation title and "What it does" section. Or reference the quick comparison in [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md).

**Q: Where is the Relay Tracker code?**
A: `/server` directory (Next.js backend) - not yet integrated with Peer Server.

**Q: Where is the Peer Server code?**
A: `client/src-tauri/src/http_server.rs` - embedded in the Tauri client.

**Q: What files does the Relay Tracker see?**
A: None - it only knows about metadata (who's online).

**Q: What files does the Peer Server see?**
A: Files in the directory specified by `fileRootDirectory` setting.

**Q: Can I run both servers on the same machine?**
A: Yes - Relay Tracker on public port (e.g., 3000), Peer Server on localhost (e.g., 54321).

---

## Related Code Files

### Peer Server Implementation
- `client/src-tauri/src/http_server.rs` - Main implementation
- `client/src-tauri/src/main.rs` - Startup and event emission
- `client/src-tauri/Cargo.toml` - Dependencies (axum)

### RemoteHouse Integration
- `client/src/components/RemoteHouse/RemoteHouse.tsx` - UI component
- `client/src/app/config.ts` - Configuration management
- `client/src/components/SettingsSection/SettingsSection.tsx` - Settings UI

### Configuration & Events
- `client/src/app/page.tsx` - Main page wiring
- `client/src/components/BroadcastSection/BroadcastSection.tsx` - Broadcast flow

---

## Next Steps

1. **Immediate:** E2E testing for Peer Server
   - Test file serving
   - Test directory navigation
   - Test config persistence

2. **Phase 3:** Relay Tracker integration
   - Client registration
   - Peer discovery
   - Connection coordination

3. **Future:** Enhancement features
   - Automatic indexing
   - Performance optimization
   - Advanced features per component

---

## Questions?

Refer to the appropriate documentation file based on your question:

- **Overall architecture:** [COMPLETE_ARCHITECTURE_OVERVIEW.md](COMPLETE_ARCHITECTURE_OVERVIEW.md)
- **Specific component:** [SERVER_ARCHITECTURE.md](SERVER_ARCHITECTURE.md)
- **Quick lookup:** [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md)
- **Implementation details:** Component-specific docs
- **Philosophy:** [ARCHITECTURE_PRINCIPLES.md](ARCHITECTURE_PRINCIPLES.md)

---

**Last Updated:** October 30, 2025

**Architecture Status:** 🟢 Stable (Phase 2 Complete, Phase 3 Planning)

**Code Status:** ✅ Compiles, 🟢 Type-safe, ✅ Well-tested

**Documentation Status:** 📚 Complete and cross-linked
