# Documentation Archive

## Archived Documents (Obsolete - Git-Based Era)

These documents describe the previous git-based architecture and are kept for historical reference only.

### RemoteHouse/HTTP Integration (Git-Based)
- `REMOTEHOUSE_IMPLEMENTATION.md` - Old HTTP file server implementation
- `REMOTEHOUSE_SECURITY.md` - Security model for git file servers
- `REMOTEHOUSE_HTTP_INTEGRATION.md` - HTTP server integration
- `HTTP_LISTENER_IMPLEMENTATION.md` - HTTP listener architecture
- `HTTP_CACHING_COMPLETE.md` - HTTP caching design

### Relay & Peer Architecture (Git-Based)
- `RELAY_VS_PEER_QUICK_REFERENCE.md` - Old relay vs peer comparison
- `RELAY_TRACKER_PROTOCOL.md` - Git-based relay protocol
- `SERVER_ARCHITECTURE.md` - Old server design

### Implementation Artifacts (Completed)
- `IMPLEMENTATION_COMPLETE.md` - Phase 1 completion report
- `IMPLEMENTATION_PLAN.md` - Old implementation plan
- `IMPLEMENTATION_SUMMARY.md` - Old phase summary
- `HANDLER_IMPLEMENTATION_GUIDE.md` - Old handler design

### Session Notes & Planning (Superseded)
- `NEXT_PHASE.md` - Old next phase planning
- `PHASE_2_*.md` - Phase 2 planning documents (superseded by Fabric architecture)
- `PHASE_3_*.md` - Phase 3 planning documents (superseded)
- `LAUNCH_CHECKLIST_*.md` - Old launch checklists
- `READY_FOR_PHASE_2A.md` - Old phase readiness
- `LEGACY_SCRIPTS.md` - Old RemoteHouse scripts

### Documentation Index & Reference
- `INDEX.md` - Old documentation index
- `DOCUMENTATION_*.md` - Old documentation tracking
- `QUICK_REFERENCE.md` - Old quick reference

## Current Active Documentation (Hyperledger Fabric Era)

### Core Architecture
- **ARCHITECTURE_DESIGN_SUMMARY.md** - Complete system overview
- **FABRIC_DECISION_DOCUMENT.md** - 8 key architectural decisions
- **FABRIC_IMPLEMENTATION_GUIDE.md** - Network topology and deployment

### Implementation
- **FABRIC_TAURI_API_BRIDGE.md** - Complete API specification
- **FABRIC_IMPLEMENTATION_ROADMAP.md** - 8-phase implementation plan (THIS IS YOUR NEXT STEP)
- **PHASE 1 IMPLEMENTATION DOCS** - Start here for backend development

### Data Model
- **REPOSITORY_DATA_MODEL.md** - Data schemas and structures
- **CHANNEL_ARCHITECTURE_CLARIFICATION.md** - Why channels are better
- **SELECTIVE_CHANNEL_SUBSCRIPTION.md** - Peer participation model
- **COMMENT_OWNERSHIP_PERMISSIONS.md** - Permission and ownership model

### Sessions & Status
- **SESSION_COMPLETION_OCT_31.md** - Today's completion summary
- **CA_ARCHITECTURE.md** - Certificate authority design

## How to Use This Archive

If you need to reference old git-based design decisions:
```bash
# View archived docs
ls docs/archive/

# Read old implementation
cat docs/archive/REMOTEHOUSE_IMPLEMENTATION.md
```

## Transition Summary

**Old (Git-Based):**
- RemoteHouse file servers per peer
- HTTP endpoints for queries
- Git repository cloning
- Per-peer file hosting
- Repository metadata centralized on relay tracker

**New (Hyperledger Fabric):**
- Fabric blockchain for immutable entries
- Channel-based repository isolation
- Selective channel subscription
- Comment ownership with X.509 verification
- WebTorrent for file distribution
- RepoBrowser for channel queries

All archived docs represent deprecated architecture. Start with active documentation for current development!
