package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing comments
type SmartContract struct {
	contractapi.Contract
}

// Comment represents a comment on an entry
type Comment struct {
	ID          string    `json:"id"`
	EntryID     string    `json:"entry_id"`
	RepoName    string    `json:"repo_name"`
	Content     string    `json:"content"`
	Author      string    `json:"author"`
	Rating      int       `json:"rating"` // 1-5 stars
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
	Status      string    `json:"status"` // "active", "deleted", "flagged"
	EditCount   int       `json:"edit_count"`
	ThreadID    string    `json:"thread_id"` // Parent comment ID for threading
	Replies     []string  `json:"replies"`   // Child comment IDs
}

// AddComment adds a new comment to an entry
// Args: [commentID, entryID, repoName, content, author, rating(1-5), threadID(optional)]
func (s *SmartContract) AddComment(ctx contractapi.TransactionContextInterface, args ...string) error {
	if len(args) < 6 {
		return fmt.Errorf("incorrect number of arguments. Expected 6 or more, got %d", len(args))
	}

	commentID := args[0]
	entryID := args[1]
	repoName := args[2]
	content := args[3]
	author := args[4]
	ratingStr := args[5]

	// Validate inputs
	if commentID == "" || entryID == "" || repoName == "" || author == "" {
		return fmt.Errorf("required fields cannot be empty")
	}

	if content == "" {
		return fmt.Errorf("comment content cannot be empty")
	}

	// Parse and validate rating
	rating, err := strconv.Atoi(ratingStr)
	if err != nil || rating < 0 || rating > 5 {
		rating = 0 // Default to no rating
	}

	// Parse thread ID if provided
	threadID := ""
	if len(args) > 6 && args[6] != "" {
		threadID = args[6]
	}

	// Check if comment already exists
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("comment~entry", []string{commentID, entryID})
	existingComment, _ := ctx.GetStub().GetState(compositeKey)
	if existingComment != nil {
		return fmt.Errorf("comment %s already exists", commentID)
	}

	// Create comment
	now := time.Now().UTC().Format(time.RFC3339)
	comment := Comment{
		ID:        commentID,
		EntryID:   entryID,
		RepoName:  repoName,
		Content:   content,
		Author:    author,
		Rating:    rating,
		CreatedAt: now,
		UpdatedAt: now,
		Status:    "active",
		EditCount: 0,
		ThreadID:  threadID,
		Replies:   []string{},
	}

	// Marshal comment to JSON
	commentJSON, err := json.Marshal(comment)
	if err != nil {
		return fmt.Errorf("failed to marshal comment: %v", err)
	}

	// Store comment
	err = ctx.GetStub().PutState(compositeKey, commentJSON)
	if err != nil {
		return fmt.Errorf("failed to put comment state: %v", err)
	}

	// If this is a reply, add to parent's replies list
	if threadID != "" {
		parentKey, _ := ctx.GetStub().CreateCompositeKey("comment~entry", []string{threadID, entryID})
		parentJSON, err := ctx.GetStub().GetState(parentKey)
		if err == nil && parentJSON != nil {
			var parent Comment
			if err := json.Unmarshal(parentJSON, &parent); err == nil {
				parent.Replies = append(parent.Replies, commentID)
				if updatedJSON, err := json.Marshal(parent); err == nil {
					ctx.GetStub().PutState(parentKey, updatedJSON)
				}
			}
		}
	}

	// Emit event
	ctx.GetStub().SetEvent("CommentAdded", commentJSON)

	log.Printf("Comment added: %s on entry %s", commentID, entryID)
	return nil
}

// GetComment retrieves a comment
// Args: [commentID, entryID]
func (s *SmartContract) GetComment(ctx contractapi.TransactionContextInterface, commentID string, entryID string) (*Comment, error) {
	if commentID == "" || entryID == "" {
		return nil, fmt.Errorf("commentID and entryID are required")
	}

	compositeKey, _ := ctx.GetStub().CreateCompositeKey("comment~entry", []string{commentID, entryID})
	commentJSON, err := ctx.GetStub().GetState(compositeKey)

	if err != nil {
		return nil, fmt.Errorf("failed to get comment: %v", err)
	}

	if commentJSON == nil {
		return nil, fmt.Errorf("comment %s not found", commentID)
	}

	var comment Comment
	err = json.Unmarshal(commentJSON, &comment)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal comment: %v", err)
	}

	return &comment, nil
}

// UpdateComment updates an existing comment
// Args: [commentID, entryID, newContent, updatedBy]
func (s *SmartContract) UpdateComment(ctx contractapi.TransactionContextInterface, commentID string, entryID string, newContent string, updatedBy string) error {
	if commentID == "" || entryID == "" || newContent == "" {
		return fmt.Errorf("commentID, entryID, and newContent are required")
	}

	// Get existing comment
	comment, err := s.GetComment(ctx, commentID, entryID)
	if err != nil {
		return err
	}

	// Update content
	comment.Content = newContent
	comment.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	comment.EditCount++

	// Marshal updated comment
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("comment~entry", []string{commentID, entryID})
	updatedJSON, err := json.Marshal(comment)
	if err != nil {
		return fmt.Errorf("failed to marshal updated comment: %v", err)
	}

	// Update ledger
	err = ctx.GetStub().PutState(compositeKey, updatedJSON)
	if err != nil {
		return fmt.Errorf("failed to update comment: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent("CommentUpdated", updatedJSON)

	log.Printf("Comment updated: %s (edit #%d)", commentID, comment.EditCount)
	return nil
}

// DeleteComment marks a comment as deleted
// Args: [commentID, entryID, deletedBy]
func (s *SmartContract) DeleteComment(ctx contractapi.TransactionContextInterface, commentID string, entryID string, deletedBy string) error {
	// Get existing comment
	comment, err := s.GetComment(ctx, commentID, entryID)
	if err != nil {
		return err
	}

	// Mark as deleted
	comment.Status = "deleted"
	comment.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Marshal updated comment
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("comment~entry", []string{commentID, entryID})
	updatedJSON, err := json.Marshal(comment)
	if err != nil {
		return fmt.Errorf("failed to marshal deleted comment: %v", err)
	}

	// Update ledger
	err = ctx.GetStub().PutState(compositeKey, updatedJSON)
	if err != nil {
		return fmt.Errorf("failed to delete comment: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent("CommentDeleted", updatedJSON)

	log.Printf("Comment deleted: %s", commentID)
	return nil
}

// GetEntryComments returns all comments on an entry
// Args: [entryID, includeDeleted(true/false)]
func (s *SmartContract) GetEntryComments(ctx contractapi.TransactionContextInterface, entryID string, includeDeletedStr string) ([]*Comment, error) {
	if entryID == "" {
		return nil, fmt.Errorf("entryID is required")
	}

	includeDeleted := false
	if includeDeletedStr == "true" {
		includeDeleted = true
	}

	// Query comments for this entry
	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey("comment~entry", []string{entryID})
	if err != nil {
		return nil, fmt.Errorf("failed to query comments: %v", err)
	}
	defer iterator.Close()

	var comments []*Comment

	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate comments: %v", err)
		}

		var comment Comment
		err = json.Unmarshal(queryResponse.Value, &comment)
		if err != nil {
			continue // Skip malformed entries
		}

		// Filter deleted comments unless requested
		if comment.Status == "deleted" && !includeDeleted {
			continue
		}

		comments = append(comments, &comment)
	}

	return comments, nil
}

// GetThreadReplies returns all replies to a comment
// Args: [threadID, entryID]
func (s *SmartContract) GetThreadReplies(ctx contractapi.TransactionContextInterface, threadID string, entryID string) ([]*Comment, error) {
	// Get parent comment
	parent, err := s.GetComment(ctx, threadID, entryID)
	if err != nil {
		return nil, err
	}

	var replies []*Comment

	// Get each reply comment
	for _, replyID := range parent.Replies {
		reply, err := s.GetComment(ctx, replyID, entryID)
		if err == nil && reply.Status != "deleted" {
			replies = append(replies, reply)
		}
	}

	return replies, nil
}

// GetAverageRating calculates average rating for an entry
// Args: [entryID]
func (s *SmartContract) GetAverageRating(ctx contractapi.TransactionContextInterface, entryID string) (float64, error) {
	comments, err := s.GetEntryComments(ctx, entryID, "false")
	if err != nil {
		return 0, err
	}

	if len(comments) == 0 {
		return 0, nil
	}

	totalRating := 0
	ratingCount := 0

	for _, comment := range comments {
		if comment.Rating > 0 {
			totalRating += comment.Rating
			ratingCount++
		}
	}

	if ratingCount == 0 {
		return 0, nil
	}

	return float64(totalRating) / float64(ratingCount), nil
}

// Init initializes the chaincode
func (t *SmartContract) Init(ctx contractapi.TransactionContextInterface) error {
	log.Println("Comments chaincode initialized")
	return nil
}

// main launches the chaincode for the peer
func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating comments chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting comments chaincode: %v", err)
	}
}
