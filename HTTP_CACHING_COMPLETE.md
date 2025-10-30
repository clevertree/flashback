# 🌐 HTTP Caching & File Serving Architecture - Complete Plan

**Date:** October 30, 2025  
**Feature Status:** Design & TypeScript Implementation Complete  
**Total Implementation:** 6-8 hours (Rust HTTP server required)

---

## 📋 Executive Summary

This document describes a comprehensive HTTP caching and file serving system for the Flashback client that enables:

1. **Smart File Caching** - Cache remote files with ETag/Last-Modified validation
2. **HTTP-Based File Serving** - Serve files on `http://localhost:PORT/` for browser use
3. **URL-Based File References** - Enable HTML tags to reference remote files directly
4. **Cross-File Linking** - Markdown files can link to other remote files
5. **Bandwidth Optimization** - Reduce bandwidth with 304 Not Modified responses
6. **CLI & UI Support** - Works in both CLI and browser-based clients

---

## 🎯 Problem Statement

**Current Issue:** RemoteHouse component can only preview files as text. Cannot:
- Display images in `<img>` tags (need URLs)
- Play videos in `<video>` tags (need URLs)
- Link between remote files (no URL scheme)
- Cache files efficiently (re-download every time)

**Solution:** Implement local HTTP server + smart caching system

---

## 🏗️ Architecture

### URL Scheme
```
Full Format:
  http://localhost:8888/remote/{client_email}/{file_path}

Examples:
  http://localhost:8888/remote/user@example.com/README.md
  http://localhost:8888/remote/user@example.com/images/photo.jpg
  http://localhost:8888/remote/user@example.com/videos/demo.mp4

Compact Format (for shorter URLs):
  http://localhost:8888/r/{client_hash}/{file_hash}

Examples:
  http://localhost:8888/r/abc12345/def67890
```

### Component Stack
```
Browser (Next.js)
    ↓ HTTP GET /remote/{email}/{path}
Local HTTP Server (Rust - Axum)
    ↓ HTTPS with ETag validation
Remote Client Files
```

### Cache Storage
```
~/.cache/flashback/remote_clients/{email}/
├── metadata.json                    # ETag/Last-Modified tracking
├── files/
│   ├── README.md                   # Cached files
│   ├── photo.jpg
│   └── video.mp4
```

---

## 📦 Deliverables

### ✅ COMPLETED - TypeScript (remoteCacheManager.ts)

**File:** `client/src/util/remoteCacheManager.ts` (360 lines)

**Features:**
- `RemoteCacheManager` class with caching logic
- `getFileUrl()` - Generate URLs for remote files
- `cacheRemoteFile()` - Cache with ETag validation
- `useRemoteCache()` - React hook for components
- Metadata tracking with cache expiration
- Support for both full and compact URLs

**Status:** ✅ Ready to use

### ⏳ TODO - Rust Cache Module (cache.rs)

**File:** `client/src-tauri/src/cache.rs` (to create)

**Components:**
- `CacheManager` - Local file caching
- `CacheEntry` - Cache metadata
- File persistence with JSON
- ETag/Last-Modified tracking
- Cache expiration logic
- Directory management

**Estimated Time:** 2-3 hours

### ⏳ TODO - Rust HTTP Server (http_server.rs)

**File:** `client/src-tauri/src/http_server.rs` (to create)

**Components:**
- `FileServer` struct with Axum setup
- `/remote/{email}/{path}` endpoint (main)
- `/r/{hash}/{hash}` endpoint (compact)
- `/api/cache/status` endpoint
- `/api/cache/clear` endpoint
- `/health` endpoint
- Error handling & security validation

**Estimated Time:** 2-3 hours

### ⏳ TODO - main.rs Integration

**Updates Required:**
- Initialize CacheManager
- Start HttpServer in background
- Expose server port to frontend
- Add Tauri commands for cache operations

**Estimated Time:** 1-2 hours

---

## 🔄 Cache Strategy

### HTTP Headers Used

**Request:**
```http
If-None-Match: "{etag}"           # For 304 validation
If-Modified-Since: <date>         # For 304 validation  
Cache-Control: max-age=3600       # Cache directive
```

**Response:**
```http
ETag: "{unique-hash}"             # For validation
Last-Modified: <date>             # For validation
Cache-Control: public, max-age=3600    # Cache duration
X-Cache: HIT|MISS                 # Cache status
Content-Type: <type>              # File type
```

### Cache Validation Flow

**First Request:**
1. Client requests file via HTTP URL
2. Local server fetches from remote (HTTPS)
3. Server receives file + ETag + Last-Modified
4. Server caches file locally
5. Server stores metadata.json
6. Return 200 OK to browser

**Subsequent Requests (Fresh):**
1. Client requests same file
2. Cache entry still fresh (within max-age)
3. Return 304 Not Modified (just headers)
4. Browser uses cached version
5. Zero bytes transferred

**After Expiration:**
1. Client requests file
2. Cache entry expired
3. Send If-None-Match to remote
4. Remote returns 304 (content unchanged)
5. Or 200 (content changed, re-cache)
6. Update metadata and return to browser

---

## 🔒 Security Features

### 1. Path Traversal Protection
```typescript
// Blocked paths:
../../../etc/passwd        ✗
../../secret.key           ✗
/etc/passwd                ✗

// Allowed paths:
README.md                  ✓
docs/guide.md              ✓
images/photo.jpg           ✓
```

### 2. File Type Whitelist
```
✓ Allowed: .md, .txt, .css, .jpg, .png, .gif, .webp, .mp4, .webm, .mp3, .wav
✗ Blocked: .html, .js, .exe, .sh, .bat, .dll, .so
```

### 3. Localhost-Only
```
✓ Allowed: localhost:8888, 127.0.0.1:8888, [::1]:8888
✗ Blocked: external.com:8888
```

### 4. Content-Type Validation
```
Check response Content-Type header
Reject if not in whitelist
Prevent script injection
```

---

## 📊 Performance Impact

### Bandwidth Savings
```
First request:     100 KB (full file download)
Subsequent:        ~500 B (headers only, 304 response)
Savings:           ~99.5% per cached request
```

### Response Time
```
Cold cache:        ~500ms (network to remote)
Hot cache:         ~50ms (local file + headers)
Improvement:       ~90% faster for cached files
```

### Resource Usage
```
CPU:               Minimal (file I/O only)
Memory:            Configurable cache limit (1 GB)
Disk:              Configurable cache dir
Network:           Reduced by 99% on cache hits
```

---

## 🎯 Use Cases Enabled

### Use Case 1: Image Gallery
```typescript
const imageUrl = cache.getFileUrl('photos/vacation.jpg');
<img src={imageUrl} alt="Vacation" />
```

### Use Case 2: Video Playback
```typescript
const videoUrl = cache.getFileUrl('videos/tutorial.mp4');
<video src={videoUrl} controls />
```

### Use Case 3: Markdown with Resources
```markdown
# Documentation

![Architecture](http://localhost:8888/remote/user@example.com/diagrams/arch.png)

[See API Docs](http://localhost:8888/remote/user@example.com/api.md)

[Watch Demo](http://localhost:8888/remote/user@example.com/demo.mp4)
```

### Use Case 4: CLI File Access
```bash
# CLI can access same HTTP server
curl http://localhost:8888/remote/user@example.com/file.txt
wget http://localhost:8888/remote/user@example.com/data.csv
```

---

## 📝 Implementation Timeline

### Week 1
- **Day 1:** Review design documents (2 hours)
- **Day 2:** Implement cache.rs module (3 hours)
- **Day 3:** Implement http_server.rs module (3 hours)
- **Day 4:** Integrate into main.rs (2 hours)
- **Day 5:** Unit testing (2 hours)

### Week 2
- **Day 1:** Integration testing (2 hours)
- **Day 2:** Cypress E2E tests (2 hours)
- **Day 3:** Performance testing (2 hours)
- **Day 4:** Security audit (2 hours)
- **Day 5:** Documentation & refinement (2 hours)

**Total: 24 hours (6-8 working days)**

---

## 🧪 Testing Strategy

### Unit Tests (Rust)
```rust
#[test]
fn test_cache_expiration() { }

#[test]
fn test_etag_validation() { }

#[test]
fn test_path_traversal_blocked() { }

#[test]
fn test_file_type_whitelist() { }
```

### Integration Tests (TypeScript)
```typescript
describe('RemoteCache', () => {
  it('should cache files with ETag', () => { });
  it('should return 304 for cached files', () => { });
  it('should refresh expired cache', () => { });
  it('should generate correct URLs', () => { });
});
```

### E2E Tests (Cypress)
```typescript
describe('HTTP File Serving', () => {
  it('should display images via HTTP', () => { });
  it('should play videos via HTTP', () => { });
  it('should link between remote files', () => { });
  it('should cache files efficiently', () => { });
});
```

---

## ✅ Success Criteria

- [x] TypeScript cache manager created
- [ ] Rust cache module implemented
- [ ] Rust HTTP server implemented
- [ ] Integration complete in main.rs
- [ ] Images display via HTTP URLs
- [ ] Videos play via HTTP URLs
- [ ] Markdown files link to each other
- [ ] ETag-based caching working
- [ ] 304 responses reduce bandwidth
- [ ] All security checks pass
- [ ] Performance <100ms for cached files
- [ ] CLI can access HTTP files
- [ ] 80%+ code coverage in tests

---

## 📚 Documentation Files

### Design Documents (Already Created)
1. **HTTP_CACHING_DESIGN.md** - Architecture & design patterns
2. **HTTP_CACHING_IMPLEMENTATION.md** - Implementation guide
3. **This File** - Complete overview

### Code Templates (Provided)
1. **cache.rs** - Rust cache manager template
2. **http_server.rs** - Rust HTTP server template
3. **remoteCacheManager.ts** - TypeScript cache manager (✅ DONE)

### Testing Files (To Create)
1. **cache.test.rs** - Cache module tests
2. **http_server.test.rs** - HTTP server tests
3. **remoteCacheManager.test.ts** - TypeScript tests
4. **cypress/test/http_serving.cy.ts** - E2E tests

---

## 🚀 Getting Started

### Step 1: Review Design
- [ ] Read HTTP_CACHING_DESIGN.md
- [ ] Read HTTP_CACHING_IMPLEMENTATION.md
- [ ] Understand URL scheme
- [ ] Understand cache flow

### Step 2: Implement Phase 1 (Rust Cache)
- [ ] Create cache.rs file
- [ ] Implement CacheManager
- [ ] Add tests
- [ ] Verify compilation

### Step 3: Implement Phase 2 (Rust HTTP Server)
- [ ] Create http_server.rs file
- [ ] Implement FileServer with Axum
- [ ] Add error handling
- [ ] Add tests

### Step 4: Integrate
- [ ] Update main.rs
- [ ] Start HTTP server
- [ ] Expose to frontend
- [ ] Test manually

### Step 5: Test & Refine
- [ ] Write integration tests
- [ ] Write Cypress tests
- [ ] Performance testing
- [ ] Security audit
- [ ] Documentation

---

## 📊 Resource Allocation

### TypeScript (Frontend)
- ✅ remoteCacheManager.ts - COMPLETE (360 lines)
- useRemoteCache Hook - COMPLETE
- Integration - PENDING (RemoteHouse update)

### Rust (Backend)
- cache.rs - TODO (200-300 lines)
- http_server.rs - TODO (300-400 lines)
- main.rs integration - TODO (50-100 lines)

### Testing
- Unit tests - TODO (150-200 lines)
- Integration tests - TODO (200-250 lines)
- E2E tests - TODO (100-150 lines)

### Documentation
- ✅ HTTP_CACHING_DESIGN.md - COMPLETE
- ✅ HTTP_CACHING_IMPLEMENTATION.md - COMPLETE
- API documentation - TODO

---

## 🎯 Next Steps

### Immediate (Today)
1. ✅ Commit HTTP_CACHING_DESIGN.md
2. ✅ Commit HTTP_CACHING_IMPLEMENTATION.md
3. ✅ Commit remoteCacheManager.ts
4. Create milestone/project in git
5. Plan sprint for implementation

### This Week
1. Implement cache.rs module
2. Implement http_server.rs module
3. Integrate into main.rs
4. Write unit tests

### Next Week
1. Write integration tests
2. Write Cypress E2E tests
3. Performance testing
4. Security audit
5. Documentation review

---

## 📞 Support & References

### Documentation
- HTTP RFC 7234 (Caching): https://tools.ietf.org/html/rfc7234
- Axum Framework: https://github.com/tokio-rs/axum
- ETag Header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag

### Code Examples
- Example Axum app: https://github.com/tokio-rs/axum/tree/main/examples
- Tauri background tasks: https://tauri.app/en/v1/guides/getting-started/setup/prerequisites/

### Related Features
- RemoteHouse component
- secureConnection utilities
- Tauri command bridge

---

## ✨ Summary

This feature completes the file sharing vision for Flashback by adding:

1. **Smart Caching** - Efficient local storage of remote files
2. **HTTP Serving** - Browser-compatible URLs for all file types
3. **Cross-File Linking** - Markdown documents can reference each other
4. **Bandwidth Optimization** - 99% reduction in redundant downloads
5. **CLI Support** - Works with both UI and CLI clients

**Total Implementation:** 6-8 hours for full system  
**Current Status:** TypeScript complete, Rust modules ready for implementation  
**Next Action:** Start with cache.rs module in main.rs

---

**Document Status:** Complete Design Ready for Implementation  
**Last Updated:** October 30, 2025  
**Author:** GitHub Copilot  
**Approval Status:** Ready for team review

