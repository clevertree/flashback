package main

import (
	"time"
)

// RequestStatus represents the lifecycle status of a content request
type RequestStatus string

const (
	StatusPendingReview RequestStatus = "pending_review"
	StatusApproved      RequestStatus = "approved"
	StatusRejected      RequestStatus = "rejected"
	StatusInProgress    RequestStatus = "in_progress"
)

// ContentRequest represents a user submission to add new movie content
// Primary Key: imdb_id (globally unique)
// Secondary Keys: request_id (unique per submission), submitter_id (for user history)
type ContentRequest struct {
	// Unique identifiers
	IMDB      string `json:"imdb_id"`    // Primary key: IMDb identifier (e.g., "tt1375666")
	RequestID string `json:"request_id"` // UUID: unique per request instance
	DocType   string `json:"doc_type"`   // For CouchDB queries: "ContentRequest"

	// Content information
	Title       string   `json:"title"`        // Movie title
	Director    string   `json:"director"`     // Director name (optional, empty string if not provided)
	ReleaseYear int      `json:"release_year"` // Release year (0 if not provided)
	Genres      []string `json:"genres"`       // Genre tags: ["Science Fiction", "Thriller", ...]
	Description string   `json:"description"`  // Plot summary

	// Request metadata
	SubmitterID string `json:"submitter_id"` // User identity that submitted
	Notes       string `json:"notes"`        // User's reason/notes for submission

	// Content distribution - supports multiple torrent sources/formats
	// Keys: "default" (primary source), or quality variants like "720p", "480p", "bluray", etc.
	// Example: {"default": "Qm...", "720p": "Qm...", "480p": "Qm...", "bluray": "Qm..."}
	TorrentHashes map[string]string `json:"torrent_hashes"`

	// Status tracking
	Status          RequestStatus `json:"status"`           // Current status in workflow
	SubmittedAt     string        `json:"submitted_at"`     // RFC3339 timestamp: when submitted
	ReviewedBy      string        `json:"reviewed_by"`      // Moderator identity (empty if not reviewed)
	ReviewedAt      string        `json:"reviewed_at"`      // RFC3339 timestamp (empty if not reviewed)
	RejectionReason string        `json:"rejection_reason"` // Why rejected (empty if not rejected)

	// Metadata
	Version int64 `json:"version"` // State version for optimistic locking
}

// Movie represents an approved movie entry in the catalog
// Primary Key: imdb_id (globally unique, same as ContentRequest)
type Movie struct {
	// Unique identifiers
	IMDB    string `json:"imdb_id"`  // Primary key: IMDb identifier
	MovieID string `json:"movie_id"` // UUID: unique movie instance ID
	DocType string `json:"doc_type"` // For CouchDB queries: "Movie"

	// Movie information (from approved ContentRequest)
	Title       string   `json:"title"`
	Director    string   `json:"director"`
	ReleaseYear int      `json:"release_year"`
	Genres      []string `json:"genres"`
	Description string   `json:"description"`

	// Content details - TorrentHashes supports multiple sources/formats
	// Keys: "default" (primary/full quality), or variants like "720p", "480p", "bluray" (alternate versions)
	// Example: {"default": "Qm...", "720p": "Qm...", "480p": "Qm...", "bluray": "Qm..."}
	TorrentHashes map[string]string `json:"torrent_hashes"` // Key-value map of torrent sources/variants
	FileSize      int64             `json:"file_size"`      // File size in bytes
	Duration      int               `json:"duration"`       // Duration in minutes (0 for metadata-only)

	// Approval tracking
	ApprovedBy  string `json:"approved_by"`  // Moderator identity that approved
	ApprovedAt  string `json:"approved_at"`  // RFC3339 timestamp: when approved
	RequestID   string `json:"request_id"`   // References the ContentRequest that was approved
	SubmitterID string `json:"submitter_id"` // Original submitter (preserved for attribution)

	// Metadata
	CreatedAt string `json:"created_at"` // RFC3339 timestamp: when created
	UpdatedAt string `json:"updated_at"` // RFC3339 timestamp: when last updated
	Version   int64  `json:"version"`    // State version for optimistic locking

	// Statistics
	Ratings       []int   `json:"ratings"`        // Individual 1-5 star ratings
	AverageRating float64 `json:"average_rating"` // Computed average
}

// QueryResultset represents paginated query results
type QueryResultset struct {
	Records            interface{} `json:"records"`
	RecordCount        int         `json:"record_count"`
	FetchSize          int         `json:"fetch_size"`
	Bookmark           string      `json:"bookmark"` // For pagination support
	QueryExecutionTime string      `json:"query_execution_time"`
}

// SearchFilter provides options for searching movies
type SearchFilter struct {
	Title       string   `json:"title"`        // Title substring search
	Director    string   `json:"director"`     // Director substring search
	ReleaseYear int      `json:"release_year"` // Exact year match
	Genres      []string `json:"genres"`       // Match any genre
	Limit       int      `json:"limit"`        // Max results (default: 20, max: 100)
	Offset      int      `json:"offset"`       // Pagination offset
	SortBy      string   `json:"sort_by"`      // "title", "release_year", "created_at"
}

// TransactionEvent represents an event emitted for chaincode operations
// Used for off-chain event subscriptions and analytics
type TransactionEvent struct {
	EventType string `json:"event_type"` // "ContentRequested", "ContentApproved", "ContentRejected"
	DocType   string `json:"doc_type"`   // "Movie" or "ContentRequest"
	IMDB      string `json:"imdb_id"`
	RequestID string `json:"request_id"`
	Actor     string `json:"actor"`     // User/Moderator performing action
	Timestamp string `json:"timestamp"` // RFC3339 timestamp
	Details   string `json:"details"`   // Additional context
	TxnID     string `json:"txn_id"`    // Transaction ID for audit trail
}

// ValidationError represents a validation failure with details
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"` // "required", "invalid_format", "duplicate", etc.
}

// OperationResponse represents the result of a chaincode operation
type OperationResponse struct {
	Success   bool              `json:"success"`
	Message   string            `json:"message"`
	Data      interface{}       `json:"data"` // The result (Movie, ContentRequest, etc.)
	Errors    []ValidationError `json:"errors"`
	TxnID     string            `json:"txn_id"`
	Timestamp string            `json:"timestamp"`
}

// Constants for validation
const (
	// IMDB ID validation
	IMDBIDPrefix    = "tt"
	IMDBIDMinLength = 9  // tt + 7 digits minimum
	IMDBIDMaxLength = 10 // tt + 8 digits maximum

	// Field length constraints
	TitleMaxLength       = 500
	DirectorMaxLength    = 200
	DescriptionMaxLength = 5000
	NotesMaxLength       = 1000

	// Pagination
	DefaultLimit = 20
	MaxLimit     = 100
	MinLimit     = 1

	// Sorting options
	SortByTitle    = "title"
	SortByYear     = "release_year"
	SortByCreated  = "created_at"
	SortByApproved = "approved_at"
	SortByRating   = "average_rating"
)

// Helper function to create a new ContentRequest
func NewContentRequest(
	imdbID, title, director string,
	releaseYear int,
	genres []string,
	description, submitterID, notes, torrentHash string,
) *ContentRequest {
	now := time.Now().UTC().Format(time.RFC3339)
	torrentHashes := make(map[string]string)
	if torrentHash != "" {
		torrentHashes["primary"] = torrentHash
	}
	return &ContentRequest{
		IMDB:      imdbID,
		RequestID: generateUUID(),
		DocType:   "ContentRequest",
		Title:     title,
		Director:  director,
		ReleaseYear: releaseYear,
		Genres:    genres,
		Description: description,
		SubmitterID: submitterID,
		Notes:     notes,
		TorrentHashes: torrentHashes,
		Status:    StatusPendingReview,
		SubmittedAt: now,
		Version:   1,
	}
}

// Helper function to create a new Movie from an approved ContentRequest
func NewMovieFromRequest(req *ContentRequest, approvedBy string) *Movie {
	now := time.Now().UTC().Format(time.RFC3339)
	return &Movie{
		IMDB:        req.IMDB,
		MovieID:     generateUUID(),
		DocType:     "Movie",
		Title:       req.Title,
		Director:    req.Director,
		ReleaseYear: req.ReleaseYear,
		Genres:      req.Genres,
		Description: req.Description,
		TorrentHashes: req.TorrentHashes,
		ApprovedBy:  approvedBy,
		ApprovedAt:  now,
		RequestID:   req.RequestID,
		SubmitterID: req.SubmitterID,
		CreatedAt:   now,
		UpdatedAt:   now,
		Version:     1,
		Ratings:     []int{},
		AverageRating: 0.0,
	}
}

// Helper function to create an operation response
func NewSuccessResponse(data interface{}, txnID string) *OperationResponse {
	return &OperationResponse{
		Success:   true,
		Message:   "Operation successful",
		Data:      data,
		Errors:    []ValidationError{},
		TxnID:     txnID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// Helper function to create an error response
func NewErrorResponse(message string, errors []ValidationError, txnID string) *OperationResponse {
	return &OperationResponse{
		Success:   false,
		Message:   message,
		Data:      nil,
		Errors:    errors,
		TxnID:     txnID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// Helper function to generate UUID (placeholder - will use a UUID library)
func generateUUID() string {
	// This will be implemented using google/uuid package
	return ""
}
