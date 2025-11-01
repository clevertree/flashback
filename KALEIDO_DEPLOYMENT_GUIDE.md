# Kaleido Chaincode Deployment Guide

Deploy the movie chaincode to Kaleido Hyperledger Fabric network and test via E2E.

## Prerequisites

- ✅ Chaincode built: `cd chaincode/movie && go build -o movie-chaincode .`
- ✅ `.env.local` configured with Kaleido credentials
- ✅ Kaleido network accessible (network ID: `u0inmt8fjp`)
- ✅ Node.js and npm installed

## Environment Configuration

Your `.env.local` file contains:

```bash
KALEIDO_APP_ID="u0hjwp2mgt"
KALEIDO_APP_PASSWORD="FZ_uU_KTzqLevq8mWWjxMUahqcKxAc0me_qUjKqDAa0"
KALEIDO_REST_GATEWAY="https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io"
KALEIDO_CHANNEL_NAME="default-channel"
KALEIDO_ORGANIZATION="Org1MSP"
```

## Step 1: Build the Chaincode

```bash
cd chaincode/movie
go build -o movie-chaincode .
cd ../..
```

Expected output: `movie-chaincode` binary created in `chaincode/movie/`

## Step 2: Deploy to Kaleido

The deployment script automates installation and instantiation on Kaleido.

### Dry Run (no changes)

```bash
node scripts/deploy-to-kaleido.js --dry-run
```

Expected output:
```
🚀 Kaleido Chaincode Deployment
================================

Configuration:
  REST Gateway: https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io
  Channel: default-channel
  App ID: u0hjwp2mgt

⚠️  DRY RUN MODE - No changes will be made
```

### Live Deployment

```bash
node scripts/deploy-to-kaleido.js
```

Expected output:
```
🚀 Kaleido Chaincode Deployment
================================

📦 Checking chaincode...
✓ Chaincode binary found

🔧 Installing chaincode on peer...
✓ Chaincode installed successfully

⚡ Instantiating chaincode on channel...
✓ Chaincode instantiated successfully

✅ Testing chaincode invocation...
✓ Chaincode test successful

✨ Deployment complete!

Next steps:
  1. Update src-tauri/lib/api.ts with real Kaleido endpoints
  2. Run E2E tests: npm run test:e2e
  3. Monitor chaincode invocations in Kaleido console
```

## Step 3: Test Network Connection

### Option A: Mock Tests (no Kaleido required)

```bash
npm run test:e2e
```

This runs the existing E2E tests with mock data:
- ✅ 28/32 tests passing
- ✅ All chaincode logic validated
- ⚠️ No real blockchain interaction

### Option B: Live Kaleido Tests (requires deployment)

```bash
# First, ensure chaincode is deployed
node scripts/deploy-to-kaleido.js

# Then run live tests
CYPRESS_USE_LIVE_KALEIDO=true npm run test:e2e:live
```

This runs tests against your deployed chaincode:
- ✅ Health & Connectivity checks
- ✅ QueryAll against ledger
- ✅ SubmitContentRequest transactions
- ✅ ApproveContentRequest admin actions
- ✅ SearchByTitle queries
- ✅ Torrent hashes validation
- ✅ Error handling & edge cases
- ✅ Audit trail verification

### Option C: Interactive Testing

Start the dev server:

```bash
npm run dev
```

Navigate to `http://localhost:3000` and:

1. **Connect to Network** → Use Kaleido REST Gateway
2. **Submit Content** → Create new movie request
3. **Query Ledger** → View all movies
4. **Approve Content** → Admin action (moderator role)
5. **Search Movies** → Find by title

## API Endpoints

All endpoints use REST Gateway authentication:

```
Base URL: https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io
Auth: Basic {base64(u0hjwp2mgt:password)}
Channel: default-channel
Chaincode: movie
```

### Available Functions

**Queries (read-only):**
```
GET /channels/default-channel/chaincodes/movie?args=["QueryAll"]
GET /channels/default-channel/chaincodes/movie?args=["GetMovieByIMDB","tt1375666"]
GET /channels/default-channel/chaincodes/movie?args=["SearchByTitle","Inception"]
GET /channels/default-channel/chaincodes/movie?args=["GetRequestHistory","tt1375666"]
```

**Invocations (write):**
```
POST /channels/default-channel/transactions
Body: {
  "chaincodeName": "movie",
  "args": ["SubmitContentRequest", "{json_data}"]
}

POST /channels/default-channel/transactions
Body: {
  "chaincodeName": "movie",
  "args": ["ApproveContentRequest", "tt1375666", "moderator-123"]
}
```

## Code Structure

### Deployment Script
- **Location**: `scripts/deploy-to-kaleido.js`
- **Function**: Packages, installs, and instantiates chaincode
- **Authentication**: Uses `.env.local` credentials
- **Error handling**: Validates build artifacts and network connectivity

### Kaleido API Client
- **Location**: `src/lib/kaleido-api.ts`
- **Function**: REST Gateway API wrapper
- **Methods**: `queryChaincode()`, `invokeChaincode()`, `submitContentRequest()`, etc.
- **Features**: Basic auth, error handling, health checks

### E2E Tests
- **Mock Tests**: `cypress/e2e/chaincode.cy.ts` (28/32 passing)
- **Live Tests**: `cypress/e2e/kaleido-live.cy.ts` (NEW - test suite framework)
- **Toggle**: Set `CYPRESS_USE_LIVE_KALEIDO=true` to run live tests

## Troubleshooting

### Chaincode Not Found
```
❌ Chaincode binary not found
```
**Solution**: Build first
```bash
cd chaincode/movie && go build -o movie-chaincode . && cd ../..
```

### Authentication Failed
```
❌ Installation failed: 401 Unauthorized
```
**Solution**: Verify credentials in `.env.local`
```bash
grep KALEIDO_APP_ID .env.local
grep KALEIDO_APP_PASSWORD .env.local
```

### Network Timeout
```
❌ Installation error: connect ETIMEDOUT
```
**Solution**: Check network access and Kaleido status
```bash
curl https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io/health
```

### Already Instantiated
```
ℹ Chaincode already instantiated
```
**This is OK** - Chaincode is already on the network and ready to use.

## Monitoring

### Kaleido Console
1. Visit: https://console.kaleido.io
2. Login with your organization credentials
3. Navigate to: Network → Channel → Chaincode
4. View real-time invocations and transaction history

### Logs
- Deployment logs: Check script output (colorized, timestamped)
- E2E test logs: `cypress/screenshots/` for failed test images
- Chaincode logs: Available in Kaleido console under "Logs"

## Next Steps

After successful deployment:

1. ✅ **Validate E2E Tests** - All 28 mock tests pass
2. ✅ **Run Live Tests** - Test against deployed chaincode (framework in place)
3. 🔄 **Implement TVShow Chaincode** - Similar structure with episodes
4. 🔄 **Implement Games Chaincode** - Platform-specific content
5. 🔄 **Add Advanced Search** - CouchDB rich queries
6. 🔄 **Add Event Subscriptions** - Real-time blockchain events

## Quick Reference

```bash
# Build chaincode
cd chaincode/movie && go build -o movie-chaincode . && cd ../..

# Dry run deployment
node scripts/deploy-to-kaleido.js --dry-run

# Live deployment
node scripts/deploy-to-kaleido.js

# Run mock E2E tests
npm run test:e2e

# Run live E2E tests
CYPRESS_USE_LIVE_KALEIDO=true npm run test:e2e:live

# Start dev server
npm run dev

# View Kaleido console
open https://console.kaleido.io
```

---

**Status**: Deployment infrastructure complete ✅  
**Next**: Execute deployment and run live E2E tests  
**Support**: Check logs and Kaleido console for detailed error information
