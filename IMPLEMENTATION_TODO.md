# Implementation TODO & Decisions

## Overview

This document outlines the remaining work to complete the repository script execution system and documents key architectural decisions.

## Completed Items

✅ Example repository scripts structure created (`/example-repo/scripts/`)
- search.js - search through repository data
- browse.js - hierarchical browsing
- insert.js - insert validated records
- remove.js - remove records
- comment.js - add comments to records

✅ CLI clone command infrastructure added
- `lib clone <repo_name> <git_url>` command enum in CLI parser
- Tauri `api_clone_repository` command implemented
- API bridge exposed in `flashbackCryptoBridge.ts`
- UI integration in `BroadcastSection.tsx`

✅ Repository list fetching
- `api_get_repositories` Tauri command to fetch from `/api/repository/list`
- UI populated with available repositories from relay tracker

## Remaining Work

### 1. RemoteHouse API Endpoints (Priority: HIGH)

These endpoints should be added to the relay tracker server (`/server/app/api/remotehouse/`):

#### 1.1 Repository Search Endpoint
**Path:** `/api/remotehouse/<repo_name>/search`
**Method:** POST/GET
**Purpose:** Execute `./scripts/search.js` in the cloned repository

```typescript
// Request
{
  query: string,
  field?: string
}

// Response
{
  results: Array<{id, title, description, ...}>,
  count: number,
  query: string,
  field: string
}
```

**Implementation Notes:**
- Load and execute `./scripts/search.js` using Node.js `require()` or `eval()`
- Pass `{ query, field, dataDir: '<cloned-repo>/data' }` to search function
- Return JSON response
- Security: Only execute trusted scripts in trusted repo directories

#### 1.2 Repository Browse Endpoint
**Path:** `/api/remotehouse/<repo_name>/browse`
**Method:** POST/GET
**Purpose:** Execute `./scripts/browse.js` to provide hierarchical view

```typescript
// Request
{
  path?: string,      // Subdirectory to browse
  depth?: number      // Traversal depth (default 3)
}

// Response
{
  tree: {
    files: Array<{name, title, id, size, modified}>,
    directories: {
      [dirName]: { ... }
    }
  },
  count: number,
  path: string
}
```

#### 1.3 Repository Insert Endpoint
**Path:** `/api/remotehouse/<repo_name>/insert`
**Method:** POST
**Purpose:** Execute `./scripts/insert.js` to add validated records

```typescript
// Request
{
  payload: {
    primary_index: string,
    [field]: any
  },
  rules?: { required_fields, max_payload_size, allowed_characters }
}

// Response
{
  success: boolean,
  id?: string,
  path?: string,
  size?: number,
  error?: string
}
```

#### 1.4 Repository Remove Endpoint
**Path:** `/api/remotehouse/<repo_name>/remove`
**Method:** POST/DELETE
**Purpose:** Execute `./scripts/remove.js` to delete records

```typescript
// Request
{
  primary_index: string,
  id?: string  // If omitted, removes all in index
}

// Response
{
  success: boolean,
  removed: number,
  message: string,
  error?: string
}
```

#### 1.5 Repository Comment Endpoint
**Path:** `/api/remotehouse/<repo_name>/comment`
**Method:** POST
**Purpose:** Execute `./scripts/comment.js` to add comments

```typescript
// Request
{
  primary_index: string,
  id: string,
  email: string,      // From user certificate
  comment: string
}

// Response
{
  success: boolean,
  comment_id?: string,
  path?: string,
  created_at?: string,
  error?: string
}
```

### 2. API Ready Validation (Priority: HIGH)

**File:** `/Users/ari.asulin/dev/test/rust/client/src-tauri/src/main.rs`
**Function:** `api_ready()`

Current behavior broadcasts presence immediately. Need to add:

```rust
// Before calling http_post_json, verify repos exist:
if let Some(repo_names) = &repo_names_param {
    for repo_name in repo_names {
        let repo_path = repos_dir.join(repo_name);
        if !repo_path.exists() {
            return Err(format!("Repository '{}' not found locally", repo_name));
        }
    }
}
```

Currently `api_ready` signature is:
```rust
async fn api_ready(
    localIP: Option<String>,
    remoteIP: Option<String>,
    broadcastPort: Option<u16>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String>
```

Need to add `repoNames` parameter.

### 3. Script Execution Strategy (Priority: MEDIUM)

**Decision:** Use plain JavaScript instead of TypeScript

**Rationale:**
- Node.js can execute `.js` files without compilation
- Avoid complexity of TS transpilation
- Simpler sandboxing/validation
- Easier to review security

**Execution Approach Options:**

**Option A (Current Approach): Direct Node.js Execution**
```rust
// In Rust/Tauri backend
let output = Command::new("node")
    .arg(format!("{}/scripts/search.js", repo_path))
    .arg("--input")
    .arg(serde_json::to_string(&input)?)
    .output()?;
```

Pros: Simple, isolated process, clear error handling
Cons: Slow (spawns new process), script must read from stdin/file

**Option B: Node.js VM Module (Advanced)**
```rust
// Use deno or node_eval crate
// Load script, set up sandbox, execute
```

Pros: Faster, more control
Cons: More complex, additional dependencies

**Recommendation:** Start with Option A (spawn Node.js process), migrate to B if performance issues arise.

### 4. Client-Side Script Invocation (Priority: MEDIUM)

For DCC (peer-to-peer) clients, add endpoints to call scripts on remote hosts:

**File:** Create `/client/src/lib/repositoryClient.ts`

```typescript
// Call search on a peer
async function searchRemoteRepository(
  peerSocket: string,
  repoName: string,
  query: string
): Promise<SearchResult> {
  // Use existing P2P DCC infrastructure to call remote endpoint
  // Protocol: send HTTP request to peer's configured socket
}
```

This bridges the gap between relay tracker (centralized) and peer repositories (distributed).

### 5. Security Validation (Priority: HIGH)

Create `/docs/REMOTEHOUSE_SECURITY.md` documenting:

- **Input Validation**: All inputs must be validated before script execution
- **Path Traversal Prevention**: No `..` or absolute paths in primary_index, repo_name
- **Script Sandboxing**: Scripts execute in isolated Node.js process
- **Timeout Protection**: Kill long-running scripts (default 30s)
- **Resource Limits**: Limit file size, directory depth, result set size
- **User Identity**: Email/certificate must be verified before creating comments
- **Audit Trail**: Log all modifications with timestamp + user email

### 6. Configuration & Environment (Priority: MEDIUM)

Add to `/Users/ari.asulin/dev/test/rust/server/.env`:

```bash
# Repository Script Execution
SCRIPT_EXECUTION_TIMEOUT=30000        # milliseconds
SCRIPT_MAX_MEMORY=256                 # MB
SEARCH_MAX_RESULTS=1000
BROWSE_MAX_DEPTH=5
INSERT_MAX_PAYLOAD_SIZE=1048576       # 1MB
REPOSITORIES_ROOT_DIR=./repos         # Where cloned repos stored
```

## Architecture Decisions

### Decision 1: JavaScript Over TypeScript

**Status:** DECIDED ✓
**Rationale:** Simpler execution, no compilation overhead
**Implications:** 
- Scripts must be plain JS (no imports, self-contained)
- Can use Node.js built-ins (fs, path, etc.)

### Decision 2: Per-Endpoint Script Execution vs Unified Handler

**Status:** PENDING
**Options:**
- A: Each endpoint spawns its own Node.js process (current approach)
- B: Single long-lived Node.js server process that handles all requests

**Recommendation:** Use Option A initially for security/isolation, consider B if performance issues arise.

### Decision 3: Relay Tracker vs Peer Repository Hosting

**Status:** DECIDED ✓
**Architecture:**
- Relay Tracker: Centralized repository metadata, cloned repos, RemoteHouse endpoints
- Peer Clients: Can also host repos locally, accessible via P2P DCC

**Implications:**
- Relay tracker acts as a hub for script execution
- Peers can host independent repositories (requires separate P2P protocol)
- Both can coexist (federation model)

### Decision 4: Comment Storage Strategy

**Status:** DECIDED ✓
**Design:**
- Comments stored as markdown files
- Path: `data/${primary_index}/comments/${sanitized_email}/${timestamp}_{random}.md`
- Allows multiple comments per user per record
- Easy to backup/sync
- Human-readable

## Performance Considerations

1. **Script Execution Time**: Node.js process spawn = ~50-100ms overhead
   - For high-load endpoints, consider caching/pooling
   - Monitor and set timeouts

2. **Repository Size**: Large repos may slow down browsing
   - Implement depth limits (default 3 levels)
   - Add pagination for results

3. **Search Performance**: Linear scan through JSON files
   - For large repos, consider indexing
   - Add search result limits (default 1000)

## Testing Strategy

1. **Unit Tests**: Test example scripts in isolation
   ```bash
   node scripts/search.js --test
   ```

2. **Integration Tests**: Test endpoints with example-repo
   ```
   POST /api/remotehouse/example-repo/search
   { "query": "test" }
   ```

3. **Security Tests**: Verify path traversal prevention, timeout handling, etc.

4. **E2E Tests**: Full flow including clone → insert → search → comment

## Next Steps

1. Implement RemoteHouse endpoints in relay tracker server
2. Add script execution logic with proper error handling
3. Update api_ready to verify repository existence
4. Create comprehensive security documentation
5. Add end-to-end tests
6. Consider performance optimization if needed

## References

- Example scripts: `/Users/ari.asulin/dev/test/rust/example-repo/scripts/`
- Relay tracker API: `/Users/ari.asulin/dev/test/rust/server/app/api/`
- Client components: `/Users/ari.asulin/dev/test/rust/client/src/components/`
