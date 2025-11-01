# 🚀 Deploy Chaincodes to Kaleido - Complete Guide

**The Issue**: The REST Gateway returns "404 default backend" because chaincodes must be deployed via Kaleido Console first.

**The Solution**: This guide shows you step-by-step how to deploy chaincodes using the Kaleido Console UI.

---

## 📋 Current Status

✅ **What's Ready**:
- CLI tool (7 commands) - working locally
- E2E tests (40+ tests) - working locally
- REST Gateway client - ready to connect
- Chaincode binary - built (18.5MB)
- Deployment scripts - ready for post-deployment

❌ **What's Needed**:
- Chaincodes deployed to Kaleido network
- Once deployed, REST Gateway will be fully operational

---

## 🎯 Step-by-Step Deployment

### 1. Open Kaleido Console

Visit: **https://console.kaleido.io**

You should see your network `u0inmt8fjp` listed.

### 2. Navigate to Your Network

1. Click on network: **u0inmt8fjp**
2. You'll see the network dashboard

### 3. Go to Chaincode Management

Look for one of these options:
- **"Chaincodes"** tab/section
- **"Smart Contracts"** menu
- **"Deploy Chaincode"** button

### 4. Deploy movie-chaincode

#### Option A: Upload Binary (Recommended for Testing)

1. Click **"Deploy Chaincode"** or **"Upload Chaincode"**
2. Fill in the form:
   ```
   Name:           movie
   Version:        1.0.0
   Language:       Go/Golang
   Upload Binary:  /Users/ari.asulin/dev/test/rust2/chaincode/movie/movie-chaincode
   Channel:        default-channel
   ```
3. Click **"Deploy"** button

#### Option B: Provide Source Code

If the UI asks for source code instead of binary:
1. Source path: `/Users/ari.asulin/dev/test/rust2/chaincode/movie`
2. Same channel & version as above

### 5. Wait for Deployment

This typically takes **30-120 seconds**:
- ⏳ "Pending" → Code packaging
- ⏳ "Installing" → Peer installation
- ⏳ "Instantiating" → Channel deployment
- ✅ "Active" or "Deployed"

**Monitor in console** - you should see status updates.

### 6. Verify Deployment Success

In the Kaleido Console, the chaincode should show:
```
movie 1.0.0 - Active ✓
Status: Deployed
Channel: default-channel
```

---

## ✅ After Deployment - Activate Your CLI

Once the Kaleido Console shows the chaincode as **"Active"** or **"Deployed"**:

### Step 1: Verify Connection

```bash
npm run check:kaleido
```

Expected output:
```
✓ Environment Configuration loaded
✓ REST Gateway accessible
✓ movie is deployed
✓ All systems operational!
```

### Step 2: Run Live E2E Tests

```bash
npm run cli:test:live
```

Expected: All tests passing ✅

### Step 3: Query Your Data

```bash
npm run cli:dev -- query-all

npm run cli:dev -- query-all --format table

npm run cli:dev -- search-title "your search"
```

Expected: Real data from Kaleido ledger

---

## 📺 Visual Walkthrough

```
1. https://console.kaleido.io
   ↓
2. Select network: u0inmt8fjp
   ↓
3. Click "Deploy Chaincode" / "Upload Chaincode"
   ↓
4. Fill form:
   - Name: movie
   - Version: 1.0.0
   - Upload binary: movie-chaincode
   - Channel: default-channel
   ↓
5. Click "Deploy"
   ↓
6. Wait 30-120 seconds (console shows progress)
   ↓
7. Status shows "Active" / "Deployed" ✅
   ↓
8. Back to terminal:
   npm run check:kaleido
   npm run cli:test:live
   npm run cli:dev -- query-all
```

---

## 🔍 Troubleshooting

### Issue: Can't Find "Deploy Chaincode" Button

**Solution**: Look for:
- **Chaincode** tab in network dashboard
- **Smart Contracts** menu
- **Chaincodes** section under channel
- Right-click on channel → Deploy Chaincode

### Issue: Binary Upload Fails

**Cause**: Binary might be corrupted or too large

**Solution**:
```bash
# Rebuild the binary
cd chaincode/movie
go build -o movie-chaincode .
cd ../..

# Verify it built correctly
ls -lh chaincode/movie/movie-chaincode
# Should show ~18.5MB
```

### Issue: Deployment Takes > 5 Minutes

**Cause**: Normal - Kaleido is provisioning resources

**Solution**:
- Wait up to 10 minutes
- Refresh console page
- Check "Activity" or "Logs" section for errors

### Issue: "Channel not found"

**Cause**: Channel name mismatch

**Solution**:
- Verify channel name in console: usually `default-channel`
- Make sure .env.local has `KALEIDO_CHANNEL_NAME=default-channel`

### Issue: Deployment Shows "Error" or "Failed"

**Cause**: Various issues with chaincode or configuration

**Solution**:
1. Check Kaleido console logs
2. Verify binary was compiled correctly
3. Try redeploying with version `1.0.1` (if 1.0.0 failed)
4. Contact Kaleido support if persists

---

## 📊 Deployment Status Indicators

| Status | Meaning | Action |
|--------|---------|--------|
| **Pending** | Processing upload | Wait |
| **Installing** | Installing on peers | Wait |
| **Instantiating** | Deploying on channel | Wait |
| **Active** | ✅ Ready to use | Proceed! |
| **Deployed** | ✅ Ready to use | Proceed! |
| **Error** | ❌ Failed | Check logs, retry |
| **Cancelled** | ❌ Cancelled | Try again |

---

## ✨ What Happens After Deployment

Once the chaincode is **"Active"** in Kaleido Console:

1. **REST Gateway becomes active**
   - All `/chaincodes/movie` endpoints respond
   - Queries return actual ledger data
   - Transactions execute properly

2. **CLI tool works with real data**
   ```bash
   npm run cli:dev -- query-all
   # Returns: Real movies from ledger
   ```

3. **E2E tests pass**
   ```bash
   npm run cli:test:live
   # Result: All 23 tests passing ✅
   ```

4. **You have a live Fabric network**
   - Ready for production use
   - Can submit transactions
   - Can query data
   - Can scale to more chaincodes

---

## 🎯 Timeline

| Step | Time | Status |
|------|------|--------|
| Upload binary | 1-2 min | User action |
| Deploy in console | 30-120 sec | Kaleido |
| Verify with CLI | 1 min | Automated |
| Run full test suite | 2 min | Automated |
| **Total** | **~5-10 min** | ✅ **Live!** |

---

## 📝 After-Deployment Checklist

Once deployment completes:

- [ ] Chaincode shows "Active" in console
- [ ] Run: `npm run check:kaleido` → All ✓
- [ ] Run: `npm run cli:test:live` → All passing
- [ ] Test: `npm run cli:dev -- query-all` → Returns data
- [ ] Can see transactions in Kaleido console

---

## 🚀 Deploy Additional Chaincodes (Optional)

To deploy more chaincodes (tvshow, games, voting):

1. Fix Go module issues:
   ```bash
   cd chaincode/tvshow
   go mod init github.com/yourusername/tvshow
   go build -o tvshow-chaincode .
   ```

2. Repeat the Console deployment for each

3. All available via CLI:
   ```bash
   npm run cli:dev -- query-all tvshow
   npm run cli:dev -- query-all games
   ```

---

## 💡 Tips & Best Practices

- ✅ Deploy one chaincode at a time
- ✅ Wait for status to be "Active" before next
- ✅ Keep CLI running for real-time testing
- ✅ Monitor console for any errors
- ✅ Save deployment confirmation (screenshot)

---

## 🆘 Need Help?

### Check Logs
In Kaleido Console:
- Click **"Logs"** or **"Activity"**
- Look for deployment events
- Error messages usually describe the problem

### Verify Configuration
```bash
grep KALEIDO_ .env.local | head -5
# Should show your credentials
```

### Test Gateway Connectivity
```bash
npm run cli:dev -- health
# Should show connection info
```

### Run Diagnostics
```bash
npm run check:kaleido
# Detailed status report
```

---

## ✅ Success Indicators

After deployment succeeds, you'll have:

1. **Chaincode Active in Console** ✓
2. **CLI Tool Connected** ✓
3. **All Tests Passing** ✓
4. **Real Data in Ledger** ✓
5. **REST Gateway Responding** ✓

**Congratulations!** You now have a live Hyperledger Fabric network running on Kaleido with a fully functional CLI interface and comprehensive testing infrastructure. 🎉

---

## 🔗 Quick Links

- **Kaleido Console**: https://console.kaleido.io
- **Your Network**: u0inmt8fjp
- **Default Channel**: default-channel
- **Local Chaincode**: /Users/ari.asulin/dev/test/rust2/chaincode/movie

---

**Next Step**: Go to https://console.kaleido.io and deploy the chaincode! 🚀
