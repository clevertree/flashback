# Architecture Update: Core Principles Clarified

## Important: Relay Tracker vs Peer Server

See `SERVER_ARCHITECTURE.md` for the critical distinction between:
- **Relay Tracker** - Centralized coordinator (Next.js backend)
- **Peer Server** - Client-hosted file server (HTTP listener in Tauri)

These are two different HTTP servers with different purposes.

## What Changed

Based on clarification of project philosophy, the architecture has been refined:

### Old Approach (Removed)
- ❌ `PHASE_3_FILE_SEARCH_FILTERING.md` - File search/filtering specification
- Server was expected to provide hints for client rendering
- Breadcrumb navigation considered as server feature
- Automatic file indexing was planned

### New Approach (Implemented)
- ✅ `ARCHITECTURE_PRINCIPLES.md` - Core philosophy documented
- Server is strictly a **data provider**, not a UI framework
- Clients are responsible for their own rendering and behavior
- Navigation is URL-based and file-link-based
- No automatic discovery of files not explicitly linked

## Key Principles

### 1. Remote Clients Own Their Behavior
The Flashback relay server does not dictate what remote clients display or how they behave. This extends to the HTTP file server.

### 2. Server Provides Data, Not UI
```
Server: "Here are the files you requested"
Client: "I'll decide how to display them"
```

### 3. Explicit Over Implicit Discovery
- If a file isn't linked in served content, users must type the URL directly
- This is a feature, not a limitation
- Allows servers to keep certain files "hidden" without actually hiding them

### 4. No Search/Filtering on Server
- Clients can build search locally if they want
- No server API for file discovery
- Clients request specific files or directories

### 5. No Server-Side Breadcrumbs
- Breadcrumbs are determined by served file content (links in markdown/HTML)
- Clients can build breadcrumb UI if they parse file links
- Navigation structure is explicit, not inferred

## What This Means for Implementation

### For Phase 2 (Current)
✅ HTTP file server works as designed
✅ RemoteHouse fetches and displays files
✅ Directory navigation works (via /api/files endpoints)
✅ Everything stays as-is

### For Phase 3 (Future)
🚀 Instead of:
  - Server-side file search
  - Server-side filtering
  - Server-side breadcrumb hints

🚀 Consider:
  - Automatic indexing (server generates JSON index of all files)
  - Clients use index for discovery if they want
  - Clients build their own search/filter/breadcrumbs from index

### For Large Files
✅ Streaming via single connection (chunked encoding) works now
🚀 Future: Ephemeral second port option for dedicated large file transfers

## Architecture Documentation

### `ARCHITECTURE_PRINCIPLES.md` (NEW)
Comprehensive guide covering:
- Core philosophy: Clients own rendering
- What server provides (file serving, basic metadata)
- What server doesn't provide (search, indexing, breadcrumbs)
- What clients can build (search, filters, navigation, caching)
- Why this approach (flexibility, security, simplicity)
- Example client implementations
- Future considerations (automatic indexing)

### `HTTP_LISTENER_IMPLEMENTATION.md` (UPDATED)
- No changes needed - still applies
- Focuses on file serving mechanism
- Documents security model
- Explains endpoints

### `REMOTEHOUSE_HTTP_INTEGRATION.md` (UPDATED)
- Added architectural principles section
- Explained large file streaming strategies
- Removed references to search/filtering as server features
- Clarified what clients can build themselves
- Noted that future breadcrumbs require client parsing of file links

## Files Created/Modified

### Created
- `ARCHITECTURE_PRINCIPLES.md` - Full architecture guide

### Modified
- `REMOTEHOUSE_HTTP_INTEGRATION.md` - Added principles and large file streaming info
- Removed `PHASE_3_FILE_SEARCH_FILTERING.md` (no longer needed)

### Existing (No Changes Needed)
- `HTTP_LISTENER_IMPLEMENTATION.md` - Still valid
- Rust code - Still valid
- React code - Still valid
- Tests - Still valid

## Next Steps

### Immediate (Phase 2 Continuation)
1. ✅ Documentation complete
2. 🔄 Update Cypress E2E tests (in progress)
3. ✅ Code compiles (verified)

### Future (Phase 3+)
1. Implement comprehensive E2E tests
2. Consider automatic indexing feature
3. Large file streaming (ephemeral port option)
4. Client-specific features built by clients

## Validation

**All existing code remains valid:**
- ✅ HTTP server module works as designed
- ✅ RemoteHouse integration works as designed
- ✅ Configuration system works as designed
- ✅ Tauri event system works as designed
- ✅ Security model is sound

**No refactoring needed** - architecture was sound, philosophy is now clarified.

## Benefit of This Approach

### For Server Developers
- Less code to maintain
- Clear separation of concerns
- Fewer edge cases to handle
- Easier testing

### For Client Developers
- Total freedom in UI implementation
- Can build any browsing experience they want
- Can implement search/filter however they like
- Can build specialized clients for specific use cases

### For Security
- No server hints about file structure
- Clients control what gets exposed
- Explicit URL requirement prevents accidental discovery
- Localhost-only binding prevents remote attacks

## Summary

**The HTTP file server is now explicitly a data provider, not a UI framework.** This clarification doesn't change any code—everything works correctly already. It clarifies the vision:

- **Server**: "Here are your files"
- **Clients**: "Here's how we want to browse them"
- **User**: Gets exactly the experience the client developer designed

This enables diverse client implementations while keeping the server simple and secure.
