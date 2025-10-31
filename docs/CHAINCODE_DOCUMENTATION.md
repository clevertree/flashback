# Flashback Fabric Chaincode Documentation

This directory contains three Hyperledger Fabric chaincodes for the Flashback application:

1. **Entries** - Manage entries/posts in the blockchain
2. **Comments** - Manage comments and discussion threads
3. **Ratings** - Manage user ratings and reviews

---

## Architecture Overview

```
Channel: flashback
├── Chaincode: entries
│   └── Functions: CreateEntry, GetEntry, UpdateEntry, DeleteEntry, ListEntries, etc.
├── Chaincode: comments
│   └── Functions: AddComment, GetComment, UpdateComment, DeleteComment, GetEntryComments, etc.
└── Chaincode: ratings
    └── Functions: SubmitRating, GetRating, DeleteRating, GetEntryRatings, GetAverageRating, etc.
```

---

## Entries Chaincode

### Overview
Manages entries (posts) in repositories. Each entry is immutable by default but can be updated by the author.

### Data Structure

```go
type Entry struct {
    ID          string    // Unique entry ID
    RepoName    string    // Repository name
    Title       string    // Entry title
    Description string    // Short description
    Content     string    // Full content
    Author      string    // Author's email/ID
    CreatedAt   string    // Creation timestamp
    UpdatedAt   string    // Last update timestamp
    Tags        []string  // Entry tags
    TorrentHash string    // IPFS/BitTorrent hash
    Status      string    // "active", "archived", "deleted"
    Version     int       // Edit version number
    EditHistory []string  // Edit timestamps and authors
}
```

### Functions

#### CreateEntry
Creates a new entry in the blockchain.

**Arguments**:
```
[entryID, repoName, title, description, content, author, torrentHash, tags(JSON)]
```

**Example**:
```bash
peer chaincode invoke -C flashback -n entries \
  -c '{"function":"CreateEntry","Args":["entry-001","flashback","My First Entry","A sample entry","Full content here","user@example.com","QmXxxx","[\"tag1\",\"tag2\"]"]}'
```

**Returns**: Success message or error

---

#### GetEntry
Retrieves a single entry by ID.

**Arguments**:
```
[entryID, repoName]
```

**Example**:
```bash
peer chaincode query -C flashback -n entries \
  -c '{"function":"GetEntry","Args":["entry-001","flashback"]}'
```

**Returns**: Entry object or error

---

#### UpdateEntry
Updates an existing entry (content only, not metadata).

**Arguments**:
```
[entryID, repoName, newTitle, newDescription, newContent, updatedBy, newTorrentHash]
```

**Example**:
```bash
peer chaincode invoke -C flashback -n entries \
  -c '{"function":"UpdateEntry","Args":["entry-001","flashback","Updated Title","New desc","Updated content","user@example.com","QmYyyy"]}'
```

**Returns**: Success message or error

---

#### DeleteEntry
Soft-deletes an entry (marks as deleted, keeps history).

**Arguments**:
```
[entryID, repoName, deletedBy]
```

**Example**:
```bash
peer chaincode invoke -C flashback -n entries \
  -c '{"function":"DeleteEntry","Args":["entry-001","flashback","user@example.com"]}'
```

**Returns**: Success message or error

---

#### ListEntries
Lists all entries in a repository.

**Arguments**:
```
[repoName, status(optional), limit(optional)]
```

Status: "active" (default) or empty string for all

**Example**:
```bash
peer chaincode query -C flashback -n entries \
  -c '{"function":"ListEntries","Args":["flashback","active","50"]}'
```

**Returns**: Array of Entry objects

---

#### GetEntryHistory
Gets the edit history of an entry.

**Arguments**:
```
[entryID, repoName]
```

**Returns**: Array of edit history strings

---

#### Search
Performs text search across entries.

**Arguments**:
```
[repoName, query]
```

**Returns**: Array of matching Entry objects

---

#### GetEntryCount
Gets the total number of entries in a repo.

**Arguments**:
```
[repoName]
```

**Returns**: Integer count

---

## Comments Chaincode

### Overview
Manages comments and discussion threads on entries. Supports nested replies and ratings within comments.

### Data Structure

```go
type Comment struct {
    ID        string   // Unique comment ID
    EntryID   string   // ID of entry being commented on
    RepoName  string   // Repository name
    Content   string   // Comment text
    Author    string   // Author's email/ID
    Rating    int      // 1-5 stars (optional)
    CreatedAt string   // Creation timestamp
    UpdatedAt string   // Last update timestamp
    Status    string   // "active", "deleted", "flagged"
    EditCount int      // Number of edits
    ThreadID  string   // Parent comment ID (for replies)
    Replies   []string // Child comment IDs
}
```

### Functions

#### AddComment
Adds a new comment to an entry.

**Arguments**:
```
[commentID, entryID, repoName, content, author, rating(1-5), threadID(optional)]
```

**Example**:
```bash
peer chaincode invoke -C flashback -n comments \
  -c '{"function":"AddComment","Args":["comment-001","entry-001","flashback","Great entry!","user@example.com","5"]}'
```

**Returns**: Success message or error

---

#### GetComment
Retrieves a single comment.

**Arguments**:
```
[commentID, entryID]
```

**Returns**: Comment object or error

---

#### UpdateComment
Updates a comment's content.

**Arguments**:
```
[commentID, entryID, newContent, updatedBy]
```

**Returns**: Success message or error

---

#### DeleteComment
Deletes a comment (soft delete).

**Arguments**:
```
[commentID, entryID, deletedBy]
```

**Returns**: Success message or error

---

#### GetEntryComments
Gets all comments on an entry.

**Arguments**:
```
[entryID, includeDeleted(true/false)]
```

**Returns**: Array of Comment objects

---

#### GetThreadReplies
Gets all replies to a comment.

**Arguments**:
```
[threadID, entryID]
```

**Returns**: Array of Comment objects

---

#### GetAverageRating
Calculates the average rating from comments.

**Arguments**:
```
[entryID]
```

**Returns**: Float average rating

---

## Ratings Chaincode

### Overview
Manages explicit ratings for entries. Separate from comments to track comprehensive rating data.

### Data Structure

```go
type Rating struct {
    ID        string // Unique rating ID
    EntryID   string // ID of entry being rated
    RepoName  string // Repository name
    Rater     string // Rater's email/ID
    Rating    int    // 1-5 stars
    Review    string // Optional written review
    CreatedAt string // Creation timestamp
    UpdatedAt string // Last update timestamp
    Status    string // "active", "deleted"
}
```

### Functions

#### SubmitRating
Submits or updates a rating for an entry.

**Arguments**:
```
[ratingID, entryID, repoName, rater, rating(1-5), review(optional)]
```

**Example**:
```bash
peer chaincode invoke -C flashback -n ratings \
  -c '{"function":"SubmitRating","Args":["rating-001","entry-001","flashback","user@example.com","5","Excellent!"]}'
```

**Returns**: Success message or error

---

#### GetRating
Retrieves a specific rating.

**Arguments**:
```
[ratingID, entryID]
```

**Returns**: Rating object or error

---

#### DeleteRating
Deletes a rating.

**Arguments**:
```
[ratingID, entryID]
```

**Returns**: Success message or error

---

#### GetEntryRatings
Gets all ratings for an entry.

**Arguments**:
```
[entryID]
```

**Returns**: Array of Rating objects

---

#### GetAverageRating
Calculates the average rating.

**Arguments**:
```
[entryID]
```

**Returns**: Float average (e.g., 4.5)

---

#### GetRatingDistribution
Gets the distribution of ratings (1-5 star counts).

**Arguments**:
```
[entryID]
```

**Returns**: JSON object with counts for each star level

**Example Response**:
```json
{
  "1_star": 2,
  "2_stars": 1,
  "3_stars": 3,
  "4_stars": 8,
  "5_stars": 12
}
```

---

#### GetRaterRating
Gets a specific user's rating for an entry.

**Arguments**:
```
[entryID, rater]
```

**Returns**: Rating object from that rater

---

#### GetRatingCount
Gets the total number of ratings for an entry.

**Arguments**:
```
[entryID]
```

**Returns**: Integer count

---

## Deployment

### Building Chaincodes

```bash
# Navigate to chaincode directory
cd entries/

# Get dependencies
go mod download

# Build (optional, for testing)
go build
```

### Deploying to Fabric Network

```bash
# From fabric/ directory
./deploy-chaincode.sh flashback ./chaincode

# Or specify custom channel
./deploy-chaincode.sh my-channel ./chaincode
```

### Manual Deployment

```bash
# Package chaincode
peer lifecycle chaincode package entries_1.0.tar.gz \
    --path /path/to/entries \
    --lang golang \
    --label entries_1.0

# Install on peer
peer lifecycle chaincode install entries_1.0.tar.gz

# Get package ID
peer lifecycle chaincode queryinstalled | grep entries

# Approve for organization
peer lifecycle chaincode approveformyorg \
    --channelID flashback \
    --name entries \
    --version 1.0 \
    --package-id <PACKAGE_ID> \
    --sequence 1

# Commit to channel
peer lifecycle chaincode commit \
    --channelID flashback \
    --name entries \
    --version 1.0 \
    --sequence 1
```

---

## Testing Chaincodes

### Using peer CLI

```bash
# Query all entries in "flashback" repo
peer chaincode query -C flashback -n entries \
  -c '{"function":"ListEntries","Args":["flashback"]}'

# Create new entry
peer chaincode invoke -C flashback -n entries \
  -c '{"function":"CreateEntry","Args":["test-001","flashback","Test","Test entry","Content","test@example.com","hash123"]}'

# Get entry
peer chaincode query -C flashback -n entries \
  -c '{"function":"GetEntry","Args":["test-001","flashback"]}'
```

### Using Tauri Client

The client sends these operations through the gRPC interface:

```rust
// Create entry
fabric_add_entry("flashback", Entry { ... }).await

// Query entries
fabric_query_entries("flashback", Some("search"), None).await

// Add comment
fabric_add_comment("flashback", "entry-001", Comment { ... }).await

// Submit rating
fabric_submit_rating("flashback", "entry-001", Rating { ... }).await
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "required fields cannot be empty" | Missing required argument | Check all arguments provided |
| "entry already exists" | Duplicate entry ID | Use unique entry ID |
| "failed to unmarshal" | Invalid JSON in arguments | Check JSON format |
| "permission denied" | Endorsement policy not met | Check peer endorsement settings |

---

## Performance Considerations

### State Keys
Uses composite keys for efficient querying:
- `entry~repo~{entryID}~{repoName}`
- `comment~entry~{commentID}~{entryID}`
- `rating~entry~{ratingID}~{entryID}`

### Indexes
CouchDB automatically indexes composite keys for fast queries.

### Query Limits
Default limit: 100 entries/comments
Maximum recommended: 1,000

### Pagination
Use `offset` and `limit` in ListEntries for pagination.

---

## Security

### Access Control
- All functions validate required fields
- Composite keys prevent cross-repo/entry interference
- Status field for soft deletes (data recovery possible)

### Audit Trail
- EditHistory tracks all modifications
- CreatedAt/UpdatedAt timestamps
- Author/DeletedBy fields identify actors

### Event Emission
All state changes emit events:
- `EntryCreated`, `EntryUpdated`, `EntryDeleted`
- `CommentAdded`, `CommentUpdated`, `CommentDeleted`
- `RatingSubmitted`, `RatingUpdated`, `RatingDeleted`

---

## Version Control

**Current Version**: 1.0
**Go Version**: 1.21+
**Fabric Version**: 2.5+
**Contract API**: v1.2.2

---

## Upgrading Chaincodes

### Version Bump
```bash
# Update go.mod version
# Update --label and --version in deploy commands
./deploy-chaincode.sh flashback ./chaincode
```

### Data Migration
Upgrade script template:
```go
func (s *SmartContract) MigrateFromV1(ctx contractapi.TransactionContextInterface) error {
    // Handle data transformation from v1.0 to v2.0
    return nil
}
```

---

## Monitoring

### Query Execution Time
```bash
# Time a query
time peer chaincode query -C flashback -n entries \
  -c '{"function":"ListEntries","Args":["flashback"]}'
```

### Block Events
```bash
# Monitor events
peer chaincode query -C flashback -n entries \
  -c '{"function":"GetEntry","Args":["entry-001","flashback"]}'
```

---

## References

- [Fabric Contract API](https://github.com/hyperledger/fabric-contract-api-go)
- [Chaincode Development Guide](https://hyperledger-fabric.readthedocs.io/en/latest/developapps/smartcontract.html)
- [Composite Keys](https://hyperledger-fabric.readthedocs.io/en/latest/smartcontract/smartcontract.html#composite-key)

---

**Last Updated**: October 31, 2025  
**Status**: Production Ready (Phase 2.4)
