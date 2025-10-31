package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing ratings
type SmartContract struct {
	contractapi.Contract
}

// Rating represents a rating given to an entry
type Rating struct {
	ID        string `json:"id"`
	EntryID   string `json:"entry_id"`
	RepoName  string `json:"repo_name"`
	Rater     string `json:"rater"`
	Rating    int    `json:"rating"` // 1-5 stars
	Review    string `json:"review"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	Status    string `json:"status"` // "active", "deleted"
}

// SubmitRating submits or updates a rating for an entry
// Args: [ratingID, entryID, repoName, rater, rating(1-5), review(optional)]
func (s *SmartContract) SubmitRating(ctx contractapi.TransactionContextInterface, args ...string) error {
	if len(args) < 5 {
		return fmt.Errorf("incorrect number of arguments. Expected 5 or more, got %d", len(args))
	}

	ratingID := args[0]
	entryID := args[1]
	repoName := args[2]
	rater := args[3]
	ratingStr := args[4]

	// Validate inputs
	if ratingID == "" || entryID == "" || repoName == "" || rater == "" {
		return fmt.Errorf("required fields cannot be empty")
	}

	// Parse and validate rating
	rating, err := strconv.Atoi(ratingStr)
	if err != nil || rating < 1 || rating > 5 {
		return fmt.Errorf("rating must be an integer between 1 and 5")
	}

	// Parse review if provided
	review := ""
	if len(args) > 5 && args[5] != "" {
		review = args[5]
	}

	// Check if rating already exists (update case)
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("rating~entry", []string{ratingID, entryID})
	existingRatingJSON, _ := ctx.GetStub().GetState(compositeKey)

	now := time.Now().UTC().Format(time.RFC3339)
	var ratingObj Rating

	if existingRatingJSON != nil {
		// Update existing rating
		err := json.Unmarshal(existingRatingJSON, &ratingObj)
		if err != nil {
			return fmt.Errorf("failed to unmarshal existing rating: %v", err)
		}

		ratingObj.Rating = rating
		ratingObj.Review = review
		ratingObj.UpdatedAt = now
		ratingObj.Status = "active"
	} else {
		// Create new rating
		ratingObj = Rating{
			ID:        ratingID,
			EntryID:   entryID,
			RepoName:  repoName,
			Rater:     rater,
			Rating:    rating,
			Review:    review,
			CreatedAt: now,
			UpdatedAt: now,
			Status:    "active",
		}
	}

	// Marshal rating to JSON
	ratingJSON, err := json.Marshal(ratingObj)
	if err != nil {
		return fmt.Errorf("failed to marshal rating: %v", err)
	}

	// Store rating
	err = ctx.GetStub().PutState(compositeKey, ratingJSON)
	if err != nil {
		return fmt.Errorf("failed to put rating state: %v", err)
	}

	// Emit event
	eventName := "RatingSubmitted"
	if existingRatingJSON != nil {
		eventName = "RatingUpdated"
	}
	ctx.GetStub().SetEvent(eventName, ratingJSON)

	log.Printf("Rating %s: %d stars for entry %s by %s", ratingID, rating, entryID, rater)
	return nil
}

// GetRating retrieves a rating
// Args: [ratingID, entryID]
func (s *SmartContract) GetRating(ctx contractapi.TransactionContextInterface, ratingID string, entryID string) (*Rating, error) {
	if ratingID == "" || entryID == "" {
		return nil, fmt.Errorf("ratingID and entryID are required")
	}

	compositeKey, _ := ctx.GetStub().CreateCompositeKey("rating~entry", []string{ratingID, entryID})
	ratingJSON, err := ctx.GetStub().GetState(compositeKey)

	if err != nil {
		return nil, fmt.Errorf("failed to get rating: %v", err)
	}

	if ratingJSON == nil {
		return nil, fmt.Errorf("rating %s not found", ratingID)
	}

	var rating Rating
	err = json.Unmarshal(ratingJSON, &rating)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal rating: %v", err)
	}

	return &rating, nil
}

// DeleteRating marks a rating as deleted
// Args: [ratingID, entryID]
func (s *SmartContract) DeleteRating(ctx contractapi.TransactionContextInterface, ratingID string, entryID string) error {
	// Get existing rating
	rating, err := s.GetRating(ctx, ratingID, entryID)
	if err != nil {
		return err
	}

	// Mark as deleted
	rating.Status = "deleted"
	rating.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Marshal updated rating
	compositeKey, _ := ctx.GetStub().CreateCompositeKey("rating~entry", []string{ratingID, entryID})
	updatedJSON, err := json.Marshal(rating)
	if err != nil {
		return fmt.Errorf("failed to marshal deleted rating: %v", err)
	}

	// Update ledger
	err = ctx.GetStub().PutState(compositeKey, updatedJSON)
	if err != nil {
		return fmt.Errorf("failed to delete rating: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent("RatingDeleted", updatedJSON)

	log.Printf("Rating deleted: %s", ratingID)
	return nil
}

// GetEntryRatings returns all ratings for an entry
// Args: [entryID]
func (s *SmartContract) GetEntryRatings(ctx contractapi.TransactionContextInterface, entryID string) ([]*Rating, error) {
	if entryID == "" {
		return nil, fmt.Errorf("entryID is required")
	}

	// Query ratings for this entry
	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey("rating~entry", []string{entryID})
	if err != nil {
		return nil, fmt.Errorf("failed to query ratings: %v", err)
	}
	defer iterator.Close()

	var ratings []*Rating

	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate ratings: %v", err)
		}

		var rating Rating
		err = json.Unmarshal(queryResponse.Value, &rating)
		if err != nil {
			continue // Skip malformed entries
		}

		// Only include active ratings
		if rating.Status == "active" {
			ratings = append(ratings, &rating)
		}
	}

	return ratings, nil
}

// GetAverageRating calculates average rating for an entry
// Args: [entryID]
func (s *SmartContract) GetAverageRating(ctx contractapi.TransactionContextInterface, entryID string) (float64, error) {
	ratings, err := s.GetEntryRatings(ctx, entryID)
	if err != nil {
		return 0, err
	}

	if len(ratings) == 0 {
		return 0, nil
	}

	totalRating := 0
	for _, rating := range ratings {
		totalRating += rating.Rating
	}

	return float64(totalRating) / float64(len(ratings)), nil
}

// GetRatingDistribution returns the distribution of ratings (1-5 stars count)
// Args: [entryID]
func (s *SmartContract) GetRatingDistribution(ctx contractapi.TransactionContextInterface, entryID string) (map[string]int, error) {
	ratings, err := s.GetEntryRatings(ctx, entryID)
	if err != nil {
		return nil, err
	}

	distribution := map[string]int{
		"1_star":  0,
		"2_stars": 0,
		"3_stars": 0,
		"4_stars": 0,
		"5_stars": 0,
	}

	for _, rating := range ratings {
		switch rating.Rating {
		case 1:
			distribution["1_star"]++
		case 2:
			distribution["2_stars"]++
		case 3:
			distribution["3_stars"]++
		case 4:
			distribution["4_stars"]++
		case 5:
			distribution["5_stars"]++
		}
	}

	return distribution, nil
}

// GetRaterRating returns a specific rater's rating for an entry
// Args: [entryID, rater]
func (s *SmartContract) GetRaterRating(ctx contractapi.TransactionContextInterface, entryID string, rater string) (*Rating, error) {
	if entryID == "" || rater == "" {
		return nil, fmt.Errorf("entryID and rater are required")
	}

	ratings, err := s.GetEntryRatings(ctx, entryID)
	if err != nil {
		return nil, err
	}

	for _, rating := range ratings {
		if rating.Rater == rater {
			return rating, nil
		}
	}

	return nil, fmt.Errorf("no rating found from %s for entry %s", rater, entryID)
}

// GetRatingCount returns the total number of ratings for an entry
// Args: [entryID]
func (s *SmartContract) GetRatingCount(ctx contractapi.TransactionContextInterface, entryID string) (int, error) {
	ratings, err := s.GetEntryRatings(ctx, entryID)
	if err != nil {
		return 0, err
	}

	return len(ratings), nil
}

// Init initializes the chaincode
func (t *SmartContract) Init(ctx contractapi.TransactionContextInterface) error {
	log.Println("Ratings chaincode initialized")
	return nil
}

// main launches the chaincode for the peer
func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating ratings chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting ratings chaincode: %v", err)
	}
}
