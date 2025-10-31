#!/bin/bash

# Fabric Network Setup Script
# Sets up local Hyperledger Fabric network for Flashback development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_VERSION="2.5.0"
CHANNEL_NAME="flashback"
CHAINCODE_NAME="flashback-entries"
CHAINCODE_VERSION="1.0"

echo "================================================"
echo "Flashback Fabric Network Setup"
echo "================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

print_info "Docker found: $(docker --version)"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_info "Docker Compose found: $(docker-compose --version)"

# Create necessary directories
print_info "Creating directory structure..."
mkdir -p "${SCRIPT_DIR}/crypto-config"
mkdir -p "${SCRIPT_DIR}/channel_artifacts"
mkdir -p "${SCRIPT_DIR}/ca_server"
mkdir -p "${SCRIPT_DIR}/peer_msp"
mkdir -p "${SCRIPT_DIR}/peer_tls"
mkdir -p "${SCRIPT_DIR}/orderer_msp"
mkdir -p "${SCRIPT_DIR}/orderer_tls"
mkdir -p "${SCRIPT_DIR}/cli_scripts"

# Generate crypto materials (simplified - in production use cryptogen)
print_info "Note: For production, use 'cryptogen' tool to generate crypto materials"
print_info "Placeholder directories created. Download Fabric binaries for full setup:"
print_info "  curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0"

# Start Fabric network
print_info "Starting Fabric network..."
cd "${SCRIPT_DIR}"
docker-compose up -d

# Wait for containers to be ready
print_info "Waiting for containers to be ready..."
sleep 5

# Check if all containers are running
if docker ps | grep -q "ca.org1.flashback.local"; then
    print_info "CA container is running"
else
    print_warn "CA container is not running"
fi

if docker ps | grep -q "orderer.flashback.local"; then
    print_info "Orderer container is running"
else
    print_warn "Orderer container is not running"
fi

if docker ps | grep -q "peer0.org1.flashback.local"; then
    print_info "Peer container is running"
else
    print_warn "Peer container is not running"
fi

if docker ps | grep -q "couchdb.org1.flashback.local"; then
    print_info "CouchDB container is running"
else
    print_warn "CouchDB container is not running"
fi

print_info "Fabric network setup completed!"
print_info ""
print_info "Network Status:"
docker-compose ps

print_info ""
print_info "Next steps:"
print_info "1. Enroll admin user: ./enroll-admin.sh"
print_info "2. Register application user: ./register-user.sh"
print_info "3. Create channel: ./create-channel.sh"
print_info "4. Deploy chaincode: ./deploy-chaincode.sh"
print_info ""
print_info "To stop the network: docker-compose down"
print_info "To view logs: docker-compose logs -f peer0.org1.flashback.local"
