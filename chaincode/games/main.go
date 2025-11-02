package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// GameContract defines the chaincode for games
type GameContract struct {
	contractapi.Contract
}

func (cc *GameContract) Init(ctx contractapi.TransactionContextInterface) error {
	log.Println("Initializing Game Chaincode")
	return nil
}

// Placeholder methods - to be implemented in next phase
func (cc *GameContract) QueryAll(ctx contractapi.TransactionContextInterface) (interface{}, error) {
	return []interface{}{}, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&GameContract{})
	if err != nil {
		log.Panicf("Error creating chaincode: %s", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting chaincode: %s", err)
	}
}
