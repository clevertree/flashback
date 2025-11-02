#!/bin/bash

###############################################################################
# Kaleido Chaincode Deployment via Direct peer CLI Commands
# 
# This script deploys chaincodes directly to Kaleido Hyperledger Fabric
# using peer CLI commands (installed via Docker or locally)
#
# Prerequisites:
# - Fabric peer CLI v2.0+ installed or Docker available
# - .env.local with KALEIDO credentials configured
# - Chaincodes built in chaincode/{name}/ directories
#
# Usage: ./scripts/deploy-direct-cli.sh [--install-peer] [--docker]
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"

# Load environment variables
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: .env.local not found at $ENV_FILE${NC}"
    exit 1
fi

# Parse .env.local
export KALEIDO_PEER_ENDPOINT=$(grep "^KALEIDO_PEER_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_ORDERER_ENDPOINT=$(grep "^KALEIDO_ORDERER_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_ORGANIZATION=$(grep "^KALEIDO_ORGANIZATION=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_CHANNEL_NAME=$(grep "^KALEIDO_CHANNEL_NAME=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_ORDERER_MSP_ID=$(grep "^KALEIDO_ORDERER_MSP_ID=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_PEER_ID=$(grep "^KALEIDO_PEER_ID=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_NETWORK_ID=$(grep "^KALEIDO_NETWORK_ID=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_ORDERER_TLS_ENABLED=$(grep "^KALEIDO_ORDERER_TLS_ENABLED=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
export KALEIDO_PEER_TLS_ENABLED=$(grep "^KALEIDO_PEER_TLS_ENABLED=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')

# Array of chaincodes to deploy
CHAINCODES=("movie" "tvshow" "games" "voting")
CHAINCODE_VERSION="1.0.0"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 Kaleido Direct CLI Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Peer Endpoint: $KALEIDO_PEER_ENDPOINT"
echo "  Orderer Endpoint: $KALEIDO_ORDERER_ENDPOINT"
echo "  Organization: $KALEIDO_ORGANIZATION"
echo "  Channel: $KALEIDO_CHANNEL_NAME"
echo "  Chaincodes: ${CHAINCODES[*]}"
echo ""

# Check if peer CLI is available
check_peer_cli() {
    if ! command -v peer &> /dev/null; then
        echo -e "${YELLOW}⚠️  peer CLI not found in PATH${NC}"
        echo ""
        echo "To use this script, you need to install the Fabric peer CLI:"
        echo ""
        echo "  Option 1: Install locally (macOS with Homebrew):"
        echo "    brew tap hyperledger/fabric"
        echo "    brew install fabric-tools"
        echo ""
        echo "  Option 2: Use Docker:"
        echo "    docker run -it --rm hyperledger/fabric-tools:latest peer version"
        echo ""
        echo "  Option 3: Download from GitHub:"
        echo "    https://github.com/hyperledger/fabric/releases"
        echo ""
        return 1
    fi
    return 0
}

# Deploy chaincodes using peer CLI
deploy_with_peer_cli() {
    echo -e "${BLUE}📦 Deploying Chaincodes via peer CLI${NC}"
    echo ""

    for chaincode_name in "${CHAINCODES[@]}"; do
        echo -e "${GREEN}▶️  Processing: $chaincode_name${NC}"
        
        CHAINCODE_PATH="$PROJECT_ROOT/chaincode/$chaincode_name"
        BINARY_PATH="$CHAINCODE_PATH/${chaincode_name}-chaincode"

        # Verify binary exists
        if [ ! -f "$BINARY_PATH" ]; then
            echo -e "${RED}  ❌ Binary not found: $BINARY_PATH${NC}"
            continue
        fi

        echo -e "${YELLOW}  Installing $chaincode_name...${NC}"
        
        # Set peer CLI environment variables
        export CORE_PEER_TLS_ENABLED="$KALEIDO_PEER_TLS_ENABLED"
        export CORE_PEER_ADDRESS="$KALEIDO_PEER_ENDPOINT"
        export CORE_PEER_LOCALMSPID="$KALEIDO_ORGANIZATION"
        export CORE_PEER_MSPCONFIGPATH="$PROJECT_ROOT/fabric/wallet/$KALEIDO_PEER_ID"
        export ORDERER_TLS_ENABLED="$KALEIDO_ORDERER_TLS_ENABLED"
        export ORDERER_ADDRESS="$KALEIDO_ORDERER_ENDPOINT"

        # Install chaincode
        peer lifecycle chaincode install "$BINARY_PATH" \
            --channelID "$KALEIDO_CHANNEL_NAME" \
            --name "$chaincode_name" \
            --version "$CHAINCODE_VERSION" \
            --lang golang \
            || echo -e "${YELLOW}  ⚠️  Install may have encountered issues${NC}"

        echo -e "${GREEN}  ✓ Install command sent${NC}"
        echo ""
    done
}

# Show next steps
show_next_steps() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✨ Deployment commands executed${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo ""
    echo "1. Verify peer CLI installation:"
    echo "   ${YELLOW}peer version${NC}"
    echo ""
    echo "2. Check peer connectivity:"
    echo "   ${YELLOW}peer channel list -C $KALEIDO_CHANNEL_NAME${NC}"
    echo ""
    echo "3. List installed chaincodes:"
    echo "   ${YELLOW}peer lifecycle chaincode queryinstalled${NC}"
    echo ""
    echo "4. After approving chaincodes:"
    echo "   ${YELLOW}peer lifecycle chaincode approveformyorg ...${NC}"
    echo ""
    echo "5. Commit chaincodes:"
    echo "   ${YELLOW}peer lifecycle chaincode commit ...${NC}"
    echo ""
    echo "6. Test via REST Gateway:"
    echo "   ${YELLOW}npm run check:kaleido${NC}"
    echo ""
}

# Main execution
main() {
    if check_peer_cli; then
        deploy_with_peer_cli
    else
        echo -e "${YELLOW}ℹ️  Note: peer CLI not available locally${NC}"
        echo ""
        echo "Since Kaleido's Consortium API has permission restrictions,"
        echo "and the Kaleido Console is unreachable, you have these options:"
        echo ""
        echo "1. Install the Fabric peer CLI locally (recommended)"
        echo "2. Deploy manually via Docker container"
        echo "3. Contact Kaleido support to enable Consortium API access"
        echo ""
        return 1
    fi

    show_next_steps
}

main "$@"
