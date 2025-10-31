# Quick Start Guide

**Last Updated:** October 31, 2025

Get started with Flashback development in 10 minutes.

---

## What is Flashback?

A **decentralized file sharing system** with two components:
- **Relay Tracker**: Helps peers find each other (centralized coordinator)
- **Peer Server**: Serves files directly peer-to-peer (decentralized)

---

## Quick Links

- **New to the project?** Start here, then read [ARCHITECTURE.md](ARCHITECTURE.md)
- **What's implemented?** See [FEATURES_IMPLEMENTED.md](FEATURES_IMPLEMENTED.md)
- **What to build next?** See [NEXT_PHASE.md](NEXT_PHASE.md)
- **API Reference** See [RELAY_VS_PEER_QUICK_REFERENCE.md](RELAY_VS_PEER_QUICK_REFERENCE.md)

---

## Project Structure

```
flashback/
├── client/                  # Desktop app (Tauri + React)
│   ├── src/                # React UI components
│   ├── src-tauri/          # Rust backend
│   │   └── src/
│   │       ├── main.rs     # Tauri commands
│   │       ├── handlers.rs # Shared command handlers
│   │       ├── http_server.rs # Peer server
│   │       └── cli/        # CLI interface
│   └── cypress/            # E2E tests
│
├── server/                  # Relay Tracker (Next.js)
│   ├── app/api/relay/      # API routes
│   └── db/                 # Database models
│
└── docs/                   # Documentation
    ├── ARCHITECTURE.md
    ├── FEATURES_IMPLEMENTED.md
    ├── NEXT_PHASE.md
    └── QUICK_START.md (this file)
```

---

## Prerequisites

### Required
- Node.js 18+
- Rust 1.70+
- PostgreSQL 14+ (for relay tracker)

### Optional
- pnpm (faster than npm)
- Tauri CLI: `cargo install tauri-cli`

---

## Setup: Client (Desktop App)

### 1. Install Dependencies
```bash
cd client
npm install
```

### 2. Run Development Mode
```bash
# Start Tauri app with hot reload
npm run tauri dev

# Or run tests
npm run test
npm run cypress:open
```

### 3. Build for Production
```bash
npm run tauri build
```

---

## Setup: Server (Relay Tracker)

### 1. Database Setup
```bash
# Create PostgreSQL database
createdb flashback

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your database credentials
```

### 2. Install Dependencies
```bash
cd server
npm install
```

### 3. Run Migrations
```bash
npm run db:migrate
```

### 4. Start Development Server
```bash
npm run dev
# Server runs on http://localhost:3001
```

---

## Key Concepts

### Two-Server Model
```
Relay Tracker (server/)     Peer Server (client/src-tauri/)
    Centralized                  Decentralized
    Port 3000                    Ephemeral port
    Coordinates peers            Serves files
    Next.js + PostgreSQL         Rust + Axum
```

### How File Sharing Works
```
1. User A starts peer server (ephemeral port)
2. User A broadcasts to relay: "I'm online at port 54321"
3. User B queries relay: "Where is User A?"
4. Relay responds: "User A is at port 54321"
5. User B connects directly to User A's peer server
6. Files transfer peer-to-peer (relay not involved)
```

---

## Common Tasks

### Add a New UI Component
```bash
cd client/src/components
mkdir MyComponent
touch MyComponent/MyComponent.tsx
touch MyComponent/index.ts
```

### Add a New Tauri Command
1. Edit `client/src-tauri/src/main.rs`
2. Add `#[tauri::command]` function
3. Register in `.invoke_handler()`
4. Call from React: `invoke('my_command')`

### Add a New Relay API Endpoint
1. Create `server/app/api/relay/myendpoint/route.ts`
2. Export `GET` or `POST` async function
3. Use `initDatabase()` and models
4. Test with curl: `curl http://localhost:3001/api/relay/myendpoint`

### Run Tests
```bash
# Client tests
cd client
npm run test                  # Unit tests
npm run cypress:open          # E2E tests (interactive)
npm run cypress:run           # E2E tests (headless)

# Server tests
cd server
npm run test
```

---

## Configuration

### Client Config (localStorage)
```typescript
{
  fileRootDirectory: "/path/to/share",
  certificatePath: "/path/to/cert.pem",
  relayTrackerUrl: "http://localhost:3001"
}
```

### Server Config (.env.local)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/flashback
PORT=3001
NODE_ENV=development
```

---

## API Quick Reference

### Relay Tracker Endpoints
```bash
# Register certificate
POST /api/relay/register
Body: {email, certificate}

# Broadcast availability (mutual TLS)
POST /api/relay/broadcast/ready
Body: {port, addresses}

# Lookup peer (mutual TLS)
GET /api/relay/broadcast/lookup?email=user@example.com

# List all peers (mutual TLS)
GET /api/relay/broadcast/list
```

### Peer Server Endpoints
```bash
# List files
GET http://127.0.0.1:<port>/api/files
GET http://127.0.0.1:<port>/api/files/subdir

# Get file content
GET http://127.0.0.1:<port>/content/file.txt

# Download file
GET http://127.0.0.1:<port>/download/video.mp4

# Health check
GET http://127.0.0.1:<port>/health
```

---

## Debugging

### Client Logs
- Tauri logs: Check terminal running `npm run tauri dev`
- React logs: Open browser DevTools (Cmd+Option+I)
- Rust logs: Set `RUST_LOG=debug` before running

### Server Logs
- Next.js logs: Check terminal running `npm run dev`
- Database logs: Check PostgreSQL logs
- API logs: Use `console.log()` in route handlers

### Common Issues

**"Database connection failed"**
- Check PostgreSQL is running: `pg_isready`
- Verify .env.local has correct DATABASE_URL
- Run migrations: `npm run db:migrate`

**"Port already in use"**
- Change port in .env.local or config
- Kill process: `lsof -ti:3001 | xargs kill`

**"Tauri command not found"**
- Verify command is registered in `main.rs`
- Rebuild: `npm run tauri build`
- Check browser console for errors

---

## Development Workflow

### Daily Workflow
1. Pull latest: `git pull origin main`
2. Start server: `cd server && npm run dev`
3. Start client: `cd client && npm run tauri dev`
4. Make changes
5. Test locally
6. Commit: `git commit -m "feat: my feature"`
7. Push: `git push`

### Feature Branch Workflow
1. Create branch: `git checkout -b feature/my-feature`
2. Implement feature
3. Test thoroughly
4. Commit changes
5. Push branch: `git push origin feature/my-feature`
6. Create pull request

---

## Testing Strategy

### Unit Tests
- Test individual functions/components
- Mock external dependencies
- Fast execution

### Component Tests
- Test React components in isolation
- Use Cypress component testing
- Verify UI rendering and interactions

### E2E Tests
- Test complete user flows
- Use Cypress or WebdriverIO
- Slower but comprehensive

### Integration Tests
- Test multiple components together
- Verify API contracts
- Database interactions

---

## Project Status

**Phase 1 & 2:** ✅ Complete
- File sharing system working
- UI components implemented
- HTTP server functional
- 55+ E2E tests

**Phase 3:** 📋 Specified, ready to implement
- Friends list with health monitoring
- 5-9 weeks estimated
- Full specification in [NEXT_PHASE.md](NEXT_PHASE.md)

---

## Key Files to Know

### Must Read
- `ARCHITECTURE.md` - System design
- `FEATURES_IMPLEMENTED.md` - What's built
- `NEXT_PHASE.md` - What to build next

### Code Entry Points
- `client/src-tauri/src/main.rs` - Tauri commands
- `client/src-tauri/src/http_server.rs` - Peer server
- `client/src/app/page.tsx` - Main UI
- `server/app/api/relay/*/route.ts` - API endpoints

### Configuration
- `client/src/app/config.ts` - Client settings
- `server/.env.local` - Server environment
- `client/src-tauri/tauri.conf.json` - Tauri config

---

## Getting Help

### Documentation
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [FEATURES_IMPLEMENTED.md](FEATURES_IMPLEMENTED.md) for what exists
- See [NEXT_PHASE.md](NEXT_PHASE.md) for upcoming work

### Code Examples
- Look at existing components in `client/src/components/`
- Check existing API routes in `server/app/api/`
- Review tests in `client/cypress/test/`

### Community
- Open GitHub issue for bugs
- Create discussion for questions
- Submit pull request for improvements

---

## Next Steps

1. **Read** [ARCHITECTURE.md](ARCHITECTURE.md) (10 min)
2. **Explore** codebase (30 min)
3. **Run** development environment (15 min)
4. **Review** [NEXT_PHASE.md](NEXT_PHASE.md) if implementing new features
5. **Start coding!**

---

## Tips for Success

✅ **Do:**
- Read documentation before coding
- Write tests for new features
- Follow existing code patterns
- Commit frequently with clear messages
- Ask questions early

❌ **Don't:**
- Skip reading ARCHITECTURE.md
- Ignore TypeScript errors
- Commit untested code
- Make breaking changes without discussion
- Duplicate existing functionality

---

## Useful Commands Cheat Sheet

```bash
# Client
cd client
npm install              # Install dependencies
npm run tauri dev       # Start development
npm run tauri build     # Build production
npm run test            # Run tests
npm run cypress:open    # Open Cypress

# Server
cd server
npm install              # Install dependencies
npm run dev             # Start development
npm run build           # Build production
npm run db:migrate      # Run migrations
npm test                # Run tests

# Git
git status              # Check status
git add .               # Stage changes
git commit -m "msg"     # Commit
git push                # Push to remote
git pull                # Pull from remote
```

---

**Ready to start? Read [ARCHITECTURE.md](ARCHITECTURE.md) next!**
