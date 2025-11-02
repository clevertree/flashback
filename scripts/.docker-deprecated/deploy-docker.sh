#!/bin/bash
# Docker-based Kaleido Chaincode Deployment

PEER_ENDPOINT="u0inmt8fjp-u0z8yv2jc2-peer.us0-aws-ws.kaleido.io"
ORDERER_ENDPOINT="u0cr887p2s.u0inmt8fjp.kaleido.network:40050"
CHANNEL_NAME="default-channel"
NETWORK_ID="u0inmt8fjp"

# Create temporary directory for certs
mkdir -p /tmp/fabric-deploy/certs

# Run Fabric CLI in Docker
docker run -it --rm \
  -e CORE_PEER_TLS_ENABLED=true \
  -e CORE_PEER_ADDRESS="$PEER_ENDPOINT" \
  -e CORE_PEER_LOCALMSPID="Org1MSP" \
  -v /tmp/fabric-deploy:/workspace \
  hyperledger/fabric-tools:latest bash -c "
  
  # Install chaincodes
  peer lifecycle chaincode install /workspace/movie-chaincode
  peer lifecycle chaincode install /workspace/tvshow-chaincode
  peer lifecycle chaincode install /workspace/games-chaincode
  peer lifecycle chaincode install /workspace/voting-chaincode
  
  # Query installed
  peer lifecycle chaincode queryinstalled
"
