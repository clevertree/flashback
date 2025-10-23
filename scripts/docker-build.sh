#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Building Docker Images${NC}"
echo "=========================="

# Build server image
echo -e "${YELLOW}📦 Building server image...${NC}"
cd server || exit
docker build -t flashback-server:latest . || {
    echo -e "${RED}❌ Failed to build server image${NC}"
    exit 1
}
cd ..

# Build client image
echo -e "${YELLOW}📦 Building client image...${NC}"
cd client || exit
docker build -t flashback-client:latest . || {
    echo -e "${RED}❌ Failed to build client image${NC}"
    exit 1
}
cd ..

echo -e "${GREEN}✅ Docker images built successfully!${NC}"
echo ""
echo "Available images:"
docker images | grep -E "(flashback-server|flashback-client)"
