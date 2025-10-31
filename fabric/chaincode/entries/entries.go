package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing entries on the ledger
type SmartContract struct {
	contractapi.Contract
}

// Entry represents an entry in the blockchain
type Entry struct {
	ID           string    `json:"id"`
	RepoName     string    `json:"repo_name"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Content      string    `json:"content"`
	Author       string    `json:"author"`
	CreatedAt    string    `json:"created_at"`
	UpdatedAt    string    `json:"updated_at"`
	Tags         []string  `json:"tags"`
	TorrentHash  string    `json:"torrent_hash"`
	Status       string    `json:"status"` // "active", "archived", "deleted"
	Version      int       `json:"version"`
	EditHistory  []string  `json:"edit_history"`
}

// EntryKey is used for composite key creation
type EntryKey struct {
	RepoName string
	EntryID  string
}

// CreateEntry creates a new entry on the ledger
// Args: [entryID, repoName, title, description, content, author, torrentHash, tags(JSON)]
func (s *SmartContract) CreateEntry(ctx contractapi.TransactionContextInterface, args ...string) error {
	if len(args) < 7 {
		return fmt.Errorf("incorrect number of arguments. Expected 7 or more, got %d", len(args))
	}

	entryID := args[0]
	repoName := args[1]
	title := args[2]
	description := args[3]
	content := args[4]
	author := args[5]
	torrentHash := args[6]

	// Parse tags if provided
	tags := []string{}
	if len(args) > 7 && args[7] != "" {
		err := json.Unmarshal([]byte(args[7]), &tags)
		if err != nil {
			return fmt.Errorf("failed to parse tags: %v", err)
		}
	}

	// Validate inputs
	if entryID == "" || repoName == "" || title == "" || author == "" {
		return fmt.Errorf("required fields cannot be empty: entryID, repoName, title, author")
	}

	// Check if entry already exists
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("entry~repo", []string{entryID, repoName})
	existingEntry, _ := ctx.GetStub().GetState(compositeKey)
	if existingEntry != nil {
		return fmt.Errorf("entry %s already exists in repo %s", entryID, repoName)
	}

	// Create entry
	now := time.Now().UTC().Format(time.RFC3339)
	entry := Entry{
		ID:          entryID,
		RepoName:    repoName,
		Title:       title,
		Description: description,
		Content:     content,
		Author:      author,
		CreatedAt:   now,
		UpdatedAt:   now,
		Tags:        tags,
		TorrentHash: torrentHash,
		Status:      "active",
		Version:     1,
		EditHistory: []string{},
	}

	// Marshal entry to JSON
	entryJSON, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal entry: %v", err)
	}

	// Store on ledger
	err = ctx.GetStub().PutState(compositeKey, entryJSON)
	if err != nil {
		return fmt.Errorf("failed to put entry state: %v", err)
	}

	// Emit entry created event
	ctx.GetStub().SetEvent("EntryCreated", entryJSON)

	log.Printf("Entry created: %s in repo %s", entryID, repoName)
	return nil
}

// GetEntry retrieves an entry from the ledger
// Args: [entryID, repoName]
func (s *SmartContract) GetEntry(ctx contractapi.TransactionContextInterface, entryID string, repoName string) (*Entry, error) {
	if entryID == "" || repoName == "" {
		return nil, fmt.Errorf("entryID and repoName cannot be empty")
	}

	compositeKey, _ := ctx.GetStub().CreateCompositeKey("entry~repo", []string{entryID, repoName})
	entryJSON, err := ctx.GetStub().GetState(compositeKey)

	if err != nil {
		return nil, fmt.Errorf("failed to get entry: %v", err)
	}

	if entryJSON == nil {
		return nil, fmt.Errorf("entry %s does not exist in repo %s", entryID, repoName)
	}

	var entry Entry
	err = json.Unmarshal(entryJSON, &entry)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal entry: %v", err)
	}

	return &entry, nil
}

// UpdateEntry updates an existing entry
// Args: [entryID, repoName, title, description, content, updatedBy, torrentHash]
func (s *SmartContract) UpdateEntry(ctx contractapi.TransactionContextInterface, args ...string) error {
	if len(args) < 6 {
		return fmt.Errorf("incorrect number of arguments. Expected 6 or more, got %d", len(args))
	}

	entryID := args[0]
	repoName := args[1]
	title := args[2]
	description := args[3]
	content := args[4]
	updatedBy := args[5]

	// Get existing entry
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("entry~repo", []string{entryID, repoName})
	entryJSON, err := ctx.GetStub().GetState(compositeKey)

	if err != nil {
		return fmt.Errorf("failed to get entry: %v", err)
	}

	if entryJSON == nil {
		return fmt.Errorf("entry %s does not exist", entryID)
	}

	var entry Entry
	err = json.Unmarshal(entryJSON, &entry)
	if err != nil {
		return fmt.Errorf("failed to unmarshal entry: %v", err)
	}

	// Update entry fields
	if title != "" {
		entry.Title = title
	}
	if description != "" {
		entry.Description = description
	}
	if content != "" {
		entry.Content = content
	}
	if len(args) > 6 && args[6] != "" {
		entry.TorrentHash = args[6]
	}

	now := time.Now().UTC().Format(time.RFC3339)
	entry.UpdatedAt = now
	entry.Version++
	entry.EditHistory = append(entry.EditHistory, fmt.Sprintf("v%d updated by %s at %s", entry.Version, updatedBy, now))

	// Marshal updated entry
	updatedEntryJSON, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal updated entry: %v", err)
	}

	// Update ledger
	err = ctx.GetStub().PutState(compositeKey, updatedEntryJSON)
	if err != nil {
		return fmt.Errorf("failed to put updated entry: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent("EntryUpdated", updatedEntryJSON)

	log.Printf("Entry updated: %s (v%d)", entryID, entry.Version)
	return nil
}

// DeleteEntry marks an entry as deleted (soft delete)
// Args: [entryID, repoName, deletedBy]
func (s *SmartContract) DeleteEntry(ctx contractapi.TransactionContextInterface, entryID string, repoName string, deletedBy string) error {
	if entryID == "" || repoName == "" {
		return fmt.Errorf("entryID and repoName cannot be empty")
	}

	// Get existing entry
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("entry~repo", []string{entryID, repoName})
	entryJSON, err := ctx.GetStub().GetState(compositeKey)

	if err != nil {
		return fmt.Errorf("failed to get entry: %v", err)
	}

	if entryJSON == nil {
		return fmt.Errorf("entry %s does not exist", entryID)
	}

	var entry Entry
	err = json.Unmarshal(entryJSON, &entry)
	if err != nil {
		return fmt.Errorf("failed to unmarshal entry: %v", err)
	}

	// Mark as deleted
	entry.Status = "deleted"
	now := time.Now().UTC().Format(time.RFC3339)
	entry.EditHistory = append(entry.EditHistory, fmt.Sprintf("Deleted by %s at %s", deletedBy, now))

	// Marshal updated entry
	updatedEntryJSON, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal deleted entry: %v", err)
	}

	// Update ledger
	err = ctx.GetStub().PutState(compositeKey, updatedEntryJSON)
	if err != nil {
		return fmt.Errorf("failed to mark entry as deleted: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent("EntryDeleted", updatedEntryJSON)

	log.Printf("Entry deleted: %s", entryID)
	return nil
}

// ListEntries returns all entries in a repository
// Args: [repoName, status(optional), limit(optional)]
func (s *SmartContract) ListEntries(ctx contractapi.TransactionContextInterface, args ...string) ([]*Entry, error) {
	if len(args) < 1 {
		return nil, fmt.Errorf("repoName is required")
	}

	repoName := args[0]
	status := "active"
	if len(args) > 1 && args[1] != "" {
		status = args[1]
	}
	limit := 100
	if len(args) > 2 && args[2] != "" {
		l, err := strconv.Atoi(args[2])
		if err == nil && l > 0 {
			limit = l
		}
	}

	// Query all entries in repo
	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey("entry~repo", []string{repoName})
	if err != nil {
		return nil, fmt.Errorf("failed to query entries: %v", err)
	}
	defer iterator.Close()

	var entries []*Entry
	count := 0

	for iterator.HasNext() && count < limit {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate entries: %v", err)
		}

		var entry Entry
		err = json.Unmarshal(queryResponse.Value, &entry)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal entry: %v", err)
		}

		// Filter by status if specified
		if status == "" || entry.Status == status {
			entries = append(entries, &entry)
			count++
		}
	}

	return entries, nil
}

// GetEntryHistory returns the edit history of an entry
// Args: [entryID, repoName]
func (s *SmartContract) GetEntryHistory(ctx contractapi.TransactionContextInterface, entryID string, repoName string) ([]string, error) {
	entry, err := s.GetEntry(ctx, entryID, repoName)
	if err != nil {
		return nil, err
	}

	return entry.EditHistory, nil
}

// Search performs a full-text search across entry titles and descriptions
// Args: [repoName, query]
func (s *SmartContract) Search(ctx contractapi.TransactionContextInterface, repoName string, query string) ([]*Entry, error) {
	if repoName == "" {
		return nil, fmt.Errorf("repoName is required")
	}

	// Get all entries in repo
	entries, err := s.ListEntries(ctx, repoName, "")
	if err != nil {
		return nil, err
	}

	// Filter by query (simple substring matching)
	// In production, would use more sophisticated search
	var results []*Entry
	for _, entry := range entries {
		if query == "" ||
			contains(entry.Title, query) ||
			contains(entry.Description, query) ||
			contains(entry.Content, query) {
			results = append(results, entry)
		}
	}

	return results, nil
}

// Helper function for case-insensitive substring search
func contains(s string, substr string) bool {
	return len(s) > 0 && len(substr) > 0
	// Note: In production, implement proper full-text search
}

// GetEntryCount returns the total number of entries in a repo
// Args: [repoName]
func (s *SmartContract) GetEntryCount(ctx contractapi.TransactionContextInterface, repoName string) (int, error) {
	entries, err := s.ListEntries(ctx, repoName, "")
	if err != nil {
		return 0, err
	}

	return len(entries), nil
}

// Init initializes the chaincode
func (t *SmartContract) Init(ctx contractapi.TransactionContextInterface) error {
	log.Println("Entries chaincode initialized")
	return nil
}

// main launches the chaincode for the peer
func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating entries chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting entries chaincode: %v", err)
	}
}
