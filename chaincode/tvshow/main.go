package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// TVShowContract defines the chaincode for TV shows
type TVShowContract struct {
	contractapi.Contract
}

func (cc *TVShowContract) Init(ctx contractapi.TransactionContextInterface) error {
	log.Println("Initializing TV Show Chaincode")
	return nil
}

// Placeholder methods - to be implemented in next phase
func (cc *TVShowContract) QueryAll(ctx contractapi.TransactionContextInterface) (interface{}, error) {
	return []interface{}{}, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&TVShowContract{})
	if err != nil {
		log.Panicf("Error creating chaincode: %s", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting chaincode: %s", err)
	}
}
