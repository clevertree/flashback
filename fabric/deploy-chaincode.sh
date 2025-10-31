#!/bin/bash

# Chaincode Deployment Script
# Deploys Flashback chaincode to Fabric network

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHANNEL_NAME=${1:-flashback}
CHAINCODE_PATH=${2:-"./chaincode"}

echo "================================================"
echo "Flashback Chaincode Deployment"
echo "================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to install and instantiate chaincode
deploy_chaincode() {
    local CHAINCODE_NAME=$1
    local CHAINCODE_DIR=$2
    local CHAINCODE_VERSION=${3:-1.0}

    print_info "Deploying chaincode: $CHAINCODE_NAME"

    # Package chaincode
    print_info "Packaging $CHAINCODE_NAME..."
    cd "$CHAINCODE_DIR"
    peer lifecycle chaincode package "${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz" \
        --path . \
        --lang golang \
        --label "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

    # Install on peer
    print_info "Installing $CHAINCODE_NAME on peer..."
    peer lifecycle chaincode install "${CHAINCODE_NAME}_${CHAINCODE_VERSION}.tar.gz"

    # Get package ID
    PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" | awk '{print $3}' | sed 's/,//')

    if [ -z "$PACKAGE_ID" ]; then
        print_error "Failed to get package ID for $CHAINCODE_NAME"
        return 1
    fi

    print_info "Package ID: $PACKAGE_ID"

    # Approve for organization
    print_info "Approving $CHAINCODE_NAME for organization..."
    peer lifecycle chaincode approveformyorg \
        --channelID "$CHANNEL_NAME" \
        --name "$CHAINCODE_NAME" \
        --version "$CHAINCODE_VERSION" \
        --package-id "$PACKAGE_ID" \
        --sequence 1

    print_info "Successfully deployed $CHAINCODE_NAME"
    return 0
}

# Check prerequisites
if ! command -v peer &> /dev/null; then
    print_error "peer CLI not found. Please set FABRIC_CFG_PATH and add peer to PATH"
    exit 1
fi

# Deploy all chaincodes
print_info "Deploying chaincodes to channel: $CHANNEL_NAME"

if [ ! -d "$CHAINCODE_PATH/entries" ]; then
    print_error "Chaincode directory not found: $CHAINCODE_PATH/entries"
    exit 1
fi

# Deploy entries chaincode
if deploy_chaincode "entries" "$CHAINCODE_PATH/entries" "1.0"; then
    print_info "Entries chaincode deployed successfully"
else
    print_error "Failed to deploy entries chaincode"
fi

# Deploy comments chaincode
if deploy_chaincode "comments" "$CHAINCODE_PATH/comments" "1.0"; then
    print_info "Comments chaincode deployed successfully"
else
    print_error "Failed to deploy comments chaincode"
fi

# Deploy ratings chaincode
if deploy_chaincode "ratings" "$CHAINCODE_PATH/ratings" "1.0"; then
    print_info "Ratings chaincode deployed successfully"
else
    print_error "Failed to deploy ratings chaincode"
fi

# Commit chaincodes to channel
print_info "Committing chaincodes..."
peer lifecycle chaincode commit \
    --channelID "$CHANNEL_NAME" \
    --name entries \
    --version 1.0 \
    --sequence 1

peer lifecycle chaincode commit \
    --channelID "$CHANNEL_NAME" \
    --name comments \
    --version 1.0 \
    --sequence 1

peer lifecycle chaincode commit \
    --channelID "$CHANNEL_NAME" \
    --name ratings \
    --version 1.0 \
    --sequence 1

print_info "All chaincodes deployed and committed successfully!"
print_info ""
print_info "Deployed chaincodes:"
peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME"
