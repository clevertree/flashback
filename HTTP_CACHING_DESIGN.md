# 🚀 HTTP Caching & File Serving Architecture

**Status:** Design Phase - Implementation Ready  
**Date:** October 30, 2025  
**Priority:** HIGH - Enables RemoteHouse browser integration  
**Estimated Implementation:** 4-6 hours

---

## 📋 Overview

Implement a comprehensive HTTP caching and file serving system that:

1. **Caches remote files** in local temp directory with smart cache invalidation
2. **Serves cached files via HTTP** on a local port for browser consumption
3. **Uses best practices for HTTP caching** (ETag, Last-Modified, Cache-Control)
4. **Enables URL-based file references** for HTML, images, videos, etc.
5. **Works in both CLI and UI clients** with same backend logic
6. **Allows client files to link to each other** via URLs

---

## 🏗️ Architecture Design

### Components

```
┌─────────────────────────────────────────────────────┐
│                    Remote Client                     │
│  (Files to be viewed)                               │
└────────────────┬──────────────────────────────────────┘
                 │ HTTP/Secure Connection
                 ▼
┌─────────────────────────────────────────────────────┐
│              Local Flashback Client                  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  File Cache Manager                         │  │
│  │  - Fetch remote files                       │  │
│  │  - Cache with ETag/Last-Modified            │  │
│  │  - Detect changes via HTTP headers          │  │
│  │  - Store in temp directory                  │  │
│  └──────────────────────────────────────────────┘  │
│                     ▼                               │
│  ┌──────────────────────────────────────────────┐  │
│  │  Local HTTP Server                          │  │
│  │  - Serve cached files on localhost:PORT     │  │
│  │  - Handle URL requests                      │  │
│  │  - Support file linking                     │  │
│  │  - Run in Tauri backend (Rust)              │  │
│  └──────────────────────────────────────────────┘  │
│                     ▼                               │
│  ┌──────────────────────────────────────────────┐  │
│  │  Browser (Next.js UI)                       │  │
│  │  - Request files via http://localhost:PORT  │  │
│  │  - Render in browser                        │  │
│  │  - Support for img/video tags               │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 File Cache Strategy

### Cache Location
```
~/.cache/flashback/remote_clients/{client_email}/
├── metadata.json              (Cache metadata with ETags)
├── files/
│   ├── README.md
│   ├── guide.md
│   ├── photo.jpg
│   └── video.mp4
└── http_cache.sqlite          (Optional: SQLite cache DB)
```

### Cache Metadata (JSON)
```json
{
  "cache_version": 1,
  "client_email": "user@example.com",
  "last_sync": "2025-10-30T12:00:00Z",
  "files": {
    "README.md": {
      "etag": "\"abc123def456\"",
      "last_modified": "Wed, 29 Oct 2025 10:30:00 GMT",
      "size": 2048,
      "cached_at": "2025-10-30T11:55:00Z",
      "local_path": "files/README.md",
      "url": "http://localhost:8888/files/README.md"
    },
    "photo.jpg": {
      "etag": "\"xyz789uvw123\"",
      "last_modified": "Tue, 28 Oct 2025 15:20:00 GMT",
      "size": 102400,
      "cached_at": "2025-10-30T11:50:00Z",
      "local_path": "files/photo.jpg",
      "url": "http://localhost:8888/images/photo.jpg"
    }
  }
}
```

---

## 🌐 URL Scheme Design

### URL Format
```
http://localhost:{HTTP_SERVER_PORT}/remote/{client_email}/{file_path}

Examples:
  http://localhost:8888/remote/user@example.com/README.md
  http://localhost:8888/remote/user@example.com/docs/guide.md
  http://localhost:8888/remote/user@example.com/images/photo.jpg
  http://localhost:8888/remote/user@example.com/videos/demo.mp4
```

### Alternative Compact Format
```
http://localhost:8888/r/{client_hash}/{file_hash}

Where:
  client_hash = first 8 chars of SHA256(client_email)
  file_hash = first 8 chars of SHA256(file_path)

Examples:
  http://localhost:8888/r/abc12345/def67890
  http://localhost:8888/r/xyz98765/uvw43210
```

### Query Parameter Support
```
http://localhost:8888/remote/{client_email}/{file_path}?action=download
http://localhost:8888/remote/{client_email}/{file_path}?format=preview
http://localhost:8888/remote/{client_email}/{file_path}?cache=skip
```

---

## 📊 HTTP Cache Strategy

### Request Headers (To Remote Client)
```http
GET /api/files/README.md HTTP/1.1
Host: remote.client.local:9999
If-None-Match: "abc123def456"
If-Modified-Since: Wed, 29 Oct 2025 10:30:00 GMT
Accept-Encoding: gzip, deflate
```

### Response Headers (From Remote Client)
```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Content-Length: 2048
ETag: "abc123def456"
Last-Modified: Wed, 29 Oct 2025 10:30:00 GMT
Cache-Control: public, max-age=3600
Content-Hash: SHA256:xyz789...
```

### Cache Validation Logic
```typescript
interface CacheEntry {
  etag: string;
  last_modified: string;
  file_path: string;
  cached_at: Date;
  expires_at: Date;
}

function shouldRevalidate(entry: CacheEntry): boolean {
  // Revalidate if:
  // 1. Cache expired (max-age exceeded)
  // 2. Explicit refresh requested
  // 3. File size mismatch detected
  return entry.expires_at < new Date();
}

async function fetchWithCache(
  client: RemoteClient,
  file_path: string,
  cache_entry?: CacheEntry
): Promise<CachedFile> {
  // Add If-None-Match and If-Modified-Since if we have cached entry
  const headers = {};
  if (cache_entry?.etag) {
    headers['If-None-Match'] = cache_entry.etag;
  }
  if (cache_entry?.last_modified) {
    headers['If-Modified-Since'] = cache_entry.last_modified;
  }

  const response = await fetch(remoteUrl, { headers });

  if (response.status === 304) {
    // Not Modified - use cached file
    return { cached: true, file: cache_entry };
  }

  if (response.status === 200) {
    // New/updated file - cache it
    const file = await cacheFile(
      client,
      file_path,
      response,
      response.headers.get('etag'),
      response.headers.get('last-modified')
    );
    return { cached: false, file };
  }

  throw new Error(`Unexpected response: ${response.status}`);
}
```

---

## 🔧 Implementation Tasks

### Task A: Cache Manager (Rust - `main.rs`)

**Location:** `client/src-tauri/src/cache.rs` (new module)

```rust
pub mod cache {
    use std::path::PathBuf;
    use serde::{Deserialize, Serialize};
    use chrono::{DateTime, Utc};
    use sha2::{Sha256, Digest};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CacheEntry {
        pub etag: Option<String>,
        pub last_modified: Option<String>,
        pub file_path: String,
        pub size: u64,
        pub cached_at: DateTime<Utc>,
        pub expires_at: DateTime<Utc>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CacheMetadata {
        pub cache_version: u32,
        pub client_email: String,
        pub last_sync: DateTime<Utc>,
        pub files: std::collections::HashMap<String, CacheEntry>,
    }

    pub struct CacheManager {
        cache_dir: PathBuf,
        client_email: String,
    }

    impl CacheManager {
        pub fn new(client_email: String) -> Self {
            let cache_dir = Self::get_cache_dir(&client_email);
            CacheManager {
                cache_dir,
                client_email,
            }
        }

        fn get_cache_dir(client_email: &str) -> PathBuf {
            let mut path = dirs::cache_dir().unwrap_or_else(|| PathBuf::from("."));
            path.push("flashback");
            path.push("remote_clients");
            path.push(client_email);
            path
        }

        pub fn get_file_path(&self, file_path: &str) -> PathBuf {
            let mut path = self.cache_dir.clone();
            path.push("files");
            path.push(file_path);
            path
        }

        pub fn should_revalidate(&self, entry: &CacheEntry) -> bool {
            entry.expires_at < Utc::now()
        }

        pub async fn get_cached_file(&self, file_path: &str) -> Option<CacheEntry> {
            let metadata_path = self.cache_dir.join("metadata.json");
            if !metadata_path.exists() {
                return None;
            }

            let metadata_str = tokio::fs::read_to_string(&metadata_path).await.ok()?;
            let metadata: CacheMetadata = serde_json::from_str(&metadata_str).ok()?;
            let mut entry = metadata.files.get(file_path)?.clone();

            if self.should_revalidate(&entry) {
                return None;
            }

            Some(entry)
        }

        pub async fn cache_file(
            &self,
            file_path: &str,
            content: &[u8],
            etag: Option<String>,
            last_modified: Option<String>,
            cache_duration: u64,
        ) -> Result<CacheEntry, Box<dyn std::error::Error>> {
            // Create directories
            let file_full_path = self.get_file_path(file_path);
            tokio::fs::create_dir_all(file_full_path.parent().unwrap()).await?;

            // Write file
            tokio::fs::write(&file_full_path, content).await?;

            // Create cache entry
            let entry = CacheEntry {
                etag,
                last_modified,
                file_path: file_path.to_string(),
                size: content.len() as u64,
                cached_at: Utc::now(),
                expires_at: Utc::now() + chrono::Duration::seconds(cache_duration as i64),
            };

            // Update metadata
            self.update_metadata(file_path, entry.clone()).await?;

            Ok(entry)
        }

        async fn update_metadata(
            &self,
            file_path: &str,
            entry: CacheEntry,
        ) -> Result<(), Box<dyn std::error::Error>> {
            let metadata_path = self.cache_dir.join("metadata.json");
            tokio::fs::create_dir_all(&self.cache_dir).await?;

            let mut metadata: CacheMetadata = if metadata_path.exists() {
                let content = tokio::fs::read_to_string(&metadata_path).await?;
                serde_json::from_str(&content)?
            } else {
                CacheMetadata {
                    cache_version: 1,
                    client_email: self.client_email.clone(),
                    last_sync: Utc::now(),
                    files: std::collections::HashMap::new(),
                }
            };

            metadata.files.insert(file_path.to_string(), entry);
            metadata.last_sync = Utc::now();

            let json = serde_json::to_string_pretty(&metadata)?;
            tokio::fs::write(&metadata_path, json).await?;

            Ok(())
        }

        pub async fn clear_expired_entries(&self) -> Result<(), Box<dyn std::error::Error>> {
            let metadata_path = self.cache_dir.join("metadata.json");
            if !metadata_path.exists() {
                return Ok(());
            }

            let content = tokio::fs::read_to_string(&metadata_path).await?;
            let mut metadata: CacheMetadata = serde_json::from_str(&content)?;

            // Remove expired entries
            metadata.files.retain(|_, entry| !self.should_revalidate(entry));

            let json = serde_json::to_string_pretty(&metadata)?;
            tokio::fs::write(&metadata_path, json).await?;

            Ok(())
        }
    }
}
```

### Task B: HTTP Server (Rust - `http_server.rs`)

**Location:** `client/src-tauri/src/http_server.rs` (new module)

```rust
pub mod http_server {
    use axum::{
        extract::{Path, Query},
        http::{HeaderMap, StatusCode},
        response::IntoResponse,
        routing::get,
        Router,
    };
    use std::sync::Arc;
    use std::net::SocketAddr;
    use tokio::sync::RwLock;

    #[derive(Debug, Clone)]
    pub struct HttpServerConfig {
        pub port: u16,
        pub cache_enabled: bool,
        pub max_file_size: u64, // In bytes
    }

    pub struct FileServer {
        config: HttpServerConfig,
        cache_manager: Arc<RwLock<crate::cache::CacheManager>>,
    }

    impl FileServer {
        pub fn new(config: HttpServerConfig, cache_manager: crate::cache::CacheManager) -> Self {
            FileServer {
                config,
                cache_manager: Arc::new(RwLock::new(cache_manager)),
            }
        }

        pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
            let app = Router::new()
                // Route: /remote/{client_email}/{file_path}
                .route("/remote/:client_email/*file_path", get(self.serve_file_handler))
                // Route: /r/{client_hash}/{file_hash} (compact format)
                .route("/r/:client_hash/:file_hash", get(self.serve_file_by_hash_handler))
                // Route: /cache/status - Check cache status
                .route("/cache/status", get(self.cache_status_handler))
                // Route: /cache/clear - Clear cache
                .route("/cache/clear", get(self.cache_clear_handler))
                // Health check
                .route("/health", get(self.health_handler));

            let addr = format!("127.0.0.1:{}", self.config.port).parse::<SocketAddr>()?;
            let listener = tokio::net::TcpListener::bind(addr).await?;

            println!("File server running on http://127.0.0.1:{}", self.config.port);
            axum::serve(listener, app).await?;

            Ok(())
        }

        async fn serve_file_handler(
            Path((client_email, file_path)): Path<(String, String)>,
            headers: HeaderMap,
        ) -> impl IntoResponse {
            // Implementation
        }

        async fn serve_file_by_hash_handler(
            Path((client_hash, file_hash)): Path<(String, String)>,
        ) -> impl IntoResponse {
            // Implementation
        }

        async fn cache_status_handler(&self) -> impl IntoResponse {
            // Implementation
        }

        async fn cache_clear_handler(&self) -> impl IntoResponse {
            // Implementation
        }

        async fn health_handler() -> impl IntoResponse {
            "OK"
        }
    }
}
```

### Task C: Cache & HTTP Integration (TypeScript)

**File:** `client/src/util/remoteCacheManager.ts` (new)

```typescript
/**
 * Remote Cache Manager
 *
 * Manages caching of remote files with smart HTTP cache validation
 */

export interface CacheOptions {
  maxAge?: number; // Max age in seconds (default: 3600)
  forceRefresh?: boolean; // Ignore cache and fetch fresh
}

export interface CachedFileInfo {
  url: string;
  cached: boolean;
  size: number;
  cachedAt: Date;
  expiresAt: Date;
}

export class RemoteCacheManager {
  private serverPort: number;
  private clientEmail: string;

  constructor(serverPort: number = 8888, clientEmail: string = '') {
    this.serverPort = serverPort;
    this.clientEmail = clientEmail;
  }

  /**
   * Get URL for a remote file
   */
  getFileUrl(filePath: string): string {
    return `http://localhost:${this.serverPort}/remote/${encodeURIComponent(
      this.clientEmail
    )}/${encodeURIComponent(filePath)}`;
  }

  /**
   * Get compact URL for a remote file
   */
  getFileUrlCompact(clientHash: string, fileHash: string): string {
    return `http://localhost:${this.serverPort}/r/${clientHash}/${fileHash}`;
  }

  /**
   * Cache a file from remote client
   */
  async cacheRemoteFile(
    filePath: string,
    options: CacheOptions = {}
  ): Promise<CachedFileInfo> {
    const url = this.getFileUrl(filePath);

    try {
      const response = await fetch(url, {
        headers: {
          'Cache-Control': options.forceRefresh
            ? 'no-cache'
            : `max-age=${options.maxAge || 3600}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to cache file: ${response.statusText}`);
      }

      return {
        url,
        cached: response.headers.get('X-Cache') === 'HIT',
        size: parseInt(response.headers.get('content-length') || '0'),
        cachedAt: new Date(response.headers.get('Date') || new Date()),
        expiresAt: new Date(
          Date.now() + (options.maxAge || 3600) * 1000
        ),
      };
    } catch (error) {
      console.error('Error caching remote file:', error);
      throw error;
    }
  }

  /**
   * Check cache status
   */
  async getCacheStatus(): Promise<any> {
    try {
      const response = await fetch(
        `http://localhost:${this.serverPort}/cache/status`
      );
      return await response.json();
    } catch (error) {
      console.error('Error getting cache status:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.serverPort}/cache/clear`,
        { method: 'POST' }
      );
      return response.ok;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }
}

/**
 * Hook for React components to use cache manager
 */
export function useRemoteCache(clientEmail: string, serverPort: number = 8888) {
  const manager = new RemoteCacheManager(serverPort, clientEmail);

  return {
    getFileUrl: (filePath: string) => manager.getFileUrl(filePath),
    cacheFile: (filePath: string, options?: CacheOptions) =>
      manager.cacheRemoteFile(filePath, options),
    getCacheStatus: () => manager.getCacheStatus(),
    clearCache: () => manager.clearCache(),
  };
}
```

### Task D: Update RemoteHouse Component

**File:** `client/src/components/RemoteHouse/RemoteHouse.tsx` (update)

Use the cache manager to serve files via HTTP URLs:

```typescript
import { useRemoteCache } from '@/util/remoteCacheManager';

export default function RemoteHouse({
  clientIp,
  clientPort,
  clientEmail,
  onClose,
}: RemoteHouseProps) {
  const cache = useRemoteCache(clientEmail || '');

  // Use cache.getFileUrl() for image/video src attributes
  // Use cache.cacheFile() to trigger caching

  return (
    <div>
      {filePreviewType === 'image' && selectedFile && (
        <img 
          src={cache.getFileUrl(selectedFile.name)}
          alt={selectedFile.name}
        />
      )}
      {filePreviewType === 'video' && selectedFile && (
        <video
          src={cache.getFileUrl(selectedFile.name)}
          controls
        />
      )}
    </div>
  );
}
```

---

## 📈 HTTP Cache Headers Reference

### Request Headers to Include
```
If-None-Match: "etag-value"              (For 304 Not Modified)
If-Modified-Since: <date>                (For 304 Not Modified)
Cache-Control: max-age=3600              (Request fresh within 1 hour)
Accept-Encoding: gzip, deflate           (Compression support)
```

### Response Headers to Set
```
ETag: "<unique-hash>"                    (For cache validation)
Last-Modified: <date>                    (For cache validation)
Cache-Control: public, max-age=3600      (1 hour cache)
Content-Type: <mime-type>                (For browser rendering)
Content-Length: <bytes>                  (File size)
X-Cache: HIT|MISS                        (Cache status)
X-Cache-Key: <key>                       (Cache identifier)
```

---

## 🔒 Security Considerations

### Path Traversal Protection
```rust
fn validate_file_path(path: &str) -> bool {
    // Reject paths with:
    // - ".." (parent directory access)
    // - "/" at start (absolute paths)
    // - Symbolic links
    !path.contains("..") && 
    !path.starts_with("/") &&
    !path.starts_with("\\")
}
```

### File Type Validation
```typescript
const ALLOWED_TYPES = [
  'text/markdown',
  'text/plain',
  'text/css',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
];

function validateContentType(contentType: string): boolean {
  return ALLOWED_TYPES.includes(contentType);
}
```

### CORS & Origin Validation
```rust
// Only allow requests from localhost
fn validate_origin(host: &str) -> bool {
    host.starts_with("localhost:") ||
    host.starts_with("127.0.0.1:") ||
    host.starts_with("[::1]:")
}
```

---

## 📝 Database Schema (Optional SQLite)

```sql
-- Cache metadata
CREATE TABLE cache_entries (
  id INTEGER PRIMARY KEY,
  client_email TEXT NOT NULL,
  file_path TEXT NOT NULL,
  etag TEXT,
  last_modified TEXT,
  file_size INTEGER,
  content_type TEXT,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  local_path TEXT NOT NULL,
  UNIQUE(client_email, file_path)
);

-- Cache statistics
CREATE TABLE cache_stats (
  id INTEGER PRIMARY KEY,
  client_email TEXT NOT NULL,
  total_cached_size INTEGER,
  entry_count INTEGER,
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 Testing Strategy

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_entry_expiration() {
        // Test that expired entries are invalidated
    }

    #[tokio::test]
    async fn test_etag_validation() {
        // Test ETag-based cache validation
    }

    #[test]
    fn test_path_traversal_protection() {
        // Test that ".." paths are rejected
    }
}
```

### Integration Tests
```typescript
describe('Remote Cache Manager', () => {
  it('should cache files from remote client', async () => {
    // Test file caching
  });

  it('should use cached file if not expired', async () => {
    // Test cache hit
  });

  it('should revalidate expired entries', async () => {
    // Test cache revalidation
  });

  it('should generate correct URLs', () => {
    // Test URL generation
  });
});
```

---

## 📦 Dependencies Required

### Rust (Cargo.toml additions)
```toml
[dependencies]
axum = "0.7"              # HTTP framework
tokio = "1.0"             # Async runtime
chrono = "0.4"            # Date/time handling
sha2 = "0.10"             # SHA256 hashing
dirs = "5.0"              # Cross-platform cache directory
```

### TypeScript (Already available)
- `fetch` API (native browser)
- React hooks

---

## 🎯 Implementation Roadmap

### Phase 1: Cache Infrastructure
- [ ] Create `cache.rs` module with CacheManager
- [ ] Implement cache file storage
- [ ] Implement ETag/Last-Modified tracking
- [ ] Implement cache expiration logic
- [ ] Add metadata.json persistence

### Phase 2: HTTP Server
- [ ] Create `http_server.rs` module with FileServer
- [ ] Implement Axum router
- [ ] Implement file serving endpoints
- [ ] Add cache headers
- [ ] Add error handling

### Phase 3: Frontend Integration
- [ ] Create `remoteCacheManager.ts` utility
- [ ] Implement useRemoteCache hook
- [ ] Update RemoteHouse component
- [ ] Add URL support for images/videos
- [ ] Add link support for markdown

### Phase 4: Testing & Documentation
- [ ] Write unit tests for cache logic
- [ ] Write integration tests
- [ ] Add Cypress tests for URL serving
- [ ] Document cache strategy
- [ ] Document URL scheme

---

## 🚀 Usage Examples

### In React Component
```typescript
// Get cacheable URL for an image
const imageUrl = cache.getFileUrl('photos/screenshot.jpg');

// In JSX
<img src={imageUrl} alt="Screenshot" />

// For videos
<video src={cache.getFileUrl('videos/demo.mp4')} controls />

// For markdown with linked images
const markdownContent = `
# Guide

![Diagram](http://localhost:8888/remote/user@example.com/diagrams/arch.png)

[Link to another doc](http://localhost:8888/remote/user@example.com/docs/related.md)
`;
```

### Cache Clearing
```typescript
// Clear all cache for a client
await cache.clearCache();

// Or force refresh on next access
await cache.cacheFile('file.md', { forceRefresh: true });
```

---

## 📊 Performance Considerations

### Bandwidth Optimization
- Use ETag for efficient revalidation (304 responses)
- Gzip compression for text files
- Lazy load images/videos
- Cache files locally to avoid re-downloads

### Memory Management
- Stream large files instead of loading into memory
- Implement cache size limits
- Auto-expire old entries
- Clean up on app startup

### Concurrency
- Handle parallel file requests
- Use Arc<RwLock> for thread-safe cache access
- Implement request deduplication (same file requested multiple times)

---

## ✅ Success Criteria

- [ ] Files cached locally with proper metadata
- [ ] HTTP server runs on localhost without conflict
- [ ] URLs work correctly in browser for images/videos
- [ ] ETag-based cache validation working
- [ ] 304 Not Modified responses reduce bandwidth
- [ ] Markdown links work to other remote files
- [ ] CLI client can access HTTP server
- [ ] Cache automatically expires after max-age
- [ ] Security: No path traversal possible
- [ ] Performance: <100ms response for cached files

---

**Next Steps:** Start implementation with Phase 1 (Cache Infrastructure)

