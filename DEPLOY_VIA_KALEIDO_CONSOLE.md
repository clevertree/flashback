# 🚀 Deploy Chaincodes and Channels via Kaleido Console

**Status**: Ready for Deployment  
**Method**: Kaleido Console UI (Official & Recommended)  
**Time Required**: ~10-15 minutes  
**Effort Level**: Easy (point-and-click)

---

## ⚠️ Important: Why Kaleido Console?

The Fabric CLI and API-based deployments require extensive setup and have security restrictions on the Kaleido platform. **Kaleido Console is the official, supported method** for:

- ✅ Uploading chaincode binaries
- ✅ Installing chaincodes
- ✅ Instantiating chaincodes
- ✅ Managing channels
- ✅ Monitoring deployment status

**Bottom line**: Use the Console - it's faster, more reliable, and officially supported.

---

## 🎯 Step-by-Step Deployment Guide

### Prerequisites Checklist

Before you start, verify:

- ✅ All 4 chaincode binaries are built:
  ```bash
  ls -lh /Users/ari.asulin/dev/test/rust2/chaincode/*/movie-chaincode
  ls -lh /Users/ari.asulin/dev/test/rust2/chaincode/*/tvshow-chaincode
  ls -lh /Users/ari.asulin/dev/test/rust2/chaincode/*/games-chaincode
  ls -lh /Users/ari.asulin/dev/test/rust2/chaincode/*/voting-chaincode
  ```
  
- ✅ You have Kaleido Console access: https://console.kaleido.io
- ✅ Your network is created: `u0inmt8fjp`
- ✅ Your channel is created: `default-channel`

---

## 📍 Part 1: Access Kaleido Console

### 1. Open Console
- Navigate to: **https://console.kaleido.io**
- Log in with your Kaleido credentials

### 2. Select Your Network
1. Click on your network: **u0inmt8fjp**
2. Wait for the network dashboard to load
3. You should see:
   - Peers
   - Channels
   - Chaincodes
   - Members

### 3. Locate Chaincode Section
In the left sidebar or top menu, look for:
- **Chaincodes** or
- **Smart Contracts** or
- **Deploy Chaincode**

---

## 📍 Part 2: Deploy Movie Chaincode

### Step 1: Open Deploy Dialog

1. Click **"Deploy Chaincode"** or **"Upload Chaincode"** button
2. A form should appear with fields for:
   - Chaincode Name
   - Version
   - Language
   - Channel
   - Binary File

### Step 2: Fill In Details

| Field | Value |
|-------|-------|
| **Chaincode Name** | `movie` |
| **Version** | `1.0.0` |
| **Language** | `Go` |
| **Channel** | `default-channel` |
| **Description** | `Movie content management chaincode` |

### Step 3: Upload Binary

1. Click **"Select File"** or **"Browse"**
2. Navigate to: `/Users/ari.asulin/dev/test/rust2/chaincode/movie/`
3. Select: **`movie-chaincode`** (binary file, ~18.5MB)
4. Click **"Open"** or **"Select"**

### Step 4: Deploy

1. Review the configuration
2. Click **"Deploy"** or **"Install & Instantiate"**
3. Wait for the confirmation message

**Status Check**:
- Should show **"Deployed"** or **"Ready"** status
- Takes typically 30-60 seconds
- Watch the progress bar if shown

✅ **Movie chaincode deployed!**

---

## 📍 Part 3: Deploy TV Show Chaincode

Repeat the process from Part 2, but with:

| Field | Value |
|-------|-------|
| **Chaincode Name** | `tvshow` |
| **Version** | `1.0.0` |
| **Language** | `Go` |
| **Channel** | `default-channel` |
| **Binary File** | `chaincode/tvshow/tvshow-chaincode` |

✅ **TV Show chaincode deployed!**

---

## 📍 Part 4: Deploy Games Chaincode

Repeat the process with:

| Field | Value |
|-------|-------|
| **Chaincode Name** | `games` |
| **Version** | `1.0.0` |
| **Language** | `Go` |
| **Channel** | `default-channel` |
| **Binary File** | `chaincode/games/games-chaincode` |

✅ **Games chaincode deployed!**

---

## 📍 Part 5: Deploy Voting Chaincode

Final deployment with:

| Field | Value |
|-------|-------|
| **Chaincode Name** | `voting` |
| **Version** | `1.0.0` |
| **Language** | `Go` |
| **Channel** | `default-channel` |
| **Binary File** | `chaincode/voting/voting-chaincode` |

✅ **Voting chaincode deployed!**

---

## ✅ Verification After Deployment

After all 4 chaincodes are deployed via the Console, verify with these commands:

### 1. Check Deployment Status

```bash
npm run verify:channels
```

**Expected Output**:
```
✅ All Checks Passed!
   • movie@1.0.0: Deployed ✓
   • tvshow@1.0.0: Deployed ✓
   • games@1.0.0: Deployed ✓
   • voting@1.0.0: Deployed ✓
   
Summary: 4/4 chaincodes deployed
```

### 2. Run Health Check

```bash
npm run check:kaleido
```

**Expected Output**:
```
✓ REST Gateway accessible
✓ All chaincodes deployed
✓ All systems operational
```

### 3. Run E2E Tests

```bash
npm run cli:test:live
```

**Expected Output**:
```
PASS __tests__/cli-e2e.test.mjs
  ✓ All 23 tests passing
  ✓ Real blockchain data verified
```

### 4. Test CLI Manually

```bash
# Test connection
npm run cli:dev -- health

# Query all movies
npm run cli:dev -- query-all

# Search for content
npm run cli:dev -- search-title "Inception"

# Format as table
npm run cli:dev -- query-all --format table
```

---

## 🐛 Troubleshooting

### Problem: Can't Find "Deploy Chaincode" Button

**Solution**:
1. Make sure you're in the network view (not organization view)
2. Look in the left sidebar under **"Chaincodes"** or **"Smart Contracts"**
3. Try searching for "deploy" or "upload" in the console
4. If still stuck, check: https://docs.kaleido.io/console/deploycc/

### Problem: Upload Says "File Too Large"

**Solution**:
1. The binary files are ~18MB, which is usually within limits
2. If rejected, try uploading from a faster connection
3. Consider uploading one at a time with delays between

### Problem: Deployment Shows "Pending" for Too Long

**Solution**:
1. Wait at least 2-3 minutes (chaincodes take time to initialize)
2. Refresh the console page
3. Check network status in the dashboard
4. Try accessing the REST Gateway directly:
   ```bash
   curl -u "u0hjwp2mgt:FZ_uU_KTzq..." https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io/health
   ```

### Problem: Deployment Shows "Failed" or "Error"

**Solution**:
1. Check the error message in the console
2. Verify binary file is correct (should be ~18-19MB)
3. Try restarting the deployment:
   - Delete the failed chaincode from console (if option available)
   - Retry upload
4. Contact Kaleido support if issues persist

### Problem: Channel Not Showing in Deploy Dialog

**Solution**:
1. Create the channel first via Console
2. Make sure the channel shows in the Channels list
3. Then attempt deployment again
4. Try refreshing the browser

---

## 🎯 Success Criteria

After completing all deployment steps, you should have:

✅ All 4 chaincodes showing "Deployed" in Kaleido Console  
✅ `npm run verify:channels` returns 4/4 deployed  
✅ No 404 errors in verification scripts  
✅ CLI commands respond with real blockchain data  
✅ E2E tests all passing  

---

## 📊 Deployment Timeline

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | Deploy movie | 1 min | 👈 Your turn |
| 2 | Deploy tvshow | 1 min | 👈 Your turn |
| 3 | Deploy games | 1 min | 👈 Your turn |
| 4 | Deploy voting | 1 min | 👈 Your turn |
| 5 | Console confirmations | 4 min | 👈 Your turn |
| 6 | Verify deployment | 1 min | Automated |
| 7 | Run E2E tests | 2-3 min | Automated |
| **Total** | **Chaincodes deployed & tested** | **~12 minutes** | |

---

## 📚 Reference

### Chaincode Locations

```
/Users/ari.asulin/dev/test/rust2/
├── chaincode/
│   ├── movie/
│   │   └── movie-chaincode (18.5MB) ✓
│   ├── tvshow/
│   │   └── tvshow-chaincode (18.5MB) ✓
│   ├── games/
│   │   └── games-chaincode (18.5MB) ✓
│   └── voting/
│       └── voting-chaincode (18.5MB) ✓
```

### NPM Commands

```bash
npm run verify:channels      # Verify all chaincodes deployed
npm run check:kaleido        # Check Kaleido status
npm run cli:test:live        # Run E2E tests
npm run cli:dev -- health    # Manual health check
npm run cli:dev -- query-all # Query all chaincodes
```

### Environment Details

```
Network ID: u0inmt8fjp
Channel: default-channel
REST Gateway: https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io
Consortium API: https://api.kaleido.io/api/v1
```

---

## 🎓 Why Kaleido Console?

### Advantages
- ✅ Official, supported method
- ✅ User-friendly UI
- ✅ Real-time status updates
- ✅ Built-in error handling
- ✅ No CLI setup required
- ✅ No API authentication issues
- ✅ Reliable and proven

### Alternatives (Not Recommended)
- ❌ Fabric CLI - Complex setup, security issues
- ❌ REST API - 403 errors, permission restrictions
- ❌ Docker-based - Requires Docker, more moving parts
- ❌ Manual peer commands - Requires local Fabric installation

---

## 🚀 Next Steps

1. **NOW**: Open https://console.kaleido.io
2. **THEN**: Deploy the 4 chaincodes using steps above
3. **AFTER**: Run verification commands:
   ```bash
   npm run verify:channels
   npm run cli:test:live
   ```
4. **CELEBRATE**: All systems operational! 🎉

---

## 💡 Pro Tips

1. **Batch Deploy**: Deploy all 4 in succession (takes ~5 minutes total)
2. **Monitor Console**: Keep console open to watch deployment status
3. **Copy File Paths**: Have the file paths ready before starting
4. **One at a Time**: Deploy each chaincode one at a time to avoid confusion
5. **Wait for Confirmation**: Don't close console until each deployment completes
6. **Take Screenshots**: Document successful deployments for records

---

## ❓ Questions?

If you encounter issues:

1. Check Kaleido documentation: https://docs.kaleido.io/
2. Review error messages in the console
3. Verify prerequisites are met
4. Try the troubleshooting section above
5. Contact Kaleido support if needed

---

**Ready to deploy?** 👉 Open https://console.kaleido.io and let's get started!

**Estimated total time**: ~15 minutes  
**Difficulty**: Easy  
**Risk level**: Low  

**Status**: Ready for Deployment ✨
