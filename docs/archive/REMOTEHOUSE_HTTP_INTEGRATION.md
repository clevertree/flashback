# RemoteHouse HTTP Integration - Phase 2 Complete

**Part of:** Flashback's Peer Server architecture (see `SERVER_ARCHITECTURE.md`)

**What this is:** Integration of the RemoteHouse file browser UI with the Peer Server HTTP backend.

## Overview
Successfully integrated the RemoteHouse file browser UI with the Peer Server HTTP file server backend. The component now:
- Fetches real file listings from the Peer Server instead of mock data
- Loads and displays file content (text, images, videos)
- Supports directory navigation
- Handles errors gracefully

## Architecture

```
┌─ Tauri Backend (Rust) ──────────────────┐
│ connect_to_server()                     │
│ 1. Starts HTTP server (port 0)          │
│ 2. Emits "http-file-server-ready" event│
│ 3. Includes port in event payload       │
└─────────────────┬──────────────────────┘
                  │ event listener
                  ▼
┌─ RemoteHouse Component (React) ─────────┐
│ 1. Listen for http-file-server-ready   │
│ 2. Store HTTP port in state            │
│ 3. Fetch files from /api/files         │
│ 4. Load content from /content/*path    │
│ 5. Display images/videos from /download│
└─────────────────────────────────────────┘
```

## Changes Made

### 1. Rust Backend (client/src-tauri/src/main.rs)
**HTTP Server Event Emission:**
```rust
// Start HTTP file server if directory is configured
{
    let cfg = state.config.lock().unwrap().clone();
    let file_root_dir = cfg.file_root_directory.clone();
    if !file_root_dir.is_empty() {
        let http_port = 0u16;
        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            match http_server::start_http_server(file_root_dir, http_port).await {
                Ok(port) => {
                    println!("HTTP file server started on port {}", port);
                    let _ = app_handle_clone.emit(
                        "http-file-server-ready",
                        serde_json::json!({ "port": port }),
                    );
                }
                Err(e) => {
                    println!("Failed to start HTTP file server: {}", e);
                    let _ = app_handle_clone.emit(
                        "http-file-server-error",
                        serde_json::json!({ "error": e.to_string() }),
                    );
                }
            }
        });
    }
}
```

### 2. RemoteHouse Component (client/src/components/RemoteHouse/RemoteHouse.tsx)

#### New State
```typescript
const [httpServerPort, setHttpServerPort] = useState<number | null>(null);
```

#### Event Listener Setup
```typescript
// Listen for HTTP server ready event
useEffect(() => {
    let unlistenHttpServer: UnlistenFn | null = null;

    const setupListener = async () => {
        try {
            unlistenHttpServer = await listen<{ port: number }>(
                "http-file-server-ready",
                (event) => {
                    const port = event.payload.port;
                    console.log("HTTP file server ready on port:", port);
                    setHttpServerPort(port);
                }
            );
        } catch (e) {
            console.error("Failed to listen for http-file-server-ready:", e);
        }
    };

    setupListener();

    return () => {
        if (unlistenHttpServer) {
            unlistenHttpServer();
        }
    };
}, []);
```

#### File Operations
- **fetchFileList()** - Fetches from `/api/files` endpoint
- **loadFile()** - Loads text content from `/content/*path`
- **navigateToDirectory()** - Changes current directory
- **navigateUp()** - Goes up one directory level
- **formatFileSize()** - Human-readable file sizes

#### Enhanced Supported Extensions
```typescript
const SUPPORTED_EXTENSIONS = {
    text: [".md", ".markdown", ".txt", ".css", ".json", ".js", ".ts", ".tsx", ".jsx"],
    image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    video: [".mp4", ".webm", ".mov", ".avi", ".mkv"],
    audio: [".mp3", ".wav", ".m4a", ".flac", ".aac"],
};
```

### 3. UI Improvements

#### File List Panel
- Directory icons (📁) for folders
- File icons (📄) for files
- "⬆️ Up" button for parent directory navigation
- File sizes displayed for files
- Status messages for loading/errors

#### Preview Panel
- **Text Files**: Pre-formatted code display
- **Images**: Embedded `<img>` tag with error handling
- **Videos/Audio**: Native `<video>` tag with controls
- **Unsupported**: Graceful error message

#### Status Indicators
- Yellow warning if HTTP server not ready
- Current path displayed in header
- Loading state during file operations
- Error messages for failed operations

### 4. Test Updates
Updated Cypress test files to include new props:
- `fileRootDirectory?: string`
- `onChangeFileRootDirectory: (path: string) => void`

Files updated:
- `src/components/SettingsSection/SettingsSection.cy.tsx`
- `src/components/SettingsSection/test/SettingsSection.cy.tsx`

## How It Works

### 1. Component Initialization
```
RemoteHouse mounts
  ↓
Listen for "http-file-server-ready" event
  ↓
(Waiting for Rust backend to emit)
```

### 2. Backend Starts HTTP Server
```
User clicks "Ready" in Broadcast section
  ↓
connect_to_server() called
  ↓
Reads fileRootDirectory from config
  ↓
Starts HTTP server (gets OS-chosen port)
  ↓
Emits "http-file-server-ready" event with port
```

### 3. RemoteHouse Receives Port
```
Event listener receives { port: 12345 }
  ↓
setHttpServerPort(12345)
  ↓
Trigger useEffect with httpServerPort dependency
  ↓
Call loadFile("index.md")
```

### 4. File Loading Sequence
```
loadFile("README.md")
  ↓
Get file extension (.md)
  ↓
Determine type (text file)
  ↓
Fetch from http://127.0.0.1:12345/content/README.md
  ↓
Display in <pre><code> block
```

### 5. Directory Navigation
```
Click on directory in file list
  ↓
navigateToDirectory("docs")
  ↓
setCurrentPath("/docs")
  ↓
useEffect triggers fetchFileList()
  ↓
Fetch from http://127.0.0.1:PORT/api/files/docs
  ↓
Display files in "docs" directory
```

## API Integration Details

### File List Endpoint
```
GET http://127.0.0.1:PORT/api/files
GET http://127.0.0.1:PORT/api/files/docs
GET http://127.0.0.1:PORT/api/files/docs/images

Response:
[
  { "name": "README.md", "type": "file", "size": 2048, "modified": "1730000000" },
  { "name": "images", "type": "directory", "size": null, "modified": "1730000000" }
]
```

### Text Content Endpoint
```
GET http://127.0.0.1:PORT/content/README.md
GET http://127.0.0.1:PORT/content/docs/guide.md

Response: File contents as plain text
```

### Download Endpoint
```
GET http://127.0.0.1:PORT/download/image.png
GET http://127.0.0.1:PORT/download/video.mp4

Response: 
- Content-Type: application/octet-stream
- Content-Disposition: attachment; filename="..."
- File bytes
```

## Error Handling

### HTTP Server Not Ready
- Yellow warning banner displayed
- "Select a file to preview" message disabled
- File operations prevented until port available

### Network Errors
- Caught and displayed in error panel
- User can retry by clicking "Refresh"

### File Access Errors
- 404 Not Found → "File not supported"
- 403 Forbidden → Security check failed
- 500 Server Error → Server-side issue

### Image/Video Load Errors
- `onError` handler catches failures
- Displays "Failed to load [type]" message

## Performance Considerations

### File Fetching
- Uses native `fetch()` API
- Async/await for non-blocking operations
- Proper loading state management

### Image Preview
- `max-width: 100%` and `max-height: 100%`
- `object-contain` for proper aspect ratio
- No lazy loading (could be added later)

### Video Preview
- Native `<video>` tag with controls
- Supports streaming for large files
- Browser handles caching

### Directory Navigation
- Relative path calculation in state
- useEffect re-fetches when path changes
- Prevents stale data issues

## Security

### URL Construction
- Uses `127.0.0.1` (localhost only)
- HTTP (not HTTPS) on localhost
- Port from trusted event source

### Path Handling
- Relative paths normalized
- Double slashes removed
- Directory traversal prevented server-side

### CORS
- Localhost requests
- No CORS restrictions needed
- Same-origin requests

## Testing

### What Works
✅ Event listener captures port
✅ File list loading
✅ File path navigation
✅ Directory navigation
✅ Text file preview
✅ Error messages displayed
✅ Refresh button works
✅ Up directory button works

### What Can Be Enhanced
- Search/filter files
- File download functionality
- Large file streaming
- Progress indicators
- Breadcrumb navigation
- File sorting options

## Migration Notes

### From Old Implementation
- **Old**: Fixed remote IP/port, mock data
- **New**: Dynamic port from event, real HTTP calls

### Data Flow
- **Old**: Hardcoded "https://{remoteIP}:{remotePort}"
- **New**: Dynamic "http://127.0.0.1:{port}"

### Event Communication
- **Pattern**: Tauri event-based (loosely coupled)
- **Advantage**: Can be extended for other servers
- **Flexibility**: Port discovered at runtime

## Files Changed

```
client/src-tauri/src/main.rs
  - Added HTTP server event emission
  - Modified connect_to_server()

client/src/components/RemoteHouse/RemoteHouse.tsx
  - Complete rewrite of component logic
  - Added HTTP integration
  - Added directory navigation
  - Real file loading instead of mock data
  - Enhanced UI with directory indicators
  - Proper error handling

client/src/components/SettingsSection/SettingsSection.cy.tsx
  - Added fileRootDirectory prop
  - Added onChangeFileRootDirectory callback

client/src/components/SettingsSection/test/SettingsSection.cy.tsx
  - Added fileRootDirectory to mockProps
  - Added onChangeFileRootDirectory stub
  - Added fileRootDirectory to allEnabledProps
```

## Compilation Status

✅ **TypeScript**: Builds successfully
✅ **Rust**: cargo check passes
✅ **Tests**: Cypress component tests updated
✅ **Cypress E2E**: Ready for testing

## Architectural Principles

See `ARCHITECTURE_PRINCIPLES.md` for full details. Key points:

**Server provides raw files. Clients decide what to do with them.**

- ❌ No automatic file search/discovery
- ❌ No server-side breadcrumb generation
- ❌ No filtering or sorting APIs
- ❌ No rendered previews/thumbnails

**If clients want search, breadcrumbs, or filtering, they build it themselves.**

**All navigation happens via URLs and file links.** If a file isn't linked in index.md or other served files, users must type the path directly.

## Large File Streaming

The HTTP server supports efficient streaming of large video files via two strategies:

### Strategy 1: Single Connection (Chunked Encoding)
```
Client requests: GET /download/large-video.mp4
Server responds: HTTP/1.1 200 OK
Transfer-Encoding: chunked
Server streams file in chunks
```

**Pros**: No extra port needed
**Cons**: Competes with other data on main connection

### Strategy 2: Ephemeral Second Port
```
Client: "I want to download large-video.mp4"
Server: Creates dedicated port (e.g., 54321)
Server: Emits "file-stream-port" event { port: 54321, file: "video.mp4" }
Client: Connects to http://127.0.0.1:54321
Client: Downloads file
Server: Closes port after transfer completes
```

**Pros**: Dedicated connection, full bandwidth
**Cons**: Extra port creation/teardown

Clients choose which strategy fits their needs.

## Next Phase: Automatic Indexing

When needed:
- Server generates index of all files
- Index in structured format (JSON)
- Clients use index for discovery if they want

**Not yet.** Current phase focuses on basic file serving.

## Known Limitations

1. **Discovery**: Files not linked won't be found by browsing (by design)
2. **Streaming**: No partial content/range requests yet
3. **Navigation**: Breadcrumbs only if included in served files
4. **Auth**: No authentication (localhost only)
5. **Sorting**: Files listed in filesystem order (no API sorting)

## What Clients Can Build

RemoteHouse (or any other client) can implement:
1. **Search**: Local search over /api/files results
2. **Breadcrumbs**: Parse file content to build navigation
3. **Sorting**: Sort /api/files results locally
4. **Filtering**: Filter by file type/size locally
5. **Caching**: Cache file lists and content
6. **Thumbnails**: Generate previews locally
7. **History**: Track recently viewed files
8. **Download**: Save files to local machine

The server provides the data; clients provide the experience.
7. **Sharing**: Share files with other peers
