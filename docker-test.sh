#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Testing Docker Container Connectivity${NC}"
echo "========================================"

# Function to check if port is open
check_port() {
    local host=$1
    local port=$2
    local timeout=10

    timeout $timeout bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null
    return $?
}

# Function to wait for service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready on $host:$port...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if check_port $host $port; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi

        echo -e "${YELLOW}   Attempt $attempt/$max_attempts - waiting...${NC}"
        sleep 2
        ((attempt++))
    done

    echo -e "${RED}❌ $service_name failed to start within timeout${NC}"
    return 1
}

# Start the services
echo -e "${BLUE}🚀 Starting services with Docker Compose...${NC}"
docker-compose up -d || {
    echo -e "${RED}❌ Failed to start services${NC}"
    exit 1
}

# Wait for services to be ready
wait_for_service localhost 8080 "Server" || exit 1
wait_for_service localhost 3000 "Client 1" || exit 1
wait_for_service localhost 3001 "Client 2" || exit 1

echo ""
echo -e "${GREEN}🎉 All services are running!${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo "=================="
docker-compose ps

echo ""
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo "=============="
echo "• Server logs: docker-compose logs server"
echo "• Client 1: http://localhost:3000"
echo "• Client 2: http://localhost:3001"
echo "• Server health: curl -f http://localhost:8080 (TCP server, may not respond to HTTP)"

echo ""
echo -e "${BLUE}🔍 Network Connectivity Test:${NC}"
echo "============================"

# Test internal network connectivity
echo -e "${YELLOW}Testing internal network connectivity...${NC}"
docker-compose exec client1 sh -c "nc -z server 8080" && {
    echo -e "${GREEN}✅ Client 1 can reach server${NC}"
} || {
    echo -e "${RED}❌ Client 1 cannot reach server${NC}"
}

docker-compose exec client2 sh -c "nc -z server 8080" && {
    echo -e "${GREEN}✅ Client 2 can reach server${NC}"
} || {
    echo -e "${RED}❌ Client 2 cannot reach server${NC}"
}

echo ""
echo -e "${BLUE}📝 To stop services:${NC}"
echo "docker-compose down"
echo ""
echo -e "${BLUE}📝 To view logs:${NC}"
echo "docker-compose logs -f"
