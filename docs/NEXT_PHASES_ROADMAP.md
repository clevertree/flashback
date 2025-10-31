# Flashback Development Roadmap: Next Phases

**Current Phase:** ✅ Phase 1.5 - Complete (Fabric SDK integration scaffold + infrastructure)  
**Next Phase:** Phase 2 - Remote Repository Script Execution  
**Status:** Ready to proceed  
**Updated:** October 31, 2025

---

## Phase Overview Timeline

```
Phase 1    (Complete)   → Tauri desktop client + UI + Git cloning
Phase 1.5  (Complete)   → Fabric SDK scaffolding + X.509 certificates + RemoteHouse API endpoints
Phase 2    (Next)       → Real RemoteHouse operations + Script execution + Repository management
Phase 3    (Later)      → Local Hyperledger Fabric integration
Phase 4    (Later)      → P2P distributed repositories + Full DCC protocol
```

---

## Phase 2: RemoteHouse API & Distributed Script Execution

**Duration:** 1-2 weeks  
**Priority:** HIGH  
**Status:** Architecture complete, ready for implementation

### Phase 2 Objectives
1. ✅ Create RemoteHouse API endpoints (5 endpoints)
2. ✅ Implement script execution infrastructure with timeouts/limits
3. ✅ Add comprehensive input validation
4. Create repository management commands
5. Implement broadcast flow for repository validation
6. Add end-to-end tests for all operations

### Phase 2 Components

#### 2.1 RemoteHouse API Endpoints (COMPLETED)

**5 Core Endpoints Created:**

```
POST   /api/remotehouse/[repo]/search      → Query entries by keyword/tag
POST   /api/remotehouse/[repo]/browse      → Hierarchical repository browsing
POST   /api/remotehouse/[repo]/insert      → Add new record to repository
POST   /api/remotehouse/[repo]/remove      → Delete record from repository
POST   /api/remotehouse/[repo]/comment     → Add comment to entry
```

**Files:**
- ✅ `/server/app/api/remotehouse/[repo]/search/route.ts` (170 lines)
- ✅ `/server/app/api/remotehouse/[repo]/browse/route.ts` (180 lines)
- ✅ `/server/app/api/remotehouse/[repo]/insert/route.ts` (170 lines)
- ✅ `/server/app/api/remotehouse/[repo]/remove/route.ts` (150 lines)
- ✅ `/server/app/api/remotehouse/[repo]/comment/route.ts` (160 lines)

#### 2.2 Script Execution Infrastructure (COMPLETED)

**File:** `/server/lib/scriptExecutor.ts` (280+ lines)

Features:
- ✅ Safe Node.js script isolation (spawns isolated process)
- ✅ 30-second timeout protection
- ✅ 256MB memory limit
- ✅ 10MB output size limit
- ✅ Error handling and logging

```typescript
async executeScript(scriptPath, args[], config):
  - Validates script exists and is readable
  - Spawns Node.js with resource limits
  - Captures stdout/stderr
  - Enforces timeout
  - Returns structured response
```

#### 2.3 Input Validation Framework (COMPLETED)

**File:** `/server/lib/validators.ts` (450+ lines)

**15+ Validation Functions:**
- `validateRepositoryName()` - Blocks `..`, `/`, special chars
- `validateSearchQuery()` - Blocks shell metacharacters
- `validatePrimaryIndex()` - Prevents path traversal
- `validateRecordId()`, `validateEmail()` - Field validation
- `validatePayload()`, `validateRequiredFields()` - Structure validation
- `validatePagination()`, `validateDepth()` - Parameter validation
- `validateTags()`, `validateRating()` - Domain validation

**Security Model:** Whitelist-based (only allow known-safe patterns)

#### 2.4 Configuration (TODO)

**File:** `/server/.env` (to be created)

```bash
# Repository Script Execution
SCRIPT_EXECUTION_TIMEOUT=30000        # milliseconds
SCRIPT_MAX_MEMORY=256                 # MB
SEARCH_MAX_RESULTS=1000
BROWSE_MAX_DEPTH=5
INSERT_MAX_PAYLOAD_SIZE=1048576       # 1MB
REPOSITORIES_ROOT_DIR=./repos

# Security
ALLOWED_REPO_NAMES_PATTERN=^[a-zA-Z0-9_-]+$
```

### Phase 2 Tasks

- [ ] **Task 2.1:** Integrate scriptExecutor.ts into RemoteHouse endpoints
- [ ] **Task 2.2:** Connect validators.ts to all API routes for input validation
- [ ] **Task 2.3:** Add repository discovery API endpoint
- [ ] **Task 2.4:** Implement Tauri commands for repository management
- [ ] **Task 2.5:** Create end-to-end tests for script execution
- [ ] **Task 2.6:** Add repository caching/indexing
- [ ] **Task 2.7:** Implement result pagination for large repositories

### Phase 2 Example Flow

```
User Action: Click "Browse Repository"
    ↓
UI calls: invoke('repository_browse', { repo_name: "movies", path: "/" })
    ↓
Tauri Command: repository_browse handler
    ├─ Validate repo name
    ├─ Check repo exists in /repos/<repo_name>
    └─ Call remote: POST /api/remotehouse/movies/browse
    ↓
RemoteHouse Endpoint Handler
    ├─ Validate input (path, depth)
    ├─ Call scriptExecutor.executeScript('./scripts/browse.js')
    ├─ Capture result
    └─ Return JSON
    ↓
Response: { tree: { files: [...], directories: {...} }, count: 42 }
    ↓
UI: Render repository tree
```

### Phase 2 Success Criteria
- ✅ All 5 RemoteHouse endpoints operational
- ✅ Script execution sandboxed with timeouts
- ✅ All inputs validated before execution
- ✅ Repository operations (search/browse/insert/remove/comment) working
- ✅ E2E tests passing (50+ test cases)
- ✅ Zero path traversal vulnerabilities

---

## Phase 3: Hyperledger Fabric Integration

**Duration:** 2-3 weeks  
**Priority:** HIGH  
**Status:** Scaffolding complete, ready for SDK integration

### Phase 3 Objectives
1. Stand up local Hyperledger Fabric network
2. Implement real X.509 certificate extraction
3. Connect FabricClient to real Fabric network
4. Implement chaincode operations (query/invoke)
5. Test all blockchain operations end-to-end
6. Add blockchain audit trails

### Phase 3 Components

#### 3.1 Local Fabric Setup

**Tasks:**
- [ ] Docker Compose setup for Fabric network
- [ ] Configure 2 organizations (Org1, Org2)
- [ ] Deploy repo-manager chaincode
- [ ] Configure TLS certificates
- [ ] Document network topology

**Expected:** Fabric network on `localhost:7051`, `localhost:7052`

#### 3.2 X.509 Certificate Implementation

**File:** `client/src-tauri/src/fabric/certificate.rs`

Replace placeholder functions with:
- Real PEM/DER parsing using `x509-parser` crate
- Email extraction from SubjectAltName
- Certificate validation and expiry checking
- Fingerprint generation for audit trail

```rust
// Current: Mock implementation
// TODO: Implement real parsing
fn extract_email_from_san(cert: &X509Certificate) -> Option<String> {
    // Find RFC822Name (email) in Subject Alternative Names
    // Fallback to Common Name if no SAN
}
```

#### 3.3 FabricClient Integration

**File:** `client/src-tauri/src/fabric/client.rs`

Implement real Fabric SDK calls for all 13 methods:

```rust
pub async fn connect(&self) -> FabricResult<()> {
    // TODO: Load certificate, connect to Fabric peers
    // Establish gRPC connections
}

pub async fn query_entries(&self, channel: &str, query: Option<&str>) -> FabricResult<Vec<FabricEntry>> {
    // TODO: Call chaincode: repo-manager.queryEntries()
    // Parse response as Vec<FabricEntry>
}

pub async fn add_entry(&self, channel: &str, title: &str) -> FabricResult<String> {
    // TODO: Call chaincode: repo-manager.addEntry()
    // Submit transaction to orderer
    // Return entry ID
}
```

#### 3.4 Chaincode Operations

**Chaincode:** `repo-manager.js` (JavaScript on Fabric)

Operations to implement:
```javascript
queryEntries(channel, query, tags, limit, offset)
getEntry(channel, entryId)
addEntry(channel, title, description, tags, creator)
updateEntry(channel, entryId, title, description)
deleteEntry(channel, entryId, reason)
queryComments(channel, entryId)
addComment(channel, entryId, content, email, rating)
updateComment(channel, entryId, commentId, content)
deleteComment(channel, entryId, commentId)
```

#### 3.5 Error Mapping

Map Fabric SDK errors to `FabricError` variants:
- Connection failures → `FabricError::ConnectionError`
- Chaincode errors → `FabricError::ChaincodeError`
- Endorsement failures → `FabricError::EndorsementFailed`
- Transaction rejection → `FabricError::TransactionFailed`

### Phase 3 Tasks

- [ ] **Task 3.1:** Set up local Fabric network (docker-compose)
- [ ] **Task 3.2:** Implement real X.509 certificate parsing
- [ ] **Task 3.3:** Connect FabricClient to Fabric peers
- [ ] **Task 3.4:** Deploy repo-manager chaincode
- [ ] **Task 3.5:** Implement all FabricClient methods with real SDK calls
- [ ] **Task 3.6:** Add retry logic and error handling
- [ ] **Task 3.7:** Implement transaction signing with certificates
- [ ] **Task 3.8:** Create comprehensive blockchain tests

### Phase 3 Success Criteria
- ✅ Local Fabric network running (2 orgs, 2 peers)
- ✅ X.509 certificates properly extracted and used
- ✅ All FabricClient methods calling real chaincode
- ✅ Transactions submitted to orderer and committed to ledger
- ✅ Chaincode operations queryable on all peers
- ✅ E2E tests with real blockchain (100+ test cases)
- ✅ Zero blockchain-related errors in production test suite

---

## Phase 4: Peer-to-Peer Repository Hosting

**Duration:** 3-4 weeks  
**Priority:** MEDIUM  
**Status:** Architecture designed, implementation pending

### Phase 4 Objectives
1. Implement P2P repository synchronization
2. Add peer discovery via DCC protocol
3. Support local repository hosting on client peers
4. Implement distributed consensus
5. Add repository replication across peers

### Phase 4 Components

#### 4.1 Peer Repository Hosting

**Concept:**
- Peers can host repositories locally (not just relay tracker)
- Repositories sync via P2P DCC protocol
- Provides fault tolerance and offline access

**Files to Create:**
- `client/src/lib/repositoryClient.ts` - P2P repository operations
- `client/src/commands/peer_repository.rs` - Tauri commands for P2P
- Documentation on P2P replication

#### 4.2 Repository Replication

**Strategy:**
- Use existing DCC protocol for replication
- Gossip protocol for eventual consistency
- Conflict resolution via blockchain consensus
- Full audit trail on blockchain

#### 4.3 Peer Discovery

**Implementation:**
- Use existing peer listener infrastructure
- Register repositories in peer discovery
- Announce repository availability in broadcast messages

### Phase 4 Tasks

- [ ] **Task 4.1:** Design P2P repository sync protocol
- [ ] **Task 4.2:** Implement repository replication
- [ ] **Task 4.3:** Add peer repository hosting support
- [ ] **Task 4.4:** Implement conflict resolution
- [ ] **Task 4.5:** Create P2P repository tests

### Phase 4 Success Criteria
- ✅ Peers can host repositories locally
- ✅ Repositories sync across peers
- ✅ Conflict-free operation
- ✅ Offline peer support
- ✅ Fault tolerance (network partition recovery)

---

## Parallel Work Tracks

### Testing Track (Ongoing)
- Unit tests for each component
- Integration tests for API endpoints
- E2E tests for complete flows
- Performance/load testing
- Security/penetration testing

### Documentation Track (Ongoing)
- API reference documentation
- User guides
- Developer guides
- Security documentation
- Deployment guides

### DevOps Track (Ongoing)
- CI/CD pipeline setup
- Automated testing in CI
- Docker containerization
- Deployment automation
- Monitoring/logging

---

## Dependency Graph

```
Phase 1 (Desktop Client) ✅
    ↓
Phase 1.5 (SDK Scaffolding) ✅
    ├─→ Phase 2 (RemoteHouse) → Parallel work
    │       ├─ Script execution ✅
    │       ├─ Input validation ✅
    │       └─ API endpoints ✅
    │
    └─→ Phase 3 (Fabric Integration)
            ├─ Local Fabric setup
            ├─ Certificate implementation
            ├─ FabricClient methods
            └─ Chaincode operations
                ↓
            Phase 4 (P2P Hosting)
```

---

## Resource Allocation

### Phase 2 Timeline
```
Week 1:
  - Mon-Tue: Repository management APIs
  - Wed-Thu: Script execution debugging
  - Fri: Integration testing

Week 2:
  - Mon-Wed: E2E test creation
  - Thu-Fri: Documentation
```

### Phase 3 Timeline
```
Week 1:
  - Mon: Local Fabric setup
  - Tue-Wed: Certificate implementation
  - Thu-Fri: FabricClient implementation

Week 2:
  - Mon-Wed: Chaincode operations
  - Thu: Error handling & retry logic
  - Fri: Integration testing

Week 3:
  - Mon-Wed: Transaction signing
  - Thu-Fri: Comprehensive testing & docs
```

---

## Key Decisions Pending

### Decision 1: Fabric Network Mode
- **Option A (Current):** Single network for all peers
- **Option B:** Separate networks per organization
- **Recommendation:** Use Option A initially for simplicity, migrate to B for multi-org production

### Decision 2: Certificate Distribution
- **Option A:** Centralized CA (trusted authority issues certs)
- **Option B:** Self-signed certificates (each peer signs own)
- **Recommendation:** Use Option A for Phase 3 (test network), Option B for production

### Decision 3: Chaincode Language
- **Option A:** JavaScript (currently planned)
- **Option B:** Go (Fabric standard)
- **Recommendation:** JavaScript for easier maintenance, migrate to Go if performance issues

---

## Success Metrics

### Phase 2 Completion
- [ ] 100% API endpoint operational
- [ ] 50+ integration tests passing
- [ ] Zero security vulnerabilities
- [ ] <100ms average endpoint response time

### Phase 3 Completion
- [ ] Fabric network stable (99.9% uptime in local tests)
- [ ] All FabricClient methods operational
- [ ] 100+ blockchain operations tests passing
- [ ] <500ms average transaction time
- [ ] Full audit trail on ledger

### Overall Project Readiness
- [ ] All phases complete
- [ ] 500+ test cases passing
- [ ] Documentation complete (1000+ pages)
- [ ] Security audit completed
- [ ] Performance benchmarked
- [ ] Ready for production beta

---

## Known Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Fabric network instability | Medium | High | Use managed Fabric (IBM Cloud) for production |
| Certificate extraction issues | Medium | High | Comprehensive unit tests + integration tests |
| Performance degradation at scale | Medium | Medium | Caching + indexing + database backend |
| P2P sync conflicts | Low | High | Blockchain-based conflict resolution |
| Security vulnerabilities | Low | Critical | Code review + security audit |

---

## Next Immediate Actions

### To Start Phase 2 (Now Ready):
1. [ ] Review RemoteHouse endpoints implementation ✅
2. [ ] Verify scriptExecutor.ts integration
3. [ ] Test validators.ts with real inputs
4. [ ] Create repository management Tauri commands
5. [ ] Write E2E tests for script execution

### To Start Phase 3 (When Ready):
1. [ ] Docker Compose setup for Fabric
2. [ ] X.509 certificate test data
3. [ ] Deploy test chaincode
4. [ ] Integration testing framework
5. [ ] Performance benchmarking setup

---

## References

**Current Documentation:**
- `/docs/PHASE_1_5_IMPLEMENTATION.md` - SDK scaffolding details
- `/docs/COMPLETE_ARCHITECTURE_OVERVIEW.md` - System architecture
- `/docs/FABRIC_IMPLEMENTATION_GUIDE.md` - Fabric SDK guide
- `/IMPLEMENTATION_TODO.md` - Task breakdown

**Source Code:**
- `/client/src-tauri/src/fabric/` - Fabric SDK module
- `/server/lib/scriptExecutor.ts` - Script execution
- `/server/lib/validators.ts` - Input validation
- `/server/app/api/remotehouse/` - API endpoints

**Example Data:**
- `/example-repo/scripts/` - Example scripts
- `/example-repo/data/` - Example data structures

---

## Questions & Discussion Points

1. **Fabric Governance:** Should we implement multi-sig approval for deletions?
2. **Performance:** Should we add caching layer for frequently accessed repositories?
3. **Scalability:** Should Phase 2 include database backend for large repos?
4. **Security:** Should we implement rate limiting on API endpoints?
5. **UX:** Should we add progress indicators for long-running script operations?

---

**Status:** 🚀 Ready for Phase 2 Implementation  
**Last Updated:** October 31, 2025  
**Next Review:** After Phase 2 completion
