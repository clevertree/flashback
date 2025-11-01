# Flashback Chaincode - Movie Channel

This directory contains the Hyperledger Fabric chaincode for the Flashback distributed content management system.

## Overview

The Movie Chaincode (`chaincode/movie/`) implements the business logic for managing movie content on the blockchain:

- **Content Requests**: Users submit requests to add new movies with IMDb information
- **Approval Workflow**: Moderators review and approve content requests
- **Movie Catalog**: Approved movies are stored and queryable on the ledger
- **Audit Trail**: Full immutable history of all submissions and approvals

## Directory Structure

```
chaincode/
├── movie/           (Primary: Fully implemented)
│   ├── main.go      (Not in this structure - see below)
│   ├── movie.go     (Core chaincode logic)
│   ├── models.go    (Data models and structures)
│   ├── go.mod       (Dependencies)
│   └── README.md    (This file)
├── tvshow/          (Placeholder: Ready for implementation)
├── games/           (Placeholder: Ready for implementation)
└── voting/          (Placeholder: Ready for implementation)
```

## Prerequisites

Before building and deploying the chaincode, ensure you have:

1. **Go 1.19 or higher**
   ```bash
   go version
   ```

2. **Hyperledger Fabric Runtime** - via Kaleido or local network
   - Kaleido Network ID: `u0inmt8fjp`
   - Organization: `Org1MSP`

3. **Chaincode Dependencies**
   ```bash
   go mod tidy
   ```

## Building the Chaincode

### Step 1: Install Dependencies

```bash
cd chaincode/movie
go mod download
go mod tidy
```

### Step 2: Build the Chaincode

For local testing:
```bash
go build -o bin/chaincode
```

For Kaleido deployment (Docker container):
```bash
docker build -t flashback-movie-chaincode:1.0 .
```

### Step 3: Verify Build

```bash
go test ./... -v
```

## Deploying to Kaleido

### Via Kaleido Console (Recommended)

1. **Navigate to Kaleido Dashboard**
   - Go to: https://kaleido.io/console
   - Select Network: `u0inmt8fjp`

2. **Create Chaincode**
   - Channel: `movies`
   - Click "Add Chaincode"
   - Name: `movie-chaincode`
   - Version: `1.0`
   - Choose file: `chaincode/movie/bin/chaincode` or Docker image

3. **Install Chaincode**
   - Select peers where to install
   - Click "Install"

4. **Instantiate Chaincode**
   - Select Channel: `movies`
   - Chaincode: `movie-chaincode`
   - Version: `1.0`
   - Click "Instantiate"
   - Arguments: (none for this chaincode)
   - Policy: Default (`admin`) or custom
   - Click "Instantiate"

5. **Verify Installation**
   ```bash
   # Using fabric-cli
   fabric channel query instantiated -c movies
   ```

### Via REST API (Advanced)

```bash
# 1. Get organization credentials from Kaleido console
export KALEIDO_API_KEY="your-api-key"
export KALEIDO_API_SECRET="your-api-secret"

# 2. Package chaincode
peer lifecycle chaincode package movie.tar.gz \
  --path ./chaincode/movie \
  --lang golang \
  --label movie_1

# 3. Install on peer
peer lifecycle chaincode install movie.tar.gz

# 4. Approve for organization
peer lifecycle chaincode approveformyorg \
  --channelID movies \
  --name movie-chaincode \
  --version 1.0 \
  --package-id <PACKAGE_ID> \
  --sequence 1

# 5. Commit chaincode definition
peer lifecycle chaincode commit \
  --channelID movies \
  --name movie-chaincode \
  --version 1.0 \
  --sequence 1
```

## Data Models

### ContentRequest

Represents a user submission to add new movie content:

```json
{
  "imdb_id": "tt1375666",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "doc_type": "ContentRequest",
  "title": "Inception",
  "director": "Christopher Nolan",
  "release_year": 2010,
  "genres": ["Science Fiction", "Thriller"],
  "description": "A skilled thief who steals corporate secrets through dream-sharing technology",
  "submitter_id": "user1",
  "notes": "Essential sci-fi classic",
  "torrent_hash": "Qm...",
  "status": "pending_review",
  "submitted_at": "2025-11-01T10:30:00Z",
  "reviewed_by": "",
  "reviewed_at": "",
  "rejection_reason": "",
  "version": 1
}
```

**Key Fields:**
- **imdb_id** (Primary Key): Globally unique IMDb identifier. Format: `tt` + 7-8 digits
- **request_id** (Unique): UUID generated per submission instance
- **torrent_hash** (Optional): WebTorrent hash for distributed P2P download. Can be provided at submission time
- **status**: One of `pending_review`, `approved`, `rejected`

**IMDb Uniqueness Enforcement:**
The chaincode enforces IMDb ID uniqueness using a composite key pattern:
- Ledger key format: `"ContentRequest:tt1375666"`
- This design prevents duplicate submissions at the ledger level
- Attempting to submit same IMDb ID returns: `"Movie with IMDb ID already submitted or approved"`
- Prevents data duplication without requiring explicit unique constraints

### Movie

Represents an approved movie in the catalog:

```json
{
  "imdb_id": "tt1375666",
  "movie_id": "660e8400-e29b-41d4-a716-446655440001",
  "doc_type": "Movie",
  "title": "Inception",
  "director": "Christopher Nolan",
  "release_year": 2010,
  "genres": ["Science Fiction", "Thriller"],
  "description": "A skilled thief...",
  "torrent_hash": "abc123def456...",
  "file_size": 2147483648,
  "duration": 148,
  "approved_by": "admin1",
  "approved_at": "2025-11-01T11:00:00Z",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "submitter_id": "user1",
  "created_at": "2025-11-01T11:00:00Z",
  "updated_at": "2025-11-01T11:00:00Z",
  "version": 1,
  "views": 0,
  "downloads": 0,
  "ratings": [],
  "average_rating": 0.0
}
```

## Chaincode Functions

### Invoke Functions (Write to Ledger)

#### `SubmitContentRequest`

Submit a new movie content request.

**Arguments:**
```
[
  "tt1375666",                    // imdbID (required, format: tt[7-8 digits])
  "Inception",                    // title (required, max 500 chars)
  "Christopher Nolan",            // director (optional)
  "2010",                         // releaseYear (optional)
  "[\"Science Fiction\", \"Thriller\"]",  // genres (JSON array)
  "A skilled thief...",           // description (optional, max 5000 chars)
  "user1",                        // submitterID (required)
  "Essential sci-fi",             // notes (optional, max 1000 chars)
  "QmXxxx..."                     // torrentHash (optional, WebTorrent hash for distributed download)
]
```

**Validation Rules:**
- IMDb ID must match format: `tt[7-8 digits]` (e.g., `tt1375666`)
- Title is required and must be ≤ 500 characters
- No duplicate IMDb IDs allowed (prevents duplicate submissions via composite key: "ContentRequest:imdbID")
- TorrentHash is optional - if provided, enables distributed P2P download
- Returns `ContentRequest` with generated `request_id`

**Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... ContentRequest object with torrent_hash field ... },
  "txn_id": "abc123..."
}
```

**Example:**
```bash
peer chaincode invoke -C movies -n movie-chaincode \
  -c '{"function":"SubmitContentRequest","Args":["tt1375666","Inception","Christopher Nolan","2010","[\"Science Fiction\"]","A skilled thief...","user1","Great movie","QmXxxx..."]}'
```

#### `ApproveContentRequest`

Approve a pending content request and create movie entry.

**Arguments:**
```
[
  "tt1375666",   // imdbID
  "admin1"       // moderatorID
]
```

**Validation:**
- ContentRequest must exist for given IMDb ID
- Status must be "pending_review" (not already approved)

**Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "content_request": { ... updated with status="approved" ... },
    "movie": { ... newly created Movie entry ... }
  },
  "txn_id": "def456..."
}
```

#### `RejectContentRequest`

Reject a pending content request.

**Arguments:**
```
[
  "tt1375666",                    // imdbID
  "admin1",                       // moderatorID
  "Does not meet content policy"  // rejectionReason
]
```

### Query Functions (Read from Ledger)

#### `QueryAll`

Get all approved movies in the channel.

**Arguments:** (none)

**Response:** Array of Movie objects

```json
[
  {
    "imdb_id": "tt1375666",
    "title": "Inception",
    ...
  },
  {
    "imdb_id": "tt0111161",
    "title": "The Shawshank Redemption",
    ...
  }
]
```

#### `SearchByTitle`

Search for movies by title (case-insensitive substring match).

**Arguments:**
```
[
  "inception",     // titleQuery
  "20"             // limit (optional, default: 20, max: 100)
]
```

**Response:** Array of matching Movie objects

#### `GetMovieByIMDBID`

Retrieve a specific movie by IMDb ID.

**Arguments:**
```
[
  "tt1375666"  // imdbID
]
```

**Response:** Single Movie object or error if not found

#### `GetRequestHistory`

Get all versions and approval history for a content request.

**Arguments:**
```
[
  "tt1375666"  // imdbID
]
```

**Response:** Array of historical versions with timestamps

```json
[
  {
    "value": {
      "status": "pending_review",
      "submitted_at": "2025-11-01T10:30:00Z"
    },
    "timestamp": "2025-11-01T10:30:00Z",
    "is_delete": false
  },
  {
    "value": {
      "status": "approved",
      "reviewed_by": "admin1",
      "reviewed_at": "2025-11-01T11:00:00Z"
    },
    "timestamp": "2025-11-01T11:00:00Z",
    "is_delete": false
  }
]
```

## Testing

### Unit Tests

```bash
cd chaincode/movie
go test -v ./...
```

### Integration Testing with Fabric CLI

```bash
# 1. Query all movies
fabric chaincode query movies movie-chaincode -f QueryAll

# 2. Submit content request
fabric chaincode invoke movies movie-chaincode -f SubmitContentRequest \
  -a "tt1375666" "Inception" "Christopher Nolan" "2010" \
     "[\"Science Fiction\"]" "A skilled thief..." "user1" "Great movie"

# 3. Search by title
fabric chaincode query movies movie-chaincode -f SearchByTitle \
  -a "inception" "20"

# 4. Approve request (admin only)
fabric chaincode invoke movies movie-chaincode -f ApproveContentRequest \
  -a "tt1375666" "admin1"

# 5. Get request history
fabric chaincode query movies movie-chaincode -f GetRequestHistory \
  -a "tt1375666"
```

## Validation Rules

| Field | Rule | Example |
|-------|------|---------|
| IMDb ID | Format: `tt[7-8 digits]`, unique per system | `tt1375666` ✓ |
| Title | Required, max 500 chars | "Inception" ✓ |
| Director | Optional, max 200 chars | "Christopher Nolan" ✓ |
| Release Year | Optional, 4-digit year | 2010 ✓ |
| Genres | Optional JSON array | `["Sci-Fi", "Thriller"]` ✓ |
| Description | Optional, max 5000 chars | "A skilled thief..." ✓ |
| Submitter ID | Required, user identity | "user1" ✓ |
| Notes | Optional, max 1000 chars | "Essential classic" ✓ |

## Error Handling

### Common Errors

**Validation Errors:**
```json
{
  "success": false,
  "message": "Validation failed: 2 error(s)",
  "errors": [
    {
      "field": "imdb_id",
      "message": "Invalid IMDb ID format",
      "code": "invalid_format"
    },
    {
      "field": "imdb_id",
      "message": "Movie already submitted",
      "code": "duplicate"
    }
  ]
}
```

**Connection Errors:**
```json
{
  "success": false,
  "message": "Not connected to network",
  "errors": []
}
```

## Troubleshooting

### Chaincode Won't Install
- Check Go version: `go version` (require 1.19+)
- Verify dependencies: `go mod tidy`
- Check permissions: `chmod +x bin/chaincode`

### Queries Return Empty Results
- Verify chaincode is instantiated on the channel
- Check CouchDB selector syntax in query string
- Ensure movies have been approved first

### Permission Denied on Approve
- Verify submitter identity is correct
- Check chaincode access control policies
- Ensure moderator has `write` permission

### IMDb ID Validation Fails
- Check format: must be `tt` + 7-8 digits
- Example: `tt1375666` (valid), `t1375666` (invalid)

## Performance Considerations

- **State Database**: Uses CouchDB for rich queries (part of Kaleido)
- **Indexing**: Queries automatically indexed by `doc_type` and status
- **Pagination**: Large result sets automatically paginated (limit: 100)
- **History**: Full audit trail stored efficiently using state versioning

## Security

### Access Control
- **Submit Request**: Any authenticated user
- **Approve Request**: Admin/Moderator only (enforced via channel policies)
- **Query**: Any authenticated user

### Immutability
- All transactions are immutable once recorded
- History preserved for full audit trail
- Timestamps verified by blockchain network time

### Data Validation
- All inputs validated before writing to ledger
- IMDb IDs checked for uniqueness
- Required fields enforced
- String lengths validated

## Future Enhancements

1. **Rating System**: Add user ratings and aggregated scores
2. **Comments/Reviews**: Enable user reviews on movies
3. **Torrent Integration**: Automatically validate torrent hashes
4. **Advanced Search**: Full-text search with faceting
5. **Content Curation**: Create custom movie lists/collections
6. **Notification System**: Notify users when requests are approved/rejected

## Contributing

When implementing additional chaincodes (tvshow, games, voting):

1. Follow the same pattern as movie chaincode
2. Create `models.go` with data structures
3. Implement core functions in main chaincode file
4. Add unit tests with 80%+ coverage
5. Update this README with new functions
6. Submit PR for review

## License

See root LICENSE file

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Kaleido documentation: https://docs.kaleido.io
3. Consult Fabric docs: https://hyperledger-fabric.readthedocs.io
4. Open issue on GitHub repository

---

**Last Updated:** 2025-11-01  
**Version:** 1.0.0  
**Maintainer:** Development Team
