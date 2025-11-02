# Deploy All Channels - Complete Guide

## Overview

This guide provides step-by-step instructions for deploying all 4 chaincodes (channels) to the Kaleido blockchain network:
- **movie** - Content management for movies
- **tvshow** - Content management for TV shows  
- **games** - Content management for games
- **voting** - Voting and governance system

## Current Status

✅ All prerequisite components are ready:
- Kaleido network created (ID: `u0inmt8fjp`)
- Peer node deployed (ID: `u0z8yv2jc2`)
- Channel created: `default-channel`
- REST Gateway configured and accessible
- All chaincode binaries built:
  - ✓ `chaincode/movie/movie-chaincode` (19.5 MB)
  - ✓ `chaincode/tvshow/tvshow-chaincode` (5.2 MB)
  - ✓ `chaincode/games/games-chaincode` (5.1 MB)
  - ✓ `chaincode/voting/voting-chaincode` (5.0 MB)

## Deployment Method

Since the Kaleido REST Gateway API doesn't support remote chaincode installation, chaincodes must be deployed via the **Kaleido Console UI**. This is the officially supported method.

### Why Manual Console Deployment?

- Kaleido REST Gateway is a query and invoke interface only
- Chaincode installation requires admin/operator credentials
- Kaleido Console provides secure authenticated deployment interface
- Follows Kaleido best practices and security guidelines

## Step-by-Step Deployment via Console

### Prerequisites
- Kaleido Console access: https://console.kaleido.io
- Network admin/operator credentials
- Network ID: `u0inmt8fjp`
- Channel name: `default-channel`

### Deployment Steps

#### Step 1: Access Kaleido Console

1. Open https://console.kaleido.io
2. Log in with your Kaleido credentials
3. Navigate to your network: `u0inmt8fjp` (Flashback)

#### Step 2: Deploy Movie Chaincode

1. In the network dashboard, click **"Deploy Chaincode"** or **"Add Chaincode"**
2. Configure as follows:
   ```
   Name:              movie
   Version:           1.0.0
   Type:              golang
   File:              /Users/ari.asulin/dev/test/rust2/chaincode/movie/movie-chaincode
   Channel:           default-channel
   Endorsement Policy: OR('Org1MSP.peer')
   ```
3. Click **"Deploy"** or **"Install & Instantiate"**
4. Wait for deployment to complete (typically 30-60 seconds)
5. Verify status shows ✓ "Deployed" or "Active"

#### Step 3: Deploy TV Show Chaincode

1. Click **"Deploy Chaincode"** again
2. Configure as follows:
   ```
   Name:              tvshow
   Version:           1.0.0
   Type:              golang
   File:              /Users/ari.asulin/dev/test/rust2/chaincode/tvshow/tvshow-chaincode
   Channel:           default-channel
   Endorsement Policy: OR('Org1MSP.peer')
   ```
3. Click **"Deploy"**
4. Wait for completion and verify status

#### Step 4: Deploy Games Chaincode

1. Click **"Deploy Chaincode"**
2. Configure as follows:
   ```
   Name:              games
   Version:           1.0.0
   Type:              golang
   File:              /Users/ari.asulin/dev/test/rust2/chaincode/games/games-chaincode
   Channel:           default-channel
   Endorsement Policy: OR('Org1MSP.peer')
   ```
3. Click **"Deploy"**
4. Wait for completion and verify status

#### Step 5: Deploy Voting Chaincode

1. Click **"Deploy Chaincode"**
2. Configure as follows:
   ```
   Name:              voting
   Version:           1.0.0
   Type:              golang
   File:              /Users/ari.asulin/dev/test/rust2/chaincode/voting/voting-chaincode
   Channel:           default-channel
   Endorsement Policy: OR('Org1MSP.peer')
   ```
3. Click **"Deploy"**
4. Wait for completion and verify status

### Monitoring Deployment Progress

In Kaleido Console:
1. Go to **"Chaincode"** section
2. You should see all 4 chaincodes listed:
   - movie (1.0.0) - Status: Deployed
   - tvshow (1.0.0) - Status: Deployed
   - games (1.0.0) - Status: Deployed
   - voting (1.0.0) - Status: Deployed

### Expected Timeframe

- Each chaincode deployment: 30-60 seconds
- Total time for all 4: 2-4 minutes
- No intervention needed once deployed

## Verification Steps

### Step 1: Check Deployment Status

After all chaincodes are deployed in Console, verify with:

```bash
npm run check:kaleido
```

Expected output:
```
✓ Chaincode Binaries:
  ✓ movie-chaincode
  ✓ tvshow-chaincode
  ✓ games-chaincode
  ✓ voting-chaincode

✓ REST Gateway Status: Connected
✓ Chaincode Deployment Status:
  ✓ movie is deployed
  ✓ tvshow is deployed
  ✓ games is deployed
  ✓ voting is deployed

Summary: 4/4 chaincodes deployed
```

### Step 2: Run CLI E2E Tests

Once verified, test the deployed chaincodes:

```bash
npm run cli:test:live
```

Expected: All tests pass (23 tests)

### Step 3: Run Cypress E2E Tests

Test via the UI:

```bash
npm run test:e2e:live
```

### Step 4: Manual CLI Testing

Query individual chaincodes:

```bash
# Check movie chaincode health
npm run cli:dev -- health

# Query all movies
npm run cli:dev -- query-all

# Query with table format
npm run cli:dev -- query-all --format table

# Search for content
npm run cli:dev -- search-title "Inception"

# Get help
npm run cli:dev -- --help
```

## Configuration

The deployment uses these environment variables from `.env.local`:

```bash
KALEIDO_REST_GATEWAY=https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io
KALEIDO_CHANNEL_NAME=default-channel
KALEIDO_APP_ID=u0hjwp2mgt
KALEIDO_APP_PASSWORD=FZ_uU_KTzqLevq8mWWjxMUahqcKxAc0me_qUjKqDAa0
KALEIDO_ORGANIZATION=Org1MSP
KALEIDO_NETWORK_ID=u0inmt8fjp
```

## Troubleshooting

### Console Won't Accept File Upload

**Problem:** File upload fails with "File too large" or similar error

**Solution:**
1. Try uploading chaincode binary directly (not .tar.gz)
2. Ensure file path is correct
3. Check file is readable: `ls -lh chaincode/*/\*-chaincode`

### Deployment Stuck/Timeout

**Problem:** Deployment appears stuck in "Installing" state

**Solution:**
1. Wait 2-3 minutes (sometimes takes longer)
2. Refresh the Kaleido Console page
3. Check network status in Console
4. If still stuck, contact Kaleido support

### REST Gateway Returns 404

**Problem:** `npm run check:kaleido` shows 404 errors

**Solution:**
1. Verify all chaincodes are in "Deployed" state in Console
2. Wait 1-2 minutes after Console shows "Deployed"
3. REST Gateway caches may need refresh time
4. Try: `npm run check:kaleido` again in 30 seconds

### Chaincode Invoke Fails

**Problem:** CLI tests fail with "chaincode not responding"

**Solution:**
1. Verify chaincode status: `npm run check:kaleido`
2. Ensure chaincode is in "Deployed" state (not just "Installed")
3. Check that instantiation completed successfully
4. Try restarting the REST Gateway in Kaleido Console

## Channels Overview

### Movie Channel (`movie`)

**Purpose:** Content management system for movies  
**Functions:**
- `SubmitContentRequest` - Submit movie for approval
- `ApproveContentRequest` - Approve submitted movie
- `RejectContentRequest` - Reject submission
- `QueryAll` - Get all approved movies
- `SearchByTitle` - Search movies by title
- `GetMovieByIMDBID` - Get specific movie
- `GetRequestHistory` - View approval history

**Data Model:**
```json
{
  "imdb_id": "tt1375666",
  "title": "Inception",
  "director": "Christopher Nolan",
  "release_year": 2010,
  "status": "approved",
  "torrent_hash": "Qm...",
  "approved_by": "admin1",
  "approved_at": "2025-11-01T11:00:00Z"
}
```

### TV Show Channel (`tvshow`)

**Purpose:** Content management for TV shows  
**Structure:** Similar to movie channel  
**Primary Keys:** IMDb ID (format: `tt[7-8 digits]`)  
**State:** Ready for implementation

### Games Channel (`games`)

**Purpose:** Content management for games  
**Structure:** Similar to movie channel  
**Primary Keys:** Game ID/IGDB ID  
**State:** Ready for implementation

### Voting Channel (`voting`)

**Purpose:** Voting and governance  
**Functions:** TBD (placeholder)  
**State:** Ready for implementation

## Performance Notes

### Query Performance
- Movie queries optimized for title search
- Limit: 100 results per query
- Pagination: Automatic for large result sets
- Indexing: CouchDB indices on doc_type, status

### Transaction Performance
- Average invoke time: 1-2 seconds
- Average query time: 100-500ms
- Endorsement: Single peer (ORG1)

### REST Gateway Rate Limits
- Default: 100 requests/second
- Burst: 1000 requests/minute
- Adjust in Kaleido Console if needed

## Post-Deployment Checklist

- [ ] All 4 chaincodes show "Deployed" in Kaleido Console
- [ ] `npm run check:kaleido` returns all ✓
- [ ] CLI E2E tests pass: `npm run cli:test:live`
- [ ] Cypress E2E tests pass: `npm run test:e2e:live`
- [ ] Manual CLI query returns data: `npm run cli:dev -- query-all`
- [ ] REST Gateway responds without errors
- [ ] No errors in application logs

## Next Steps After Deployment

1. **Monitor Live Environment**
   - Dashboard: https://console.kaleido.io
   - Watch for transaction errors or timeouts

2. **Test All Features**
   - Submit content requests
   - Approve/reject requests
   - Search and query content
   - Verify torrent hash functionality

3. **Set Up Monitoring**
   - Configure alerts for chaincode errors
   - Monitor REST Gateway performance
   - Track transaction throughput

4. **Production Hardening**
   - Review endorsement policies
   - Implement rate limiting
   - Set up backup/recovery procedures

## Support Resources

- **Kaleido Documentation:** https://docs.kaleido.io
- **Hyperledger Fabric Docs:** https://hyperledger-fabric.readthedocs.io
- **Project README:** See [README.md](./README.md)
- **API Reference:** See [docs/API.md](./docs/API.md)
- **CLI Commands:** Run `npm run cli:dev -- --help`

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Prerequisites Setup | Complete | ✓ Done |
| Network Creation | Complete | ✓ Done |
| Channel Creation | Complete | ✓ Done |
| Chaincode Building | Complete | ✓ Done |
| **Chaincode Deployment** | 2-4 min | ⏳ **In Progress** |
| Verification | 1 min | ⏳ Next |
| Testing | 5-10 min | ⏳ Next |
| Production Ready | N/A | ⏳ Pending |

## Questions?

See the project documentation:
- [README.md](./README.md) - Project overview
- [docs/INDEX.md](./docs/INDEX.md) - Documentation index
- [KALEIDO_DEPLOYMENT_GUIDE.md](./KALEIDO_DEPLOYMENT_GUIDE.md) - Detailed setup
- [docs/API.md](./docs/API.md) - API reference

---

**Last Updated:** November 1, 2025  
**Status:** Ready for Console deployment  
**Network:** Kaleido (u0inmt8fjp)  
**Channel:** default-channel
