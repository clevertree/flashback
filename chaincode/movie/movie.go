package main

import (
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// MovieContract defines the chaincode functions for the movie channel
type MovieContract struct {
	contractapi.Contract
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Init initializes the chaincode
func (mc *MovieContract) Init(ctx contractapi.TransactionContextInterface) error {
	log.Println("Initializing Movie Chaincode")
	return nil
}

// ============================================================================
// CONTENT REQUEST OPERATIONS
// ============================================================================

// SubmitContentRequest creates a new content request for a movie
// Args: [imdbID, title, director, releaseYear, genres (JSON array), description, submitterID, notes]
// Returns: ContentRequest with generated requestID
func (mc *MovieContract) SubmitContentRequest(
	ctx contractapi.TransactionContextInterface,
	imdbID string,
	title string,
	director string,
	releaseYearStr string,
	genresJSON string,
	description string,
	submitterID string,
	notes string,
	torrentHash string,
) (*OperationResponse, error) {
	txnID := ctx.GetStub().GetTxID()
	log.Printf("[%s] SubmitContentRequest: IMDB ID=%s, Title=%s\n", txnID, imdbID, title)

	// Validate input
	validationErrors := []ValidationError{}

	// Validate IMDB ID
	if !isValidIMDBID(imdbID) {
		validationErrors = append(validationErrors, ValidationError{
			Field:   "imdb_id",
			Message: fmt.Sprintf("Invalid IMDb ID format. Expected format: tt[7-8 digits], got: %s", imdbID),
			Code:    "invalid_format",
		})
	}

	// Validate title
	if title == "" {
		validationErrors = append(validationErrors, ValidationError{
			Field:   "title",
			Message: "Title is required",
			Code:    "required",
		})
	} else if len(title) > TitleMaxLength {
		validationErrors = append(validationErrors, ValidationError{
			Field:   "title",
			Message: fmt.Sprintf("Title exceeds maximum length of %d characters", TitleMaxLength),
			Code:    "max_length",
		})
	}

	// Parse genres
	var genres []string
	if genresJSON != "" {
		err := json.Unmarshal([]byte(genresJSON), &genres)
		if err != nil {
			validationErrors = append(validationErrors, ValidationError{
				Field:   "genres",
				Message: "Genres must be a valid JSON array",
				Code:    "invalid_format",
			})
		}
	}

	// Return validation errors if any
	if len(validationErrors) > 0 {
		errorMsg := fmt.Sprintf("Validation failed for SubmitContentRequest: %d error(s)", len(validationErrors))
		return NewErrorResponse(errorMsg, validationErrors, txnID), nil
	}

	// Check for duplicate IMDb ID
	existingRequest, err := mc.getContentRequestByIMDBID(ctx, imdbID)
	if err != nil && err.Error() != "ContentRequest not found" {
		return NewErrorResponse(
			fmt.Sprintf("Error checking for duplicate: %s", err.Error()),
			[]ValidationError{},
			txnID,
		), nil
	}

	if existingRequest != nil {
		validationErrors = append(validationErrors, ValidationError{
			Field:   "imdb_id",
			Message: fmt.Sprintf("Movie with IMDb ID %s has already been submitted or approved", imdbID),
			Code:    "duplicate",
		})
		return NewErrorResponse(
			"IMDb ID already exists",
			validationErrors,
			txnID,
		), nil
	}

	// Create the content request
	releaseYear := 0
	if releaseYearStr != "" {
		_, _ = fmt.Sscanf(releaseYearStr, "%d", &releaseYear)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	requestID := uuid.New().String()

	contentRequest := &ContentRequest{
		IMDBID:      imdbID,
		RequestID:   requestID,
		DocType:     "ContentRequest",
		Title:       title,
		Director:    director,
		ReleaseYear: releaseYear,
		Genres:      genres,
		Description: description,
		SubmitterID: submitterID,
		Notes:       notes,
		TorrentHash: torrentHash,
		Status:      StatusPendingReview,
		SubmittedAt: now,
		Version:     1,
	}

	// Save to ledger
	contentRequestBytes, err := json.Marshal(contentRequest)
	if err != nil {
		return NewErrorResponse(
			fmt.Sprintf("Error marshaling ContentRequest: %s", err.Error()),
			[]ValidationError{},
			txnID,
		), nil
	}

	err = ctx.GetStub().PutState(buildContentRequestKey(imdbID), contentRequestBytes)
	if err != nil {
		return NewErrorResponse(
			fmt.Sprintf("Error writing to ledger: %s", err.Error()),
			[]ValidationError{},
			txnID,
		), nil
	}

	// Emit event
	eventPayload := map[string]interface{}{
		"imdb_id":    imdbID,
		"request_id": requestID,
		"title":      title,
		"submitter":  submitterID,
		"timestamp":  now,
	}
	eventPayloadBytes, _ := json.Marshal(eventPayload)
	ctx.GetStub().SetEvent("ContentRequested", eventPayloadBytes)

	log.Printf("[%s] Successfully submitted content request: %s\n", txnID, requestID)
	return NewSuccessResponse(contentRequest, txnID), nil
}

// ApproveContentRequest approves a content request and creates a movie entry
// Args: [imdbID, moderatorID]
// Returns: Updated ContentRequest and new Movie entry
func (mc *MovieContract) ApproveContentRequest(
	ctx contractapi.TransactionContextInterface,
	imdbID string,
	moderatorID string,
) (*OperationResponse, error) {
	txnID := ctx.GetStub().GetTxID()
	log.Printf("[%s] ApproveContentRequest: IMDB ID=%s, Moderator=%s\n", txnID, imdbID, moderatorID)

	// Get existing content request
	contentRequest, err := mc.getContentRequestByIMDBID(ctx, imdbID)
	if err != nil {
		return NewErrorResponse(
			fmt.Sprintf("ContentRequest not found for IMDB ID: %s", imdbID),
			[]ValidationError{},
			txnID,
		), nil
	}

	// Check if already approved
	if contentRequest.Status == StatusApproved {
		return NewErrorResponse(
			fmt.Sprintf("ContentRequest for IMDB ID %s is already approved", imdbID),
			[]ValidationError{},
			txnID,
		), nil
	}

	// Update content request status
	now := time.Now().UTC().Format(time.RFC3339)
	contentRequest.Status = StatusApproved
	contentRequest.ReviewedBy = moderatorID
	contentRequest.ReviewedAt = now
	contentRequest.Version++

	// Save updated content request
	contentRequestBytes, _ := json.Marshal(contentRequest)
	err = ctx.GetStub().PutState(buildContentRequestKey(imdbID), contentRequestBytes)
	if err != nil {
		return NewErrorResponse(
			fmt.Sprintf("Error updating ContentRequest: %s", err.Error()),
			[]ValidationError{},
			txnID,
		), nil
	}

	// Create movie entry
	movieID := uuid.New().String()
	movie := &Movie{
		IMDBID:        imdbID,
		MovieID:       movieID,
		DocType:       "Movie",
		Title:         contentRequest.Title,
		Director:      contentRequest.Director,
		ReleaseYear:   contentRequest.ReleaseYear,
		Genres:        contentRequest.Genres,
		Description:   contentRequest.Description,
		ApprovedBy:    moderatorID,
		ApprovedAt:    now,
		RequestID:     contentRequest.RequestID,
		SubmitterID:   contentRequest.SubmitterID,
		CreatedAt:     now,
		UpdatedAt:     now,
		Version:       1,
		Views:         0,
		Downloads:     0,
		Ratings:       []int{},
		AverageRating: 0.0,
	}

	// Save movie to ledger
	movieBytes, _ := json.Marshal(movie)
	err = ctx.GetStub().PutState(buildMovieKey(imdbID), movieBytes)
	if err != nil {
		return NewErrorResponse(
			fmt.Sprintf("Error creating Movie entry: %s", err.Error()),
			[]ValidationError{},
			txnID,
		), nil
	}

	// Emit event
	eventPayload := map[string]interface{}{
		"imdb_id":     imdbID,
		"movie_id":    movieID,
		"title":       movie.Title,
		"approved_by": moderatorID,
		"timestamp":   now,
	}
	eventPayloadBytes, _ := json.Marshal(eventPayload)
	ctx.GetStub().SetEvent("ContentApproved", eventPayloadBytes)

	result := map[string]interface{}{
		"content_request": contentRequest,
		"movie":           movie,
	}

	log.Printf("[%s] Successfully approved content request and created movie: %s\n", txnID, movieID)
	return NewSuccessResponse(result, txnID), nil
}

// RejectContentRequest rejects a content request
// Args: [imdbID, moderatorID, rejectionReason]
// Returns: Updated ContentRequest with rejected status
func (mc *MovieContract) RejectContentRequest(
	ctx contractapi.TransactionContextInterface,
	imdbID string,
	moderatorID string,
	rejectionReason string,
) (*OperationResponse, error) {
	txnID := ctx.GetStub().GetTxID()
	log.Printf("[%s] RejectContentRequest: IMDB ID=%s\n", txnID, imdbID)

	// Get existing content request
	contentRequest, err := mc.getContentRequestByIMDBID(ctx, imdbID)
	if err != nil {
		return NewErrorResponse(
			fmt.Sprintf("ContentRequest not found for IMDB ID: %s", imdbID),
			[]ValidationError{},
			txnID,
		), nil
	}

	// Update status
	now := time.Now().UTC().Format(time.RFC3339)
	contentRequest.Status = StatusRejected
	contentRequest.ReviewedBy = moderatorID
	contentRequest.ReviewedAt = now
	contentRequest.RejectionReason = rejectionReason
	contentRequest.Version++

	// Save to ledger
	contentRequestBytes, _ := json.Marshal(contentRequest)
	err = ctx.GetStub().PutState(buildContentRequestKey(imdbID), contentRequestBytes)
	if err != nil {
		return NewErrorResponse(
			fmt.Sprintf("Error updating ContentRequest: %s", err.Error()),
			[]ValidationError{},
			txnID,
		), nil
	}

	// Emit event
	eventPayload := map[string]interface{}{
		"imdb_id":     imdbID,
		"rejected_by": moderatorID,
		"reason":      rejectionReason,
		"timestamp":   now,
	}
	eventPayloadBytes, _ := json.Marshal(eventPayload)
	ctx.GetStub().SetEvent("ContentRejected", eventPayloadBytes)

	return NewSuccessResponse(contentRequest, txnID), nil
}

// ============================================================================
// MOVIE QUERY OPERATIONS
// ============================================================================

// QueryAll returns all approved movies in the channel
// Returns: []Movie with pagination support
func (mc *MovieContract) QueryAll(
	ctx contractapi.TransactionContextInterface,
) (interface{}, error) {
	txnID := ctx.GetStub().GetTxID()
	log.Printf("[%s] QueryAll\n", txnID)

	queryString := `{
		"selector": {
			"doc_type": "Movie",
			"status": {"$eq": "approved"}
		},
		"sort": [{"created_at": "desc"}]
	}`

	resultsIterator, _, err := ctx.GetStub().GetQueryResultWithPagination(queryString, int32(DefaultLimit), "")
	if err != nil {
		return nil, fmt.Errorf("error executing query: %s", err.Error())
	}
	defer resultsIterator.Close()

	var movies []*Movie
	for resultsIterator.HasNext() {
		result, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var movie Movie
		err = json.Unmarshal(result.Value, &movie)
		if err != nil {
			return nil, err
		}

		movies = append(movies, &movie)
	}

	log.Printf("[%s] QueryAll returned %d movies\n", txnID, len(movies))
	return movies, nil
}

// SearchByTitle searches for movies by title (case-insensitive substring match)
// Args: [titleQuery, limit]
// Returns: []Movie matching the search
func (mc *MovieContract) SearchByTitle(
	ctx contractapi.TransactionContextInterface,
	titleQuery string,
	limitStr string,
) (interface{}, error) {
	txnID := ctx.GetStub().GetTxID()
	log.Printf("[%s] SearchByTitle: query=%s\n", txnID, titleQuery)

	// Parse limit
	limit := DefaultLimit
	if limitStr != "" {
		_, _ = fmt.Sscanf(limitStr, "%d", &limit)
		if limit > MaxLimit {
			limit = MaxLimit
		}
		if limit < MinLimit {
			limit = MinLimit
		}
	}

	queryString := `{
		"selector": {
			"doc_type": "Movie"
		},
		"sort": [{"created_at": "desc"}]
	}`

	resultsIterator, _, err := ctx.GetStub().GetQueryResultWithPagination(queryString, int32(DefaultLimit), "")
	if err != nil {
		return nil, fmt.Errorf("error executing query: %s", err.Error())
	}
	defer resultsIterator.Close()

	var movies []*Movie
	count := 0

	for resultsIterator.HasNext() && count < limit {
		result, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var movie Movie
		err = json.Unmarshal(result.Value, &movie)
		if err != nil {
			return nil, err
		}

		// Case-insensitive substring match
		if strings.Contains(strings.ToLower(movie.Title), strings.ToLower(titleQuery)) {
			movies = append(movies, &movie)
			count++
		}
	}

	log.Printf("[%s] SearchByTitle found %d movies\n", txnID, len(movies))
	return movies, nil
}

// GetRequestHistory returns all versions of a content request
// Args: [imdbID]
// Returns: []ContentRequest in chronological order
func (mc *MovieContract) GetRequestHistory(
	ctx contractapi.TransactionContextInterface,
	imdbID string,
) (interface{}, error) {
	txnID := ctx.GetStub().GetTxID()
	log.Printf("[%s] GetRequestHistory: IMDB ID=%s\n", txnID, imdbID)

	historyIterator, err := ctx.GetStub().GetHistoryForKey(buildContentRequestKey(imdbID))
	if err != nil {
		return nil, fmt.Errorf("error getting history: %s", err.Error())
	}
	defer historyIterator.Close()

	var history []map[string]interface{}

	for historyIterator.HasNext() {
		modification, err := historyIterator.Next()
		if err != nil {
			return nil, err
		}

		var contentRequest ContentRequest
		err = json.Unmarshal(modification.Value, &contentRequest)
		if err != nil {
			return nil, err
		}

		entry := map[string]interface{}{
			"value":     contentRequest,
			"timestamp": modification.Timestamp,
			"is_delete": modification.IsDelete,
		}

		history = append(history, entry)
	}

	log.Printf("[%s] GetRequestHistory returned %d versions\n", txnID, len(history))
	return history, nil
}

// GetMovieByIMDBID retrieves a specific movie by IMDb ID
// Args: [imdbID]
// Returns: Movie or error if not found
func (mc *MovieContract) GetMovieByIMDBID(
	ctx contractapi.TransactionContextInterface,
	imdbID string,
) (*Movie, error) {
	txnID := ctx.GetStub().GetTxID()
	log.Printf("[%s] GetMovieByIMDBID: %s\n", txnID, imdbID)

	movieBytes, err := ctx.GetStub().GetState(buildMovieKey(imdbID))
	if err != nil {
		return nil, fmt.Errorf("error reading from ledger: %s", err.Error())
	}

	if movieBytes == nil {
		return nil, fmt.Errorf("movie not found for IMDB ID: %s", imdbID)
	}

	var movie Movie
	err = json.Unmarshal(movieBytes, &movie)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling movie: %s", err.Error())
	}

	return &movie, nil
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func (mc *MovieContract) getContentRequestByIMDBID(
	ctx contractapi.TransactionContextInterface,
	imdbID string,
) (*ContentRequest, error) {
	requestBytes, err := ctx.GetStub().GetState(buildContentRequestKey(imdbID))
	if err != nil {
		return nil, fmt.Errorf("error reading from ledger: %s", err.Error())
	}

	if requestBytes == nil {
		return nil, fmt.Errorf("ContentRequest not found")
	}

	var contentRequest ContentRequest
	err = json.Unmarshal(requestBytes, &contentRequest)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling ContentRequest: %s", err.Error())
	}

	return &contentRequest, nil
}

func buildContentRequestKey(imdbID string) string {
	return fmt.Sprintf("ContentRequest:%s", imdbID)
}

func buildMovieKey(imdbID string) string {
	return fmt.Sprintf("Movie:%s", imdbID)
}

func isValidIMDBID(imdbID string) bool {
	if len(imdbID) < IMDBIDMinLength || len(imdbID) > IMDBIDMaxLength {
		return false
	}

	if !strings.HasPrefix(imdbID, IMDBIDPrefix) {
		return false
	}

	// Rest should be digits
	pattern := regexp.MustCompile(`^tt\d{7,8}$`)
	return pattern.MatchString(imdbID)
}

// main function runs the chaincode server
func main() {
	chaincode, err := contractapi.NewChaincode(&MovieContract{})
	if err != nil {
		log.Panicf("Error creating chaincode: %s", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting chaincode: %s", err)
	}
}
