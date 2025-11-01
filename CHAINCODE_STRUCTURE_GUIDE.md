# Chaincode Structure Guide - Movie Chaincode Reference

This guide shows the complete Movie chaincode structure to help you implement TVShow, Games, and Voting chaincodes.

## 📚 Movie Chaincode Overview

**Location**: `chaincode/movie/`  
**Files**:
- `models.go` - Data structures and validation rules
- `movie.go` - Chaincode functions and business logic
- `go.mod`, `go.sum` - Dependencies

---

## 🏗️ Data Model Architecture

### 1. **ContentRequest** (User Submission)
Represents a user's request to add new content to the catalog.

```go
type ContentRequest struct {
    // Unique identifiers
    IMDBID    string  // Primary key: tt1375666
    RequestID string  // UUID: unique per request
    DocType   string  // "ContentRequest" (for CouchDB filtering)
    
    // Content metadata
    Title       string   // Movie title
    Director    string   // Director name
    ReleaseYear int      // Release year
    Genres      []string // ["Sci-Fi", "Thriller"]
    Description string   // Plot summary
    
    // Request metadata
    SubmitterID    string // User identity
    Notes          string // Reason for submission
    TorrentHash    string // Optional: WebTorrent hash
    Status         string // "pending_review" | "approved" | "rejected"
    SubmittedAt    string // RFC3339 timestamp
    ReviewedBy     string // Moderator identity
    ReviewedAt     string // Review timestamp
    RejectionReason string // Why rejected
    
    // Audit
    Version int64 // For optimistic locking
}
```

**Key Features**:
- Primary key: IMDb ID (globally unique)
- Prevents duplicate submissions
- Tracks submission history
- Supports rejection reasons

### 2. **Movie** (Approved Content)
Represents an approved movie in the catalog.

```go
type Movie struct {
    // Unique identifiers
    IMDBID  string // Primary key
    MovieID string // UUID: unique instance
    DocType string // "Movie" (for CouchDB filtering)
    
    // Movie data (from approved ContentRequest)
    Title       string
    Director    string
    ReleaseYear int
    Genres      []string
    Description string
    
    // Content distribution
    TorrentHash string // WebTorrent hash
    FileSize    int64  // Bytes
    Duration    int    // Minutes
    
    // Approval tracking
    ApprovedBy  string // Moderator identity
    ApprovedAt  string // Approval timestamp
    RequestID   string // Links to ContentRequest
    SubmitterID string // Original submitter
    
    // Metadata & versioning
    CreatedAt string
    UpdatedAt string
    Version   int64
    
    // Statistics
    Views         int64
    Downloads     int64
    Ratings       []int   // Individual ratings
    AverageRating float64 // Computed average
}
```

**Key Features**:
- Audit trail (tracks approval moderator)
- Statistics (views, downloads, ratings)
- Links to original submission
- Version tracking for concurrent updates

### 3. **Request History Entry** (Audit Trail)
Implicit in GetRequestHistory function - returns timeline of actions.

```go
type RequestHistoryEntry struct {
    IMDBID    string // Which content
    RequestID string // Which request
    Status    string // Status at this time
    Actor     string // Who performed action
    Timestamp string // When it happened
    Action    string // "submit_content_request" | "approve_content_request" | "reject_content_request"
}
```

---

## 🔧 Chaincode Functions Architecture

### Function Pattern: 6-Function Model

All Movie chaincode functions follow this pattern:

```
1. INPUT VALIDATION
   └─ Check required fields
   └─ Validate data formats
   └─ Check constraints (length, ranges)

2. BUSINESS LOGIC
   └─ Check for duplicates
   └─ Apply state transitions
   └─ Update related records

3. LEDGER OPERATIONS
   └─ Read existing state
   └─ Write new state
   └─ Delete if needed

4. AUDIT TRAIL
   └─ Record action in history
   └─ Include actor and timestamp

5. RESPONSE HANDLING
   └─ Return success/error response
   └─ Include transaction ID
   └─ Include detailed error messages

6. ERROR RECOVERY
   └─ Validation errors don't crash
   └─ Return meaningful error codes
   └─ Support retry logic
```

### Function 1: QueryAll
**Purpose**: Retrieve all approved movies  
**Query Type**: Rich query via CouchDB

```go
func (mc *MovieContract) QueryAll(
    ctx contractapi.TransactionContextInterface,
) (*QueryResultset, error) {
    // 1. Build CouchDB query for approved movies
    queryString := fmt.Sprintf(
        `{"selector": {"doc_type": "Movie", "status": "approved"}, 
          "sort": ["release_year"], 
          "limit": %d}`,
        maxLimit,
    )
    
    // 2. Execute query
    resultsIterator, _ := ctx.GetStub().GetQueryResultsWithPagination(queryString, pageSize)
    
    // 3. Iterate results
    var movies []*Movie
    for resultsIterator.HasNext() {
        result, _ := resultsIterator.Next()
        var movie Movie
        json.Unmarshal(result.Value, &movie)
        movies = append(movies, &movie)
    }
    
    // 4. Return with pagination info
    return &QueryResultset{
        Records:     movies,
        RecordCount: len(movies),
        // ...
    }, nil
}
```

**Key Pattern**:
- CouchDB selector syntax
- Pagination support
- Error handling for each step

### Function 2: SearchByTitle
**Purpose**: Filter movies by title  
**Query Type**: Rich query with substring matching

```go
func (mc *MovieContract) SearchByTitle(
    ctx contractapi.TransactionContextInterface,
    titleFilter string,
) ([]*Movie, error) {
    // 1. Sanitize input
    titleFilter = strings.ToLower(titleFilter)
    
    // 2. Build query with regex
    queryString := fmt.Sprintf(
        `{"selector": {"doc_type": "Movie", "title": {"$regex": "(?i)%s"}}}`,
        titleFilter,
    )
    
    // 3. Execute and collect results
    // ...
    
    // 4. Return matching movies
}
```

**Key Pattern**:
- Case-insensitive matching
- Regex pattern support
- Efficient filtering

### Function 3: SubmitContentRequest
**Purpose**: User submits new movie for review  
**State Transition**: None → pending_review

```go
func (mc *MovieContract) SubmitContentRequest(
    ctx contractapi.TransactionContextInterface,
    imdbID string,
    title string,
    // ... other fields
) (*OperationResponse, error) {
    // 1. VALIDATE
    validationErrors := []ValidationError{}
    if !isValidIMDBID(imdbID) {
        validationErrors = append(validationErrors, ValidationError{
            Field:   "imdb_id",
            Message: "Invalid IMDb ID format",
            Code:    "invalid_format",
        })
    }
    
    if len(validationErrors) > 0 {
        return NewErrorResponse(
            "Validation failed",
            validationErrors,
            txnID,
        ), nil
    }
    
    // 2. CHECK DUPLICATES
    existing, _ := mc.getContentRequestByIMDBID(ctx, imdbID)
    if existing != nil {
        return NewErrorResponse(
            "IMDb ID already exists",
            []ValidationError{{
                Field: "imdb_id",
                Code:  "duplicate",
            }},
            txnID,
        ), nil
    }
    
    // 3. CREATE REQUEST
    contentRequest := &ContentRequest{
        IMDBID:      imdbID,
        RequestID:   uuid.New().String(),
        Status:      StatusPendingReview,
        SubmittedAt: time.Now().UTC().Format(time.RFC3339),
        Version:     1,
        // ... other fields
    }
    
    // 4. SAVE TO LEDGER
    requestBytes, _ := json.Marshal(contentRequest)
    _ = ctx.GetStub().PutState(imdbID, requestBytes)
    
    // 5. RETURN SUCCESS
    return NewSuccessResponse(contentRequest, txnID), nil
}
```

**Key Pattern**:
- Explicit validation before state change
- Separate duplicate check
- UUID generation
- State transition logging

### Function 4: ApproveContentRequest
**Purpose**: Admin approves submission  
**State Transition**: pending_review → approved

```go
func (mc *MovieContract) ApproveContentRequest(
    ctx contractapi.TransactionContextInterface,
    imdbID string,
    approvedBy string,
) (*OperationResponse, error) {
    // 1. GET EXISTING REQUEST
    contentRequest, _ := mc.getContentRequestByIMDBID(ctx, imdbID)
    if contentRequest == nil {
        return NewErrorResponse("Request not found", nil, txnID), nil
    }
    
    // 2. VALIDATE STATE
    if contentRequest.Status != StatusPendingReview {
        return NewErrorResponse(
            fmt.Sprintf("Cannot approve request with status: %s", contentRequest.Status),
            nil,
            txnID,
        ), nil
    }
    
    // 3. CREATE MOVIE FROM REQUEST
    movie := &Movie{
        IMDBID:      contentRequest.IMDBID,
        MovieID:     uuid.New().String(),
        DocType:     "Movie",
        Title:       contentRequest.Title,
        // ... copy all fields
        ApprovedBy:  approvedBy,
        ApprovedAt:  time.Now().UTC().Format(time.RFC3339),
        Status:      "approved",
    }
    
    // 4. SAVE MOVIE
    movieBytes, _ := json.Marshal(movie)
    _ = ctx.GetStub().PutState(fmt.Sprintf("movie:%s", imdbID), movieBytes)
    
    // 5. UPDATE REQUEST STATUS
    contentRequest.Status = StatusApproved
    contentRequest.ReviewedBy = approvedBy
    contentRequest.ReviewedAt = time.Now().UTC().Format(time.RFC3339)
    requestBytes, _ := json.Marshal(contentRequest)
    _ = ctx.GetStub().PutState(imdbID, requestBytes)
    
    // 6. EMIT EVENT
    _ = ctx.GetStub().SetEvent("ContentApproved", movieBytes)
    
    // 7. RETURN SUCCESS
    return NewSuccessResponse(movie, txnID), nil
}
```

**Key Pattern**:
- Fetch and validate existing state
- Check state preconditions
- Update all related records
- Emit events for listeners
- Preserve audit trail

### Function 5: GetRequestHistory
**Purpose**: Show audit trail for an IMDb ID  
**Returns**: Timeline of all actions

```go
func (mc *MovieContract) GetRequestHistory(
    ctx contractapi.TransactionContextInterface,
    imdbID string,
) ([]*RequestHistoryEntry, error) {
    // 1. GET CONTENT REQUEST (shows submit action)
    contentRequest, _ := mc.getContentRequestByIMDBID(ctx, imdbID)
    
    var history []*RequestHistoryEntry
    
    // 2. ADD SUBMISSION ENTRY
    if contentRequest != nil {
        history = append(history, &RequestHistoryEntry{
            IMDBID:    imdbID,
            Status:    string(contentRequest.Status),
            Actor:     contentRequest.SubmitterID,
            Timestamp: contentRequest.SubmittedAt,
            Action:    "submit_content_request",
        })
        
        // 3. ADD REVIEW ENTRY if reviewed
        if contentRequest.ReviewedAt != "" {
            history = append(history, &RequestHistoryEntry{
                IMDBID:    imdbID,
                Status:    string(contentRequest.Status),
                Actor:     contentRequest.ReviewedBy,
                Timestamp: contentRequest.ReviewedAt,
                Action:    "approve_content_request",
            })
        }
    }
    
    // 4. RETURN CHRONOLOGICAL HISTORY
    return history, nil
}
```

**Key Pattern**:
- Reconstruct timeline from objects
- Preserve chronological order
- Include all actor information
- Support event-based retrieval

### Function 6: GetMovieByIMDBID
**Purpose**: Direct lookup by IMDb ID  
**Returns**: Single movie object

```go
func (mc *MovieContract) GetMovieByIMDBID(
    ctx contractapi.TransactionContextInterface,
    imdbID string,
) (*Movie, error) {
    // 1. VALIDATE INPUT
    if !isValidIMDBID(imdbID) {
        return nil, fmt.Errorf("invalid IMDb ID format")
    }
    
    // 2. QUERY BY KEY
    movieBytes, err := ctx.GetStub().GetState(fmt.Sprintf("movie:%s", imdbID))
    if err != nil {
        return nil, err
    }
    
    // 3. HANDLE NOT FOUND
    if movieBytes == nil {
        return nil, fmt.Errorf("movie not found")
    }
    
    // 4. UNMARSHAL AND RETURN
    var movie Movie
    json.Unmarshal(movieBytes, &movie)
    return &movie, nil
}
```

**Key Pattern**:
- Simple key lookup
- Minimal validation
- Direct state retrieval

---

## 🔍 Validation & Error Handling Pattern

```go
type ValidationError struct {
    Field   string // "imdb_id"
    Message string // User-friendly message
    Code    string // "required" | "invalid_format" | "duplicate" | "max_length"
}

type OperationResponse struct {
    Success   bool
    Message   string
    Data      interface{}
    Errors    []ValidationError // Multiple errors supported
    TxnID     string
    Timestamp string
}

// Usage:
validationErrors := []ValidationError{}

if err := validator.Check(input); err != nil {
    validationErrors = append(validationErrors, ValidationError{
        Field:   "field_name",
        Message: "Why it failed",
        Code:    "error_code",
    })
}

if len(validationErrors) > 0 {
    return NewErrorResponse("Validation failed", validationErrors, txnID), nil
}
```

---

## 🎯 Key Constraints & Validation

### IMDb ID Validation
```go
const (
    IMDBIDPrefix    = "tt"
    IMDBIDMinLength = 9  // tt + 7 digits minimum
    IMDBIDMaxLength = 10 // tt + 8 digits maximum
)

func isValidIMDBID(imdbID string) bool {
    if !strings.HasPrefix(imdbID, IMDBIDPrefix) {
        return false
    }
    if len(imdbID) < IMDBIDMinLength || len(imdbID) > IMDBIDMaxLength {
        return false
    }
    digits := imdbID[2:]
    _, err := strconv.Atoi(digits)
    return err == nil
}
```

### Field Length Constraints
```go
const (
    TitleMaxLength       = 500
    DirectorMaxLength    = 200
    DescriptionMaxLength = 5000
    NotesMaxLength       = 1000
)
```

### Status Flow
```
pending_review ──[ApproveContentRequest]──> approved ──[in_catalog]──>
pending_review ──[RejectContentRequest]──> rejected
```

---

## 📊 CouchDB Query Examples

### Query 1: Get All Movies (Paginated)
```json
{
  "selector": {
    "doc_type": "Movie",
    "status": "approved"
  },
  "sort": ["release_year"],
  "limit": 20
}
```

### Query 2: Search by Title (Case-Insensitive)
```json
{
  "selector": {
    "doc_type": "Movie",
    "title": {
      "$regex": "(?i)inception"
    }
  }
}
```

### Query 3: Filter by Genre and Year
```json
{
  "selector": {
    "doc_type": "Movie",
    "genres": { "$in": ["Sci-Fi", "Thriller"] },
    "release_year": { "$gte": 2000 }
  }
}
```

### Query 4: Get Pending Requests
```json
{
  "selector": {
    "doc_type": "ContentRequest",
    "status": "pending_review"
  }
}
```

---

## 🎨 Adapting This Pattern for Other Chaincodes

### TVShow Chaincode (nested Episodes)
```go
type TVShow struct {
    IMDBID    string
    Title     string
    Seasons   []*Season
}

type Season struct {
    Number    int
    Episodes  []*Episode
}

type Episode struct {
    Number    int
    Title     string
    AirDate   string
    Duration  int
}

// Same 6-function pattern:
// 1. QueryAll() - Get all approved shows
// 2. SearchByTitle() - Search shows by title
// 3. SubmitContentRequest() - Submit new show
// 4. ApproveContentRequest() - Admin approve
// 5. GetRequestHistory() - Audit trail
// 6. GetShowByIMDBID() - Direct lookup
```

### Games Chaincode (multiplayer metadata)
```go
type Game struct {
    ID           string
    Title        string
    Platforms    []string // ["PC", "PS5", "Xbox"]
    Genres       []string
    Multiplayer  bool
    MaxPlayers   int
    ReleaseYear  int
}

// Same 6-function pattern
```

### Voting Chaincode (DAO proposals)
```go
type Proposal struct {
    ProposalID   string
    Title        string
    Description  string
    Status       string // "open" | "closed" | "passed" | "rejected"
    VotesFor     int
    VotesAgainst int
    VotesAbstain int
    TotalVotes   int
}

type Vote struct {
    ProposalID string
    Voter      string
    Choice     string // "for" | "against" | "abstain"
}

// 6-function pattern:
// 1. QueryAll() - Get all proposals
// 2. SearchByTitle() - Filter proposals
// 3. SubmitProposal() - Create new proposal
// 4. CastVote() - Vote on proposal
// 5. GetVoteHistory() - Audit trail
// 6. GetProposalByID() - Direct lookup
```

---

## 📈 Performance Considerations

1. **Indexing**: CouchDB indexes on commonly queried fields
2. **Pagination**: Always use pagination for large result sets
3. **Composite Keys**: Use format like `movie:tt1375666` for namespace separation
4. **Caching**: Client-side caching recommended for query results
5. **Versioning**: Optimistic locking prevents concurrent update conflicts

---

## ✅ Testing Pattern

1. **Unit Tests**: Validate business logic
2. **E2E Tests**: Test state transitions
3. **Mock Data**: Use consistent test data
4. **Error Cases**: Test validation and error paths
5. **Audit Trail**: Verify history tracking

---

**Ready to implement TVShow, Games, or Voting chaincodes using this pattern!**
