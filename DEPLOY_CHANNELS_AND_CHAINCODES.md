# 🚀 Kaleido Chaincode Deployment Guide - READY TO DEPLOY

**Status**: ✨ All 4 chaincodes built and ready for deployment  
**Date**: November 1, 2025  
**Network**: Kaleido (`u0inmt8fjp`)  
**Channel**: `default-channel`

---

## 📋 Pre-Deployment Checklist

Before you start, verify these are in place:

- ✅ All 4 chaincodes built:
  - `chaincode/movie/movie-chaincode` (19.5 MB)
  - `chaincode/tvshow/tvshow-chaincode` (5.2 MB)
  - `chaincode/games/games-chaincode` (5.1 MB)
  - `chaincode/voting/voting-chaincode` (5.0 MB)
- ✅ `.env.local` configured with Kaleido credentials
- ✅ Network created and ready (u0inmt8fjp)
- ✅ Channel created (default-channel)

---

## 🎯 Deployment Steps

### Step 1: Access Kaleido Console

1. Open your browser and navigate to:
   ```
   https://console.kaleido.io
   ```

2. Log in with your Kaleido credentials
   - Username: Your Kaleido account
   - Password: Your account password

3. Confirm you see your network: **u0inmt8fjp**

---

### Step 2: Deploy Movie Chaincode

**Location**: Your workspace at `/Users/ari.asulin/dev/test/rust2/chaincode/movie/movie-chaincode`

#### 2a. Open Chaincode Deployment

1. In the Kaleido Console, select network **u0inmt8fjp**
2. Look for **"Chaincodes"** or **"Deploy Chaincode"** section
3. Click **"Deploy Chaincode"** button

#### 2b. Fill Deployment Form

| Field | Value |
|-------|-------|
| **Chaincode Name** | `movie` |
| **Version** | `1.0.0` |
| **Language** | `Go` |
| **Channel** | `default-channel` |
| **Binary File** | Select `/Users/ari.asulin/dev/test/rust2/chaincode/movie/movie-chaincode` |

#### 2c. Deploy

1. Click **"Deploy"** or **"Submit"** button
2. Wait for confirmation message (30-60 seconds)
3. Status should show: **"Deployed"** or **"Installed and Ready"**

**✓ Movie chaincode deployed!**

---

### Step 3: Deploy TV Show Chaincode

**Location**: `chaincode/tvshow/tvshow-chaincode`

1. Click **"Deploy Chaincode"** again
2. Fill the form:
   - **Name**: `tvshow`
   - **Version**: `1.0.0`
   - **Language**: `Go`
   - **Channel**: `default-channel`
   - **Binary**: Select tvshow-chaincode binary
3. Click **"Deploy"**
4. Wait for completion

**✓ TV Show chaincode deployed!**

---

### Step 4: Deploy Games Chaincode

**Location**: `chaincode/games/games-chaincode`

1. Click **"Deploy Chaincode"** again
2. Fill the form:
   - **Name**: `games`
   - **Version**: `1.0.0`
   - **Language**: `Go`
   - **Channel**: `default-channel`
   - **Binary**: Select games-chaincode binary
3. Click **"Deploy"**
4. Wait for completion

**✓ Games chaincode deployed!**

---

### Step 5: Deploy Voting Chaincode

**Location**: `chaincode/voting/voting-chaincode`

1. Click **"Deploy Chaincode"** again
2. Fill the form:
   - **Name**: `voting`
   - **Version**: `1.0.0`
   - **Language**: `Go`
   - **Channel**: `default-channel`
   - **Binary**: Select voting-chaincode binary
3. Click **"Deploy"**
4. Wait for completion

**✓ Voting chaincode deployed!**

---

## ✅ Post-Deployment Verification

After all 4 chaincodes are deployed, run these verification commands:

### Verify All Chaincodes Are Deployed

```bash
npm run check:kaleido
```

**Expected Output**:
```
✓ Environment Configuration loaded
✓ REST Gateway accessible
✓ Chaincode deployment status:
  • movie ✓
  • tvshow ✓
  • games ✓
  • voting ✓
✓ All systems operational!
```

### Run CLI E2E Tests

```bash
npm run cli:test:live
```

**Expected Output**:
```
 PASS  __tests__/cli-e2e.test.mjs
  ✓ CLI Tests (23 tests)
    ✓ health check
    ✓ query-all command
    ✓ search by title
    ... (all tests passing)

Tests: 23 passed, 0 failed
```

### Manual CLI Testing

Test the CLI directly with real data:

```bash
# Check connection health
npm run cli:dev -- health

# Query all movies
npm run cli:dev -- query-all

# Query with table formatting
npm run cli:dev -- query-all --format table

# Search for movies
npm run cli:dev -- search-title "Inception"

# Get help
npm run cli:dev -- --help
```

---

## 🐛 Troubleshooting

### Problem: "404 - Chaincode not found"

**Cause**: Chaincode not deployed yet

**Solution**:
1. Verify deployment completed in Kaleido Console (look for "Deployed" status)
2. Wait 60 seconds for cache refresh
3. Run `npm run check:kaleido` again
4. Check for error messages in Console

### Problem: "Connection refused / Cannot reach REST Gateway"

**Cause**: Credentials or network issue

**Solution**:
1. Verify `.env.local` has correct credentials:
   ```bash
   grep KALEIDO_REST_GATEWAY .env.local
   ```
2. Test connectivity directly:
   ```bash
   curl https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io/health
   ```
3. Check network status in Kaleido Console
4. Restart your terminal and retry

### Problem: "Test timeout"

**Cause**: Chaincode responses are slow

**Solution**:
1. Verify all 4 chaincodes are in "Deployed" state
2. Check network performance in Kaleido Console
3. Increase timeout: `npm run cli:test:live -- --testTimeout=60000`
4. Wait 2-3 minutes and retry (chaincode may be initializing)

### Problem: Binary file not found

**Cause**: Path issue or binary not built

**Solution**:
1. Verify binary exists:
   ```bash
   ls -lh chaincode/movie/movie-chaincode
   ls -lh chaincode/tvshow/tvshow-chaincode
   ls -lh chaincode/games/games-chaincode
   ls -lh chaincode/voting/voting-chaincode
   ```
2. If missing, rebuild:
   ```bash
   cd chaincode/movie && go build -o movie-chaincode . && cd ../..
   ```

---

## 📊 Deployment Timeline

| Step | Task | Duration | Status |
|------|------|----------|--------|
| 1 | Deploy movie | 30-60s | ⏳ Your turn |
| 2 | Deploy tvshow | 30-60s | ⏳ Your turn |
| 3 | Deploy games | 30-60s | ⏳ Your turn |
| 4 | Deploy voting | 30-60s | ⏳ Your turn |
| 5 | Verify deployment | 1 min | ⏳ After step 4 |
| 6 | Run E2E tests | 2-3 min | ⏳ After step 5 |
| **Total** | **All chaincodes deployed & tested** | **~10 minutes** | |

---

## 🎯 Success Criteria

After completing all steps, you should have:

- ✅ All 4 chaincodes showing "Deployed" in Kaleido Console
- ✅ `npm run check:kaleido` returns all ✓
- ✅ No 404 errors in status checks
- ✅ CLI commands respond with real blockchain data
- ✅ All 23 E2E tests passing
- ✅ Manual CLI tests working

---

## 📚 Additional Resources

| Resource | Purpose | Location |
|----------|---------|----------|
| Kaleido Console | Deploy & manage chaincodes | https://console.kaleido.io |
| API Reference | API endpoint documentation | `docs/API.md` |
| Environment Config | Credentials and settings | `.env.local` |
| CLI Help | All available commands | Run: `npm run cli:dev -- --help` |
| Deployment Status | Current state | `DEPLOYMENT_STATUS.md` |

---

## 🚀 Next Steps After Deployment

Once all chaincodes are deployed and verified:

1. **Run comprehensive tests** → `npm run cli:test:live`
2. **Test all chaincodes** → `npm run cli:dev -- query-all` (for each chaincode)
3. **Monitor performance** → Check Kaleido Console metrics
4. **Advanced features** → Implement complex business logic
5. **Production setup** → Configure monitoring and alerting

---

## 💡 Pro Tips

1. **Batch Deployments**: Deploy all 4 chaincodes in succession (takes ~4 minutes)
2. **Verify Early**: Run `npm run check:kaleido` after each deployment
3. **Use Logs**: Check Kaleido Console deployment logs if errors occur
4. **Keep Terminals Open**: Have both console and terminal open during deployment
5. **Document Status**: Take screenshots of successful deployments

---

## 🎉 You're Ready!

All chaincodes are built and ready. The deployment process is straightforward and takes about **10 minutes total**.

**Your next action**: 👉 Open https://console.kaleido.io and deploy the first chaincode!

---

**Last Updated**: November 1, 2025  
**Environment**: Production (Kaleido)  
**Status**: Ready for Deployment ✨
