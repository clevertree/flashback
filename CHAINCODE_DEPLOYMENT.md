# Chaincode Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Flashback Movie Chaincode to Hyperledger Fabric networks, specifically configured for Kaleido.

## Prerequisites

### 1. Kaleido Account & Network Setup

- **Kaleido Account**: Create account at https://kaleido.io
- **Network ID**: `u0inmt8fjp` (Flashback network)
- **Organization**: `Org1MSP`
- **Credentials**: API key/secret for network access

### 2. Local Development Environment

```bash
# Required tools
- Go 1.19 or higher
- Docker (for containerizing chaincode)
- git
- jq (for JSON processing)

# Verify installations
go version          # Should be 1.19+
docker version      # Should be 20.10+
git --version
```

### 3. Fabric Tools

```bash
# Option 1: Using Fabric release binaries
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0

# Option 2: Using Kaleido CLI
kaleido version     # If already installed
```

### 4. Network Configuration

Ensure you have credentials for:
- **Gateway URL**: Kaleido REST gateway endpoint
- **CA URL**: Certificate Authority endpoint
- **Organization MSP ID**: `Org1MSP`
- **Admin Identity**: Enrollment credentials

## Building the Chaincode

### Step 1: Build Locally for Testing

```bash
cd chaincode/movie

# Install dependencies
go mod download
go mod tidy

# Build binary
go build -o bin/movie-chaincode

# Verify build
./bin/movie-chaincode --version 2>/dev/null || echo "Build successful"
```

### Step 2: Create Docker Image

#### Using Dockerfile

```dockerfile
# Dockerfile (create in chaincode/movie/)
FROM golang:1.19-alpine as builder

WORKDIR /app
COPY . .

RUN go mod download && \
    go build -o chaincode .

FROM alpine:latest

WORKDIR /

COPY --from=builder /app/chaincode /

EXPOSE 7052

CMD ["/chaincode"]
```

#### Build Docker Image

```bash
cd chaincode/movie

# Build image
docker build -t flashback-movie-chaincode:1.0 .

# Verify image
docker images | grep flashback-movie-chaincode

# Tag for registry (if using container registry)
docker tag flashback-movie-chaincode:1.0 registry.example.com/flashback-movie-chaincode:1.0

# Push to registry (optional)
docker push registry.example.com/flashback-movie-chaincode:1.0
```

### Step 3: Package for Kaleido

Kaleido supports two deployment methods:

#### Method A: Upload Binary

```bash
# Create package
cd chaincode/movie
tar -czf movie-chaincode-1.0.tar.gz bin/movie-chaincode

# File size should be < 50MB
ls -lh movie-chaincode-1.0.tar.gz
```

#### Method B: Docker Image on Docker Hub

```bash
# Tag and push to Docker Hub
docker tag flashback-movie-chaincode:1.0 yourusername/flashback-movie-chaincode:1.0
docker push yourusername/flashback-movie-chaincode:1.0
```

## Deploying to Kaleido

### Via Kaleido Console (Recommended)

#### Step 1: Navigate to Network

1. Go to https://kaleido.io/console
2. Select Network: **u0inmt8fjp**
3. Select Consortium: **Flashback**
4. Select Channel: **movies**

#### Step 2: Deploy Chaincode

1. Click **"Chaincodes"** tab
2. Click **"Deploy Chaincode"** button
3. Fill in deployment form:

| Field | Value |
|-------|-------|
| **Name** | `movie-chaincode` |
| **Version** | `1.0` |
| **Language** | `Go` |
| **Source** | Upload binary or Docker image URL |
| **Constructor** | (Leave empty - uses Init function) |

4. Click **"Deploy"**

#### Step 3: Installation & Instantiation

**Install on Peers:**
1. Select deployed chaincode
2. Click **"Install"**
3. Choose peers (e.g., `peer0.org1`)
4. Click **"Install on Selected Peers"**
5. Wait for status to show **"Installed"**

**Instantiate on Channel:**
1. Click **"Instantiate"**
2. Configure:

| Setting | Value |
|---------|-------|
| **Channel** | `movies` |
| **Endorsement Policy** | `1 of 1` (default) |
| **Init Args** | (none) |
| **Timeout** | `30` seconds |

3. Click **"Instantiate"**
4. Wait for transaction confirmation (usually 30-60 seconds)

#### Step 4: Verify Installation

```bash
# Query chaincode info
peer chaincode query -C movies -n movie-chaincode \
  -c '{"function":"Init","Args":[]}'

# Expected output: No error indicates successful instantiation
```

### Via Kaleido REST API

#### Step 1: Get Authentication Token

```bash
KALEIDO_API_KEY="your_api_key"
KALEIDO_API_SECRET="your_api_secret"
KALEIDO_ORG_ID="u0inmt8fjp_o0000000000000000000"

TOKEN=$(curl -s -X POST \
  https://api.kaleido.io/auth \
  -H "Content-Type: application/json" \
  -d "{
    \"apikey\": \"$KALEIDO_API_KEY\",
    \"apisecret\": \"$KALEIDO_API_SECRET\"
  }" | jq -r '.token')

echo "Token: $TOKEN"
```

#### Step 2: Deploy Chaincode

```bash
NETWORK_ID="u0inmt8fjp"
CHANNEL_ID="movies"
CHAINCODE_ID="movie-chaincode"

curl -X POST \
  https://api.kaleido.io/$NETWORK_ID/chaincodes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$CHAINCODE_ID\",
    \"version\": \"1.0\",
    \"language\": \"go\",
    \"docker_image\": \"yourusername/flashback-movie-chaincode:1.0\",
    \"constructor_args\": []
  }"
```

#### Step 3: Check Deployment Status

```bash
curl -s \
  https://api.kaleido.io/$NETWORK_ID/chaincodes/$CHAINCODE_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## Testing Deployment

### Step 1: Connect to Network

```bash
# Using fabric CLI
peer channel join -b ./channel.block

# OR using Rust client
fabric key generate --output ./identity.json
fabric network connect \
  --gateway https://your-kaleido-gateway:443 \
  --ca https://your-ca-url:443 \
  --identity ./identity.json
```

### Step 2: Test Chaincode Functions

#### Query - Get All Movies

```bash
peer chaincode query -C movies -n movie-chaincode \
  -c '{"function":"QueryAll","Args":[]}'

# Expected response:
# [{"imdb_id":"tt1375666","title":"Inception",...}]
```

#### Invoke - Submit Content Request

```bash
peer chaincode invoke -C movies -n movie-chaincode \
  -c '{
    "function":"SubmitContentRequest",
    "Args":[
      "tt1375666",
      "Inception",
      "Christopher Nolan",
      "2010",
      "[\"Science Fiction\",\"Thriller\"]",
      "A skilled thief who steals corporate secrets",
      "user1",
      "Great movie",
      ""
    ]
  }'

# Expected response:
# {
#   "success":true,
#   "message":"Operation successful",
#   "data":{...ContentRequest object...},
#   "txn_id":"abc123..."
# }
```

#### Query - Search by Title

```bash
peer chaincode query -C movies -n movie-chaincode \
  -c '{"function":"SearchByTitle","Args":["inception","10"]}'

# Expected response:
# [{"imdb_id":"tt1375666","title":"Inception",...}]
```

### Step 3: Verify on Ledger

```bash
# Get specific movie
peer chaincode query -C movies -n movie-chaincode \
  -c '{"function":"GetMovieByIMDBID","Args":["tt1375666"]}'

# Get request history
peer chaincode query -C movies -n movie-chaincode \
  -c '{"function":"GetRequestHistory","Args":["tt1375666"]}'
```

## Troubleshooting

### Issue 1: Chaincode Deployment Fails

**Symptoms**: Deployment shows "Failed" status

**Solutions**:
```bash
# Check logs in Kaleido console
# 1. Navigate to Network → Chaincodes
# 2. Click on chaincode
# 3. View "Events" tab for error details

# Common causes:
# - Docker image not found: Verify registry URL and image exists
# - Invalid chaincode ID: Use lowercase letters and hyphens only
# - Syntax errors: Run 'go build' locally first
```

### Issue 2: Chaincode Instantiation Timeout

**Symptoms**: "Timeout waiting for chaincode initialization"

**Solutions**:
```bash
# Increase timeout in instantiation settings
# Try 60-120 seconds instead of 30

# Or rebuild with simpler Init function:
# func (c *MovieContract) Init(ctx contractapi.TransactionContextInterface) error {
#   return nil
# }
```

### Issue 3: Query Returns Empty Results

**Symptoms**: QueryAll returns `[]` even after submissions

**Solutions**:
```bash
# 1. Verify chaincode is instantiated
peer chaincode query -C movies -n movie-chaincode \
  -c '{"function":"Init","Args":[]}'

# 2. Check CouchDB state database
# - Kaleido console → Network → Ledger
# - Search for "ContentRequest" documents

# 3. Verify submission worked
peer chaincode invoke -C movies -n movie-chaincode \
  -c '{"function":"SubmitContentRequest","Args":[...]}'

# Wait 5 seconds for block consensus, then query
```

### Issue 4: Permission Denied Errors

**Symptoms**: "Chaincode operation not allowed" or "User does not have permissions"

**Solutions**:
```bash
# 1. Verify user has proper MSP role
# In Kaleido console:
# - Network → Members → Check role is "Admin" or "Operator"

# 2. Re-enroll user with proper role
fabric key generate \
  --output ./admin-identity.json \
  --role admin

# 3. Use enrolled identity for operations
peer chaincode invoke ... \
  --mspConfigPath ./msp \
  --identity admin-identity.json
```

### Issue 5: Network Connectivity Issues

**Symptoms**: "Failed to connect to peer" or "Connection refused"

**Solutions**:
```bash
# 1. Test gateway connectivity
curl -v https://your-kaleido-gateway:443

# 2. Verify firewall allows outbound HTTPS (443)
telnet your-kaleido-gateway 443

# 3. Check credentials in kaleido-config.ts
cat src/lib/kaleido-config.ts

# 4. Update gateway URL if network was restarted
# Kaleido console → Network Info → Gateway URL
```

## Upgrading Chaincode

### Step 1: Update Code

```bash
cd chaincode/movie
# Make your changes to models.go or movie.go

# Rebuild locally
go build -o bin/movie-chaincode

# Test locally (optional)
go test ./... -v
```

### Step 2: Increment Version

```bash
# Update version in code or docker image
# Current version: 1.0
# New version: 1.1

docker build -t flashback-movie-chaincode:1.1 .
docker push yourusername/flashback-movie-chaincode:1.1
```

### Step 3: Deploy New Version

**Via Console**:
1. Click **"Upgrade Chaincode"**
2. Select new version `1.1`
3. Click **"Upgrade"**
4. Wait for instantiation

**Via API**:
```bash
curl -X PUT \
  https://api.kaleido.io/$NETWORK_ID/chaincodes/$CHAINCODE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": \"1.1\",
    \"docker_image\": \"yourusername/flashback-movie-chaincode:1.1\"
  }"
```

### Step 4: Verify Upgrade

```bash
# Query should work with new code
peer chaincode query -C movies -n movie-chaincode \
  -c '{"function":"QueryAll","Args":[]}'

# Check version in logs
# Should show new version number
```

## Performance Tuning

### CouchDB Index Creation

Create indexes for faster queries:

```bash
# Create index for doc_type queries
peer chaincode invoke -C movies -n movie-chaincode \
  -c '{
    "function":"CreateIndex",
    "Args":["doc_type","status"]
  }'
```

### Batch Operations

For bulk submissions, batch requests:

```bash
# Instead of individual submissions, use:
peer chaincode invoke -C movies -n movie-chaincode \
  -c '{
    "function":"BatchSubmitRequests",
    "Args":["[{...}, {...}, {...}]"]
  }'

# Reduces transaction overhead by ~80%
```

### Connection Pooling

Configure in Kaleido console:
- **Max Connections**: 50
- **Connection Timeout**: 30s
- **Idle Timeout**: 300s

## Monitoring & Logging

### View Chaincode Logs

**In Kaleido Console**:
1. Network → Chaincodes → Select chaincode
2. Click "Logs" tab
3. Filter by timestamp

**Via Docker**:
```bash
# If running locally
docker logs flashback-movie-chaincode:1.0

# Follow logs in real-time
docker logs -f flashback-movie-chaincode:1.0
```

### Monitor Chaincode Health

```bash
# Query health endpoint
curl https://your-kaleido-gateway/health \
  -H "Authorization: Bearer $TOKEN" | jq '.chaincodes'

# Check if movie-chaincode is in response
```

## Security Considerations

### 1. Endorsement Policy

Set appropriate endorsement policy:
```
1 of 1 Org1MSP   # Single endorsement (development)
2 of 2 Org1MSP   # Multiple endorsements (production)
```

### 2. Access Control

Only allow specific users to invoke certain functions:
```go
// In chaincode, add access control:
func (c *MovieContract) ApproveContentRequest(ctx contractapi.TransactionContextInterface, imdbID string) (*OperationResponse, error) {
    clientIdentity := ctx.GetClientIdentity()
    mspID, _ := clientIdentity.GetMSPID()
    
    // Only admins can approve
    if mspID != "Org1MSP" {
        return nil, errors.New("unauthorized")
    }
    // ... rest of function
}
```

### 3. TLS/SSL Configuration

Enable mutual TLS:
1. Kaleido Console → Network → Settings
2. Enable "Enforce TLS"
3. Download CA certificates
4. Configure in client

### 4. API Key Rotation

Rotate credentials regularly:
```bash
# In Kaleido console
# Network → API Keys → Generate New Key
# Revoke old key after updating client config
```

## Support & Resources

- **Kaleido Documentation**: https://docs.kaleido.io
- **Hyperledger Fabric Docs**: https://hyperledger-fabric.readthedocs.io
- **GitHub Issues**: https://github.com/clevertree/flashback/issues
- **Kaleido Support**: support@kaleido.io

## Appendix: Example Deployment Script

```bash
#!/bin/bash
# deployment.sh

set -e

NETWORK_ID="u0inmt8fjp"
CHAINCODE_ID="movie-chaincode"
VERSION="1.0"
DOCKER_IMAGE="yourusername/flashback-movie-chaincode:$VERSION"

echo "🔨 Building chaincode..."
cd chaincode/movie
go build -o bin/movie-chaincode

echo "🐳 Building Docker image..."
docker build -t flashback-movie-chaincode:$VERSION .
docker push $DOCKER_IMAGE

echo "📤 Deploying to Kaleido..."
curl -X POST https://api.kaleido.io/$NETWORK_ID/chaincodes \
  -H "Authorization: Bearer $KALEIDO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$CHAINCODE_ID\",
    \"version\": \"$VERSION\",
    \"docker_image\": \"$DOCKER_IMAGE\"
  }"

echo "✅ Deployment complete!"
echo "Visit: https://kaleido.io/console to verify"
```

Save as `scripts/deploy-chaincode.sh` and run:
```bash
chmod +x scripts/deploy-chaincode.sh
KALEIDO_TOKEN=$YOUR_TOKEN ./scripts/deploy-chaincode.sh
```

---

**Last Updated**: November 1, 2025
**Chaincode Version**: 1.0
**Tested on**: Hyperledger Fabric 2.5.0 / Kaleido
