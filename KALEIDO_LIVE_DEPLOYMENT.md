# Kaleido Live Deployment Guide

## Current Status

✗ Chaincodes NOT yet deployed to Kaleido
✗ REST Gateway endpoints not accessible

## Prerequisites Completed

✓ Kaleido network created (u0inmt8fjp)
✓ Peer node deployed (u0z8yv2jc2)
✓ Channel created (default-channel)
✓ REST Gateway API accessible (https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io)
✓ Credentials configured in .env.local
✓ Movie chaincode built (19MB binary)
✓ CLI tool created for chaincode interaction
✓ E2E test suite created

## Required Manual Steps

### Step 1: Deploy Chaincodes via Kaleido Console

Since the REST Gateway API deployment requires the chaincodes to be already installed on peers, you need to:

1. Go to Kaleido Console: https://console.kaleido.io
2. Navigate to your network (u0inmt8fjp)
3. For each chaincode (movie, tvshow, games, voting):
   - Click "Deploy Chaincode"
   - Upload the binary from `chaincode/{name}/{name}-chaincode`
   - Set version to "1.0.0"
   - Select channel "default-channel"
   - Configure endorsement policy
   - Deploy

### Step 2: Install Chaincode on Peer

Once deployed via console, ensure it's instantiated:

```bash
npm run check:kaleido    # Verify deployment
```

### Step 3: Test with CLI

Once chaincodes are deployed:

```bash
npm run cli:test:live     # Run CLI E2E tests against Kaleido
npm run test:e2e:live    # Run Cypress E2E tests against Kaleido
```

## Alternative: Use Mock Server for Testing

If you don't want to deploy to Kaleido yet, you can test with mock data:

```bash
npm run cli:test          # Run CLI E2E tests with mock data
npm run test:e2e         # Run Cypress E2E tests with mock data
```

## CLI Commands Available

Once deployed, use the CLI to interact with chaincodes:

```bash
# Query all movies
npm run cli:dev -- query-all
npm run cli:dev -- query-all --format table

# Submit content request
npm run cli:dev -- submit-request tt1234567 "Movie Title" "Director Name"

# Approve request
npm run cli:dev -- approve-request tt1234567 moderator-001

# Search by title
npm run cli:dev -- search-title "Inception"

# Get history
npm run cli:dev -- get-history tt1234567

# Health check
npm run cli:dev -- health
```

## Configuration Files

- `.env.local` - Kaleido credentials and endpoints
- `src/lib/kaleido-config.ts` - Configuration loader
- `src/lib/kaleido-api.ts` - REST Gateway API client
- `scripts/fabric-cli.ts` - CLI tool
- `__tests__/cli-e2e.test.mjs` - E2E test suite

## Troubleshooting

### REST Gateway Returns 404

This means chaincodes are not deployed. Deploy via Kaleido Console first.

### CLI Commands Timeout

Check that:
1. REST Gateway is accessible
2. Chaincodes are deployed and instantiated
3. Network connectivity is OK

### E2E Tests Fail

Run with verbose output:
```bash
npm run cli:test:live -- --verbose
```

## Next Steps

1. Deploy chaincodes via Kaleido Console
2. Run `npm run check:kaleido` to verify
3. Run E2E tests: `npm run cli:test:live`
4. Monitor in Kaleido Explorer
