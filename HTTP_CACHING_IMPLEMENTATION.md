# 🌐 HTTP File Caching & URL Serving - Implementation Guide

**Date:** October 30, 2025  
**Feature:** HTTP Cache Strategy + Local File Serving  
**Status:** Design Ready for Implementation  
**Priority:** HIGH - Enables RemoteHouse browser integration

---

## 📋 Summary

This feature adds intelligent HTTP caching and file serving capabilities to the Flashback client:

1. **Smart Cache Management** - Cache remote files with ETag/Last-Modified validation
2. **HTTP Server** - Serve cached files via `http://localhost:PORT/` for browser use
3. **URL-Based File References** - Enable files to link to each other via URLs
4. **Cache Optimization** - Reduce bandwidth with 304 Not Modified responses
5. **CLI & UI Support** - Works in both CLI and browser clients

---

## 🎯 Key Use Cases

### Use Case 1: Image Rendering
```typescript
// Get URL for an image from remote client
const imageUrl = cache.getFileUrl('photos/architecture.png');

// Use directly in HTML
<img src={imageUrl} alt="Architecture" />
```

### Use Case 2: Video Playback
```typescript
// Get URL for a video from remote client
const videoUrl = cache.getFileUrl('videos/demo.mp4');

// Use directly in HTML5 video tag
<video src={videoUrl} controls width="640" height="480" />
```

### Use Case 3: Markdown with Embedded Resources
```markdown
# My Guide

![Diagram](http://localhost:8888/remote/user@example.com/diagrams/arch.png)

[Link to API docs](http://localhost:8888/remote/user@example.com/docs/api.md)

[Link to video](http://localhost:8888/remote/user@example.com/videos/tutorial.mp4)
```

### Use Case 4: Cross-File Linking
```html
<!-- In HTML rendered from remote file -->
<a href="http://localhost:8888/remote/user@example.com/related-doc.md">Related Document</a>
<img src="http://localhost:8888/remote/user@example.com/images/banner.jpg" />
```

---

## 🏗️ Architecture Overview

### Component Hierarchy
```
┌─ Browser / Next.js UI ─────────────────────┐
│                                             │
│  RemoteHouse Component                      │
│  ├─ useRemoteCache Hook                     │
│  │  └─ RemoteCacheManager                   │
│  │     ├─ getFileUrl()                      │
│  │     ├─ cacheRemoteFile()                 │
│  │     └─ HTTP requests to server           │
│  │                                           │
│  └─ Rendered Content                        │
│     ├─ <img src="http://localhost:PORT/...  │
│     ├─ <video src="http://localhost:PORT..  │
│     └─ <a href="http://localhost:PORT/...   │
│                                             │
└──────────────────┬──────────────────────────┘
                   │
        HTTP GET /remote/{email}/{path}
                   │
                   ▼
┌─ Tauri Backend (Rust) ────────────────────┐
│                                            │
│  HTTP Server (Axum)                        │
│  ├─ /remote/{email}/{path}                 │
│  ├─ /r/{client_hash}/{file_hash}           │
│  ├─ /api/cache/status                      │
│  └─ /api/cache/clear                       │
│                                            │
│  Cache Manager (Rust)                      │
│  ├─ ~/.cache/flashback/remote_clients/     │
│  ├─ Load/save metadata.json                │
│  ├─ ETag validation                        │
│  └─ Cache expiration                       │
│                                            │
└──────────────────┬───────────────────────────┘
                   │
        HTTPS to Remote Client
                   │
                   ▼
        ┌─ Remote Client Files ──┐
        │ /files/photo.jpg       │
        │ /files/video.mp4       │
        │ /files/README.md       │
        └────────────────────────┘
```

---

## 📂 File Structure

### TypeScript Utilities
```
client/src/util/
├── remoteCacheManager.ts (NEW)      ← URL generation & cache management
├── secureConnection.ts               ← Fetch from remote (existing)
└── cryptoBridge.ts                   ← Bridge to Tauri (existing)
```

### Rust Backend
```
client/src-tauri/src/
├── cache.rs (NEW)                   ← Cache manager in Rust
├── http_server.rs (NEW)              ← Axum HTTP server
├── main.rs                           ← Main integration
└── cli/                              ← CLI support
```

---

## 🔄 Cache Flow Diagram

### First Request (Cache Miss)
```
1. User clicks file in RemoteHouse
2. getFileUrl() called → http://localhost:8888/remote/user@example.com/file.md
3. HTTP GET to local server
4. Server fetches from remote client (HTTPS with ETag)
5. Response 200 OK + ETag + Last-Modified
6. Server caches file locally
7. Server stores metadata.json with ETag
8. Server returns file to browser
9. Browser renders file
```

### Second Request (Cache Hit)
```
1. User requests same file again
2. getFileUrl() returns same URL
3. HTTP GET to local server with If-None-Match header
4. Server checks cache, ETag matches
5. Server revalidates with remote (sends If-None-Match)
6. Remote responds 304 Not Modified
7. Server responds 304 Not Modified to browser
8. Browser uses cached version
9. Zero bandwidth used (only headers)
```

### After Cache Expiration
```
1. User requests file after max-age expires
2. getFileUrl() returns same URL
3. HTTP GET to local server
4. Cache entry expired, fetch fresh
5. Remote might return 304 or 200 with new content
6. Update local cache if changed
7. Return to browser
```

---

## 🔒 Security Features

### 1. Path Traversal Protection
```typescript
// ✅ SAFE - Normal file paths
http://localhost:8888/remote/user@example.com/README.md
http://localhost:8888/remote/user@example.com/docs/guide.md

// ❌ BLOCKED - Path traversal attempts
http://localhost:8888/remote/user@example.com/../../../etc/passwd
http://localhost:8888/remote/user@example.com/../../secret.key
```

### 2. File Type Whitelist
```typescript
ALLOWED_EXTENSIONS: [
  '.md', '.markdown', '.txt', '.css',        // Text
  '.jpg', '.jpeg', '.png', '.gif', '.webp',  // Images
  '.mp4', '.webm', '.mov', '.avi',           // Video
  '.mp3', '.wav', '.m4a', '.flac'            // Audio
]

// Only these types served from HTTP server
```

### 3. Localhost-Only Access
```typescript
// Only accept requests from localhost
function validateOrigin(host: string): boolean {
  return (
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:') ||
    host.startsWith('[::1]:')
  );
}
```

### 4. Certificate Validation
```typescript
// When fetching from remote client
- Verify client certificate
- Use HTTPS only
- Validate ETag/signatures
- Reject invalid content-type
```

---

## 📊 HTTP Cache Headers

### Request to Local Server
```http
GET /remote/user@example.com/file.md HTTP/1.1
Host: localhost:8888
If-None-Match: "abc123def456"
If-Modified-Since: Wed, 29 Oct 2025 10:30:00 GMT
Cache-Control: max-age=0
```

### Response from Local Server (200 OK)
```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Content-Length: 2048
ETag: "abc123def456"
Last-Modified: Wed, 29 Oct 2025 10:30:00 GMT
Cache-Control: public, max-age=3600
X-Cache: MISS
X-Cache-Key: user@example.com:file.md
Date: Wed, 30 Oct 2025 12:00:00 GMT
```

### Response from Local Server (304 Not Modified)
```http
HTTP/1.1 304 Not Modified
ETag: "abc123def456"
Last-Modified: Wed, 29 Oct 2025 10:30:00 GMT
Cache-Control: public, max-age=3600
X-Cache: HIT
X-Cache-Key: user@example.com:file.md
Date: Wed, 30 Oct 2025 12:00:00 GMT
```

---

## 💻 Implementation Details

### Part 1: TypeScript - remoteCacheManager.ts

**Already Created** - Available at `client/src/util/remoteCacheManager.ts`

Key methods:
- `getFileUrl(filePath)` - Get URL for a file
- `cacheRemoteFile(filePath, options)` - Cache a file
- `isCacheFresh(filePath)` - Check if cached
- `clearCache()` - Clear all cache
- `useRemoteCache()` - React hook

### Part 2: Rust - cache.rs Module

**To Create** - Add to `client/src-tauri/src/cache.rs`

```rust
pub struct CacheManager {
    cache_dir: PathBuf,
    client_email: String,
}

impl CacheManager {
    pub async fn get_cached_file(&self, file_path: &str) -> Option<CacheEntry>
    pub async fn cache_file(&self, ...) -> Result<CacheEntry>
    pub async fn should_revalidate(&self, entry: &CacheEntry) -> bool
    pub async fn clear_expired_entries(&self) -> Result<()>
}
```

### Part 3: Rust - http_server.rs Module

**To Create** - Add to `client/src-tauri/src/http_server.rs`

```rust
pub struct FileServer {
    config: HttpServerConfig,
    cache_manager: Arc<RwLock<CacheManager>>,
}

impl FileServer {
    pub async fn start(&self) -> Result<()>
    async fn serve_file_handler(...) -> impl IntoResponse
    async fn cache_status_handler(&self) -> impl IntoResponse
    async fn cache_clear_handler(&self) -> impl IntoResponse
}
```

### Part 4: Integration in main.rs

**To Update** - Modify `client/src-tauri/src/main.rs`

```rust
// 1. Create cache manager
let cache_manager = CacheManager::new(user_email);

// 2. Create HTTP server
let server = FileServer::new(
    HttpServerConfig {
        port: 8888,
        cache_enabled: true,
        max_file_size: 500 * 1024 * 1024, // 500 MB
    },
    cache_manager,
);

// 3. Start server in background
tokio::spawn(async move {
    if let Err(e) = server.start().await {
        eprintln!("HTTP server error: {}", e);
    }
});

// 4. Expose port to frontend
app.state().http_server_port = 8888;
```

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] **URL Generation**
  - [ ] URLs format correctly
  - [ ] Special characters encoded properly
  - [ ] Compact URLs generate correctly

- [ ] **Image Serving**
  - [ ] Request `http://localhost:8888/remote/user@example.com/photo.jpg`
  - [ ] Image displays in browser
  - [ ] ETag header present in response

- [ ] **Video Serving**
  - [ ] Request `http://localhost:8888/remote/user@example.com/video.mp4`
  - [ ] Video plays in browser with controls
  - [ ] Seeking works correctly

- [ ] **Cache Hit/Miss**
  - [ ] First request returns 200 (cache miss)
  - [ ] Second request returns 304 (cache hit)
  - [ ] Server sends If-None-Match header

- [ ] **Cache Expiration**
  - [ ] Cache expires after max-age
  - [ ] Expired cache re-fetches automatically
  - [ ] Updated content loaded

- [ ] **Security**
  - [ ] Path traversal blocked (../ rejected)
  - [ ] HTML files blocked (content-type check)
  - [ ] Localhost-only access enforced

### Automated Testing (Cypress)

```typescript
describe('HTTP File Serving', () => {
  it('should serve image files via HTTP', () => {
    cy.visit('http://localhost:3000');
    // Navigate to RemoteHouse
    // Image URL should be http://localhost:8888/remote/...
    cy.get('img').should('have.attr', 'src').and('include', 'localhost:8888');
  });

  it('should cache files and return 304', () => {
    cy.visit('http://localhost:3000');
    // Make two requests to same file
    // Second request should have cache headers
  });

  it('should block HTML files', () => {
    cy.request({
      url: 'http://localhost:8888/remote/user@example.com/malicious.html',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(403); // Forbidden
    });
  });
});
```

---

## 🚀 Usage in Components

### RemoteHouse Component Update
```typescript
import { useRemoteCache } from '@/util/remoteCacheManager';

export default function RemoteHouse({ clientEmail }: RemoteHouseProps) {
  const cache = useRemoteCache(clientEmail);

  return (
    <div>
      {filePreviewType === 'image' && selectedFile && (
        <img 
          src={cache.getFileUrl(selectedFile.name)}
          alt={selectedFile.name}
          style={{ maxWidth: '100%' }}
        />
      )}

      {filePreviewType === 'video' && selectedFile && (
        <video
          src={cache.getFileUrl(selectedFile.name)}
          controls
          style={{ maxWidth: '100%' }}
        />
      )}

      {filePreviewType === 'text' && selectedFile && (
        <div>
          {/* For markdown with embedded images */}
          <img src={cache.getFileUrl('images/diagram.png')} />
          
          {/* For CSS styling */}
          <style>
            {`@import url('${cache.getFileUrl('styles/theme.css')}');`}
          </style>
        </div>
      )}
    </div>
  );
}
```

---

## 📈 Performance Metrics

### Bandwidth Savings with Caching
```
Without caching:
- First request:  100 KB file download
- Second request: 100 KB file download (wasteful!)
- Total: 200 KB

With caching + ETag:
- First request:  100 KB file download
- Second request: ~500 bytes headers only (304 Not Modified)
- Total: ~100.5 KB

Savings: ~99.75% on cached requests!
```

### Response Times
```
Without caching:
- Cold: ~500ms (fetch from remote)
- Warm: ~500ms (fetch again)
- Average: 500ms

With caching:
- Cold: ~500ms (fetch from remote)
- Warm: ~50ms (local file + ETag validation)
- Average: ~275ms

Speed improvement: ~45% average
```

---

## ✅ Implementation Checklist

### Phase 1: TypeScript Cache Manager
- [x] Create `remoteCacheManager.ts` with RemoteCacheManager class
- [x] Implement getFileUrl() and getFileUrlCompact()
- [x] Implement cacheRemoteFile() with ETag support
- [x] Add React hook useRemoteCache()
- [x] Add cache status tracking
- [ ] Integration tests

### Phase 2: Rust Cache Infrastructure
- [ ] Create `cache.rs` module with CacheManager
- [ ] Implement local file caching
- [ ] Implement metadata.json storage
- [ ] Implement ETag/Last-Modified validation
- [ ] Unit tests

### Phase 3: Rust HTTP Server
- [ ] Create `http_server.rs` module with FileServer
- [ ] Setup Axum router
- [ ] Implement /remote/{email}/{path} endpoint
- [ ] Implement /r/{hash}/{hash} endpoint
- [ ] Implement /api/cache/status endpoint
- [ ] Implement /api/cache/clear endpoint
- [ ] Add proper error handling

### Phase 4: Integration & Testing
- [ ] Update main.rs to start HTTP server
- [ ] Expose server port to frontend
- [ ] Add Cypress E2E tests
- [ ] Manual testing checklist
- [ ] Performance testing
- [ ] Security audit

---

## 📝 Configuration

### Cache Location
```
Linux/Mac:   ~/.cache/flashback/remote_clients/{email}/
Windows:     %APPDATA%\flashback\cache\remote_clients\{email}\
```

### Server Configuration
```typescript
{
  httpServerPort: 8888,           // Local HTTP server port
  cacheEnabled: true,              // Enable file caching
  maxFileSi ze: 500 * 1024 * 1024, // Max file size (500 MB)
  cacheMaxAge: 3600,               // Cache TTL in seconds (1 hour)
  cacheMaxSize: 1 * 1024 * 1024 * 1024, // Max cache size (1 GB)
}
```

---

## 🎯 Success Criteria

- [x] remoteCacheManager.ts created and compiles
- [ ] Cache files locally with metadata
- [ ] HTTP server runs on localhost:8888
- [ ] URLs work in browser for images/videos
- [ ] ETag-based validation working
- [ ] 304 responses reduce bandwidth
- [ ] Markdown links to other files work
- [ ] CLI client can access HTTP server
- [ ] Cache expires after max-age
- [ ] Security: No path traversal possible
- [ ] Performance: <100ms for cached files

---

## 📚 References

- **HTTP Caching Spec:** https://tools.ietf.org/html/rfc7234
- **ETag:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
- **Last-Modified:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified
- **Cache-Control:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
- **Axum Framework:** https://github.com/tokio-rs/axum
- **Tauri Rust API:** https://tauri.app/en/v1/api/rust/

---

## 🎓 Next Steps

1. **Review** this document and HTTP_CACHING_DESIGN.md
2. **Implement Phase 1-4** in order
3. **Test** each phase before moving to next
4. **Document** any deviations from design
5. **Integrate** into RemoteHouse component
6. **Verify** all security checks pass

---

**Status:** Design Complete - Ready for Implementation  
**Estimated Implementation Time:** 6-8 hours (4 phases)  
**Complexity:** Medium-High (Rust HTTP server + caching logic)

