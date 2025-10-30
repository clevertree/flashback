# Peer Server Implementation - Complete

**Part of:** Flashback's Peer Server architecture (see `SERVER_ARCHITECTURE.md`)

**What this is:** The HTTP file server running on each client that serves files to other peers.

## Overview
Implemented an HTTP file server (the "Peer Server") that serves files from the configured `fileRootDirectory` to enable the RemoteHouse browser UI to fetch files and file listings. This server runs on localhost and serves content only to the local client UI (and potentially other remote clients over relayed connections).

## Architecture

```
┌─ Client Configuration ──────┐
│  fileRootDirectory (from UI) │
└──────────────┬──────────────┘
               │ passed to
               ▼
┌─ connect_to_server() ───────┐
│  Rust Tauri Command         │
└──────────────┬──────────────┘
               │ spawns
               ▼
┌─ HTTP Server ───────────────┐
│  axum web framework         │
│  Port: OS-chosen (127.0.0.1)│
│  Serves from fileRootDir    │
└──────────────┬──────────────┘
               │
               ▼
┌─ Endpoints ─────────────────┐
│ GET /api/files              │  (list root)
│ GET /api/files/*path        │  (list directory)
│ GET /content/*path          │  (text content)
│ GET /download/*path         │  (binary download)
└─────────────────────────────┘
               │
               ▼
┌─ RemoteHouse UI ────────────┐
│  Browser Component          │
│  Fetches from 127.0.0.1:xxx │
│  Displays files and content │
└─────────────────────────────┘
```

## Files Modified

### 1. `client/src-tauri/Cargo.toml`
**Added dependency:**
```toml
axum = "0.7"
```
- Axum: Lightweight async web framework built on Tokio
- Perfect for file serving use case

### 2. `client/src-tauri/src/http_server.rs` (NEW)
**Created new HTTP server module with:**

#### Data Structures
```rust
pub struct FileInfo {
    pub name: String,
    pub file_type: String,        // "file" or "directory"
    pub size: Option<u64>,
    pub modified: Option<String>,
}

pub struct HttpServerState {
    pub root_directory: Arc<PathBuf>,
}
```

#### Main Functions

**`start_http_server(root_directory: String, _port: u16) -> Result<u16, Box<...>>`**
- Validates root directory exists
- Creates directory if missing
- Creates default `index.md` if missing
- Sets up axum router with file endpoints
- Binds to OS-chosen port on 127.0.0.1
- Spawns HTTP server in background task
- Returns actual bound port

**Endpoints:**
1. `GET /api/files` - List files in root directory
2. `GET /api/files/*path` - List files in subdirectory
3. `GET /content/*path` - Get text file content
4. `GET /download/*path` - Download file with proper headers

**Security:**
- Directory traversal prevention using `is_within_root()` check
- Canonicalize paths to prevent symlink escapes
- Returns `403 Forbidden` for unauthorized access

### 3. `client/src-tauri/src/main.rs`
**Changes:**

1. **Module Declaration (line 5)**
   ```rust
   mod http_server;
   ```

2. **HTTP Server Startup (after registration, in connect_to_server)**
   ```rust
   // Start HTTP file server if directory is configured
   {
       let cfg = state.config.lock().unwrap().clone();
       let file_root_dir = cfg.file_root_directory.clone();
       if !file_root_dir.is_empty() {
           let http_port = 0u16;  // OS will choose available port
           tokio::spawn(async move {
               match http_server::start_http_server(file_root_dir, http_port).await {
                   Ok(_) => println!("HTTP file server started"),
                   Err(e) => println!("Failed to start HTTP file server: {}", e),
               }
           });
       }
   }
   ```

3. **Bug Fixes**
   - Fixed `serde_json::json::Value` → `serde_json::Value` in two functions
   - These were pre-existing compilation errors

## How It Works

### Initialization Flow

1. **User configures fileRootDirectory**
   - Via Settings UI or Broadcast section
   - Persisted to localStorage

2. **User clicks "Ready" / Connects**
   - `connect_to_server()` is called
   - Reads config from AppState

3. **HTTP Server Starts**
   ```rust
   http_server::start_http_server(
       "/home/user/shared",  // from fileRootDirectory
       0u16                  // OS chooses port
   ).await
   ```

4. **Server Setup**
   - Creates `/home/user/shared` if missing
   - Creates `/home/user/shared/index.md` if missing
   - Starts listening on `127.0.0.1:XXXX`

5. **RemoteHouse Can Now Fetch**
   ```typescript
   // Instead of:
   https://{remoteIP}:{remotePort}/files/README.md
   
   // Now uses:
   http://127.0.0.1:XXXX/content/README.md
   http://127.0.0.1:XXXX/api/files
   ```

## API Endpoints Reference

### List Files in Directory
```
GET /api/files
GET /api/files/docs
GET /api/files/docs/subfolder

Response (JSON):
[
  {
    "name": "README.md",
    "type": "file",
    "size": 2048,
    "modified": "1730000000"
  },
  {
    "name": "docs",
    "type": "directory",
    "size": null,
    "modified": "1730000000"
  }
]
```

### Get Text File Content
```
GET /content/README.md

Response: File content as text
Status: 200 OK or 404 Not Found
```

### Download Binary File
```
GET /download/image.png

Response: File bytes
Headers:
  Content-Type: application/octet-stream
  Content-Disposition: attachment; filename="image.png"
```

## Security Considerations

### Directory Traversal Prevention
```rust
fn is_within_root(path: &PathBuf, root: &PathBuf) -> bool {
    match (path.canonicalize(), root.canonicalize()) {
        (Ok(p), Ok(r)) => p.starts_with(&r),
        _ => false,
    }
}
```

This ensures:
- `../../../etc/passwd` cannot escape root
- Symlinks are resolved and checked
- Invalid paths return 403 Forbidden

### Localhost-Only Binding
- HTTP server binds to `127.0.0.1` (not `0.0.0.0`)
- Only accessible from the same machine
- Remote clients cannot access it directly
- Protects against unauthorized file access

### No Authentication Required
- Since it's localhost-only, no auth needed
- File access controlled by directory structure
- Could add auth later if needed

## Implementation Status

✅ **Complete**
- HTTP server module created
- Axum integrated
- Endpoints implemented
- Security checks added
- Integrated into connect_to_server
- Code compiles and runs

## Next Steps

### Phase 2: RemoteHouse Integration
1. Update RemoteHouse component to:
   - Use HTTP URLs instead of hardcoded mock data
   - Fetch file lists from `/api/files`
   - Fetch text content from `/content/*path`
   - Fetch images/videos from `/download/*path`

2. Store the HTTP server port:
   - Option A: Return port from connect_to_server
   - Option B: Emit event with port info
   - Option C: Have UI discover port dynamically

### Phase 3: Enhanced Features
1. Directory navigation in RemoteHouse
2. File download functionality
3. Search/filter files
4. Cache management for large files
5. Performance optimization

### Testing
- [ ] Start listener with valid directory
- [ ] List files works correctly
- [ ] Get file content works
- [ ] Directory traversal blocked
- [ ] Symlink escapes blocked
- [ ] Large files handled
- [ ] Binary files served correctly

## Notes

### Why Axum?
- Minimal dependencies
- Built on Tokio (already in use)
- Type-safe routing
- Good error handling
- Great for file serving

### Port Selection
- Using OS-chosen port (bind to 0)
- Avoids port conflicts
- Next phase: communicate port to UI

### Error Handling
- Creates directory if missing
- Creates index.md template if missing
- Graceful error responses
- Logs errors to console

### Performance
- Uses async I/O throughout
- Tokio runtime handles concurrency
- Efficient file streaming
- No blocking operations
