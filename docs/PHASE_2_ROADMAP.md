# Phase 2 Implementation Roadmap

**Status**: Ready to Begin  
**Start Date**: Post-Cleanup Session  
**Duration Estimate**: 4-6 weeks  
**Focus**: Real Fabric Blockchain Integration

---

## Executive Summary

Phase 2 focuses on connecting the Tauri client to a **real Hyperledger Fabric blockchain** where Fabric chaincode becomes the single source of truth for all application data. The relay tracker remains minimal (cert registration + seed nodes only), and RemoteHouse serves only as a UI for peer discovery.

---

## Architecture Context

```
┌─────────────────────────────────────────────────────────┐
│                    Hyperledger Fabric                   │
│            (Single Source of Truth for Data)            │
│  - Entries, Comments, Ratings (via chaincode)           │
│  - Smart contract execution & validation                │
└─────────────────────────────────────────────────────────┘
                          ↑
                       (gRPC)
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                    Tauri Desktop Client                      │
│  - FabricClient (13 methods for blockchain ops)              │
│  - Certificate management (X.509)                            │
│  - P2P communication via DCC protocol                        │
│  - RemoteHouse UI (peer discovery only)                      │
└──────────────────────────────────────────────────────────────┘
     ↓                                                    ↓
┌──────────────┐                                ┌──────────────┐
│ Relay Tracker│  (Minimal: cert registration  │ Other Clients│
│ (Stateless)  │   + seed nodes only)           │ (Peer-to-Peer)
└──────────────┘                                └──────────────┘
```

---

## Deliverables by Phase

### Phase 2.1: Foundation Setup (Week 1-2)

#### 2.1.1 Fabric Network Setup
- [ ] Deploy local Hyperledger Fabric network (using docker-compose or Kind)
- [ ] Create channel for application
- [ ] Set up Certificate Authority (CA)
- [ ] Configure peer nodes, orderer, and CouchDB ledger

**Files to Create**:
- `docs/FABRIC_NETWORK_SETUP.md` - Instructions for local Fabric setup
- `fabric/docker-compose.yml` - Fabric network composition
- `fabric/configtx.yaml` - Channel configuration
- `fabric/crypto-config.yaml` - Certificate generation config

#### 2.1.2 X.509 Certificate Management
- [ ] Implement real X.509 certificate generation (currently mock)
- [ ] Integrate with Fabric CA for certificate enrollment
- [ ] Store certificates securely on client
- [ ] Implement certificate renewal logic

**Files to Modify**:
- `/client/src-tauri/src/commands/` - Real certificate generation
- `/client/src/components/CertificateManager.tsx` - Certificate UI

**Expected Functions**:
```rust
async fn generate_and_enroll_certificate(
    username: String,
    org: String,
    fabric_ca_url: String
) -> Result<(String, String), String>  // Returns (cert_pem, key_pem)

async fn load_certificate_from_disk() -> Result<X509Certificate, String>

async fn validate_certificate_chain() -> Result<(), String>

async fn renew_certificate_if_needed() -> Result<(), String>
```

---

### Phase 2.2: FabricClient Real Implementation (Week 2-3)

#### 2.2.1 gRPC Client Implementation
- [ ] Implement gRPC client for Fabric Endorsers
- [ ] Connect to peer nodes for proposal submission
- [ ] Handle endorsement responses
- [ ] Implement transaction submission to Orderer

**Files to Modify**:
- `/client/src-tauri/src/fabric/` - Real Fabric gRPC implementation

**Expected Functions**:
```rust
async fn submit_proposal(
    chaincode_id: String,
    function: String,
    args: Vec<String>,
    cert: &X509Certificate
) -> Result<ProposalResponse, FabricError>

async fn submit_transaction(
    proposal_response: ProposalResponse,
    endorsements: Vec<Endorsement>,
    cert: &X509Certificate
) -> Result<String, FabricError>  // Returns transaction ID

async fn query_chaincode(
    chaincode_id: String,
    function: String,
    args: Vec<String>
) -> Result<String, FabricError>

async fn listen_to_events(
    chaincode_id: String,
    callback: Box<dyn Fn(Event)>
) -> Result<(), FabricError>
```

#### 2.2.2 Transaction Signing
- [ ] Implement ECDSA transaction signing with client certificate
- [ ] Add signature validation logic
- [ ] Handle nonce generation and request signing

**Expected Implementation**:
- Use `ring` or `openssl` crate for cryptographic operations
- Sign protobuf messages for Fabric
- Validate signatures from other peers

---

### Phase 2.3: Chaincode Development (Week 3-4)

#### 2.3.1 Entry Management Chaincode
- [ ] Implement `CreateEntry` function
  - Input: `repo_name`, `title`, `content`, `author`, `timestamp`
  - Validation: Verify certificate signature
  - Action: Store in Fabric ledger
  - Event: Emit `EntryCreated` event

- [ ] Implement `UpdateEntry` function
  - Input: `entry_id`, `new_content`, `timestamp`
  - Validation: Verify author or admin
  - Action: Update ledger, preserve history
  - Event: Emit `EntryUpdated` event

- [ ] Implement `DeleteEntry` function
  - Input: `entry_id`
  - Validation: Verify author or admin
  - Action: Mark as deleted (keep history)
  - Event: Emit `EntryDeleted` event

- [ ] Implement `GetEntry` function
  - Query: Retrieve entry by ID
  - Return: Full entry data with metadata

- [ ] Implement `ListEntries` function
  - Query: Filter by repo, author, date range
  - Return: Paginated entry list

**Chaincode Language**: Go or JavaScript (recommend Go for performance)

**File Structure**:
```
fabric/chaincode/
├── entries.go
├── comments.go
├── ratings.go
├── utils.go
└── main.go
```

#### 2.3.2 Comment Management Chaincode
- [ ] Implement `AddComment` function
- [ ] Implement `GetComments` function (filtered by entry)
- [ ] Implement `DeleteComment` function
- [ ] Implement comment threading logic

#### 2.3.3 Rating Management Chaincode
- [ ] Implement `SubmitRating` function
- [ ] Implement `GetRatings` function
- [ ] Aggregate rating logic (average, distribution)

---

### Phase 2.4: TUI/CLI Integration (Week 4-5)

#### 2.4.1 Tauri Command Handlers
Update existing FabricClient methods to use real Fabric:

- [ ] `fabric_add_entry` → Submit to real Fabric
- [ ] `fabric_update_entry` → Real Fabric transaction
- [ ] `fabric_delete_entry` → Real Fabric transaction
- [ ] `fabric_query_entries` → Query ledger
- [ ] `fabric_get_entry` → Real ledger query
- [ ] `fabric_add_comment` → Real Fabric transaction
- [ ] `fabric_query_comments` → Real ledger query

#### 2.4.2 User Interface Updates
- [ ] Update entry creation form to show transaction status
- [ ] Add transaction ID display
- [ ] Show blockchain confirmation status
- [ ] Real-time update notifications

---

### Phase 2.5: Testing & Validation (Week 5-6)

#### 2.5.1 Unit Tests
- [ ] Test certificate generation and enrollment
- [ ] Test transaction signing
- [ ] Test gRPC communication
- [ ] Test chaincode functions (invoke tests on dev Fabric)

#### 2.5.2 Integration Tests
- [ ] End-to-end: Create entry → Submit to Fabric → Query
- [ ] Cross-client: Entry created by Client A, visible to Client B
- [ ] Certificate: Real X.509 validation
- [ ] Chaincode: Complex queries and filtering

#### 2.5.3 Performance Testing
- [ ] Transaction throughput (entries/second)
- [ ] Query response time
- [ ] Certificate validation overhead
- [ ] Network latency impact

#### 2.5.4 Documentation
- [ ] API reference for all Tauri commands
- [ ] Chaincode function documentation
- [ ] Transaction flow diagrams
- [ ] Error handling guide

---

## Implementation Details

### 2.1 Real Fabric Network

**Setup Steps**:
1. Clone Hyperledger Fabric samples repository
2. Create channel configuration with application channel
3. Deploy CouchDB for state database
4. Enroll admin and client certificates via CA
5. Deploy example chaincode

**Local Fabric on Docker**:
```bash
# Start Fabric network
cd fabric
docker-compose up -d

# Create channel
docker exec cli peer channel create ...

# Install chaincode
docker exec cli peer lifecycle chaincode install ...

# Approve chaincode
docker exec cli peer lifecycle chaincode approveformyorg ...

# Commit chaincode
docker exec cli peer lifecycle chaincode commit ...
```

### 2.2 Certificate Authority Integration

**Enrollment Flow**:
```
Tauri App
    ↓
Fabric CA REST API (http://ca:7054)
    ↓
Generate X.509 Certificate
    ↓
Return (cert_pem, key_pem)
    ↓
Store in ~/.flashback/fabric/
    ↓
Use in all Fabric transactions
```

### 2.3 Chaincode Data Model

**Entry Structure** (in Fabric State):
```json
{
  "id": "entry-uuid",
  "repo": "project-name",
  "title": "Entry Title",
  "content": "Entry content...",
  "author": "user@domain.com",
  "created_at": 1693456789,
  "updated_at": 1693456789,
  "version": 1,
  "signatures": [{"signer": "user@domain.com", "value": "..."}]
}
```

**Comment Structure**:
```json
{
  "id": "comment-uuid",
  "entry_id": "entry-uuid",
  "content": "Comment text",
  "author": "user@domain.com",
  "created_at": 1693456789,
  "thread_id": "parent-comment-uuid or null"
}
```

**Rating Structure**:
```json
{
  "entry_id": "entry-uuid",
  "rater": "user@domain.com",
  "rating": 5,
  "created_at": 1693456789
}
```

---

## Risk Mitigation

### Risk 1: Fabric Network Complexity
**Mitigation**: Start with single-peer setup locally, scale gradually
- Week 1: Single peer, single org
- Week 2: Multiple peers if needed
- Week 3: Multi-org setup (optional for phase 2)

### Risk 2: Certificate Management
**Mitigation**: Use Fabric CA for credential management
- Implement automatic renewal 30 days before expiry
- Fallback certificate if renewal fails
- Secure key storage (OS keychain if possible)

### Risk 3: Transaction Finality
**Mitigation**: Implement proper confirmation logic
- Wait for transaction commit to ledger
- Handle timeout scenarios
- Implement retry logic with exponential backoff

### Risk 4: Chaincode Upgrades
**Mitigation**: Version chaincode properly
- Implement data migration strategy
- Support multiple chaincode versions during transition
- Test upgrades in development

---

## Success Criteria

### Phase 2.1 Completion
✅ Local Fabric network running with channel created  
✅ Real X.509 certificates generated and validated  
✅ Documentation covers full setup process

### Phase 2.2 Completion
✅ FabricClient connects to real Fabric network  
✅ Transactions are signed with real certificates  
✅ gRPC communication working end-to-end

### Phase 2.3 Completion
✅ All chaincode functions deployed and tested  
✅ Data model validated on Fabric ledger  
✅ Cross-client synchronization working

### Phase 2.4 Completion
✅ Tauri commands integrated with real Fabric  
✅ UI shows real transaction status  
✅ No more mock Fabric responses

### Phase 2.5 Completion
✅ All tests passing (unit, integration, performance)  
✅ Production documentation complete  
✅ Ready for Phase 3 (multi-org, production deployment)

---

## Estimated Effort

- **Development**: 120-150 hours
- **Testing**: 40-50 hours
- **Documentation**: 30-40 hours
- **Buffer (contingency)**: 20-30 hours
- **Total**: ~210-270 hours (5-7 weeks @ 40 hrs/week)

---

## References & Resources

### Hyperledger Fabric
- [Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Samples](https://github.com/hyperledger/fabric-samples)
- [Fabric SDK Go](https://github.com/hyperledger/fabric-sdk-go)

### Rust Fabric Integration
- [fabric-sdk-rs](https://github.com/hyperledger-labs/fabric-sdk-rs)
- [grpc-rs](https://github.com/grpc/grpc-rs)
- [openssl-rs](https://github.com/sfackler/rust-openssl)

### Chaincode Development
- [Fabric Chaincode Tutorials](https://hyperledger-fabric.readthedocs.io/en/latest/developapps/smartcontract.html)
- [Go Chaincode Example](https://github.com/hyperledger/fabric-samples/tree/main/chaincode/fabcar/go)

---

## Next Action Items

1. **Immediately**: Review and approve Phase 2 roadmap
2. **This Week**: Set up local Fabric network
3. **Next Week**: Begin certificate implementation
4. **Week 3**: Start chaincode development
5. **Ongoing**: Keep architecture documentation updated

---

**Approved By**: [User Confirmation Needed]  
**Last Updated**: [Current Date]
