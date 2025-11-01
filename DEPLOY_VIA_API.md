# 🚀 API-Based Kaleido Deployment Guide

**Deploy chaincodes directly via REST API - no UI interaction required!**

---

## 📋 Overview

This guide shows how to deploy Hyperledger Fabric chaincodes to Kaleido using the **Consortium REST API** instead of manually using the Kaleido Console UI.

**Key Features**:
- ✅ Fully automated via REST API
- ✅ No manual Console steps
- ✅ Scriptable & CI/CD ready
- ✅ Can deploy multiple chaincodes
- ✅ Complete error handling

---

## 🔑 Step 1: Get Consortium API Credentials

You need two things from Kaleido:

1. **API Key** - Your authentication username
2. **API Secret** - Your authentication password

### How to Get Your Credentials

1. **Log in to Kaleido**: https://console.kaleido.io
2. **Go to Settings** (top right menu)
3. **Click "API Keys"** or **"Consortium API"**
4. **Create New API Key** (if you don't have one)
5. **Copy the values**:
   - `API Key ID` → use as `KALEIDO_API_KEY`
   - `API Secret` → use as `KALEIDO_API_SECRET`

⚠️ **Important**: Keep these secret! They have full access to your network.

---

## 📝 Step 2: Update .env.local

Add these lines to your `.env.local` file:

```bash
# Existing variables (should already be there)
KALEIDO_REST_GATEWAY=https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io
KALEIDO_APP_ID=u0hjwp2mgt
KALEIDO_APP_PASSWORD=FZ_uU_KTzqLevq8mWWjxMUahqcKxAc0me_qUjKqDAa0
KALEIDO_CHANNEL_NAME=default-channel

# NEW: Consortium API credentials
KALEIDO_ORG_ID=u0inmt8fjp
KALEIDO_ENV_ID=u0inmt8fjp
KALEIDO_API_KEY=<your_api_key_from_kaleido>
KALEIDO_API_SECRET=<your_api_secret_from_kaleido>

# Optional: API URLs (defaults provided)
KALEIDO_CONSORTIUM_API=https://api.kaleido.io/api/v1
```

**Example**:
```bash
KALEIDO_API_KEY=u0k9p8m7n6o5l4
KALEIDO_API_SECRET=abc123def456ghi789jkl012mno345pqr678stu
```

---

## ✅ Step 3: Verify Configuration

Test that your configuration is correct:

```bash
npm run check:kaleido
```

Expected output:
```
✓ Environment Configuration loaded
✓ REST Gateway accessible
✓ Consortium API credentials configured
```

---

## 🚀 Step 4: Deploy via API

### Dry Run (Test without making changes)

```bash
npm run deploy:api:dry
```

This will:
- ✓ Load configuration
- ✓ Check chaincode binaries
- ✓ Validate API credentials
- ✓ Show what would be deployed
- ✗ NOT actually deploy anything

### Full Deployment

```bash
npm run deploy:api
```

This will:
1. **Build chaincodes** - Compile any missing binaries
2. **Upload** - Send chaincode to Kaleido API
3. **Install** - Install on peers
4. **Instantiate** - Deploy on channel
5. **Test** - Verify deployment works

**Expected Output**:
```
╔═══════════════════════════════════════════════════════╗
║   🚀 Kaleido API-Based Chaincode Deployment 🚀       ║
║   Using Consortium API - No UI Interaction Required   ║
╚═══════════════════════════════════════════════════════╝

📋 Configuration:
  REST Gateway: https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io
  Consortium API: https://api.kaleido.io/api/v1
  Organization: u0inmt8fjp
  Environment: u0inmt8fjp
  Channel: default-channel
  Chaincodes: movie

═══════════════════════════════════════════════════════
📋 DEPLOYMENT PHASE
═══════════════════════════════════════════════════════

▶️  DEPLOYING: movie@1.0.0
─────────────────────────────────────────────────────

📤 Uploading movie...
  ✓ Uploaded successfully
    Size: 18.5MB
    Chaincode ID: movie-1.0.0

🔧 Installing movie...
  ✓ Installation initiated
    Task ID: u0abc123def456

🚀 Instantiating movie on default-channel...
  ✓ Instantiation initiated
    Transaction ID: u0xyz789abc123

🧪 Testing movie...
  ✓ Chaincode is responding

═══════════════════════════════════════════════════════
✨ DEPLOYMENT COMPLETE
═══════════════════════════════════════════════════════

📝 Next steps:
  1. Wait 60-120 seconds for all operations to complete
  2. Verify: npm run check:kaleido
  3. Test: npm run cli:test:live
  4. Monitor: https://console.kaleido.io
  5. Query manually: npm run cli:dev -- query-all --format table
```

---

## ⏱️ Timeline

| Step | Time | Notes |
|------|------|-------|
| Upload | 5-10s | Uploads binary to API |
| Install | 10-30s | Installs on peers |
| Instantiate | 30-60s | Deploys on channel |
| Test | 5-10s | Verifies connectivity |
| **Total** | **~2-3 min** | Fully deployed |

---

## ✅ Verification

### Check Deployment Status

```bash
npm run check:kaleido
```

Expected:
```
✓ movie is deployed
✓ REST Gateway is responding
✓ Chaincode is ready for queries
```

### Run Live Tests

```bash
npm run cli:test:live
```

Expected:
```
PASS __tests__/cli-e2e.test.mjs (2500ms)
  ✓ CLI Tests
    ✓ all 23 tests passing
```

### Test Manually

```bash
# Query all movies
npm run cli:dev -- query-all

# Search for a movie
npm run cli:dev -- search-title "Inception"

# With table formatting
npm run cli:dev -- query-all --format table

# Check health
npm run cli:dev -- health
```

---

## 🔍 How the API Deployment Works

### 1. Upload Phase
```
Your Binary (18.5MB)
        ↓
POST to Consortium API
        ↓
Stored in Kaleido
```

### 2. Install Phase
```
Kaleido Chaincodes Storage
        ↓
Install on Peer0 (async)
        ↓
Ready for transactions
```

### 3. Instantiate Phase
```
Installed Chaincode
        ↓
Instantiate on Channel (async)
        ↓
Initialize state (runs `init` function)
```

### 4. Test Phase
```
REST Gateway Query
        ↓
Call QueryAll function
        ↓
Verify response
```

---

## 🆘 Troubleshooting

### Issue: "401 Unauthorized"
**Cause**: Invalid API credentials

**Solution**:
1. Verify `KALEIDO_API_KEY` and `KALEIDO_API_SECRET` in `.env.local`
2. Check credentials in Kaleido Console Settings
3. Ensure credentials haven't expired

```bash
# Test credentials
curl -X GET https://api.kaleido.io/api/v1/organizations \
  -H "Authorization: Bearer YOUR_KEY:YOUR_SECRET"
```

### Issue: "404 Not Found"
**Cause**: Invalid organization or environment ID

**Solution**:
1. Verify `KALEIDO_ORG_ID` and `KALEIDO_ENV_ID`
2. Check against Kaleido Console URL structure
3. Format should be like: `u0inmt8fjp`

### Issue: "Chaincode already exists"
**Cause**: Trying to install/instantiate an existing chaincode

**Solution**: Normal behavior! The script handles this gracefully.
- If installing: Skips to instantiation
- If instantiating: Skips to testing
- No action needed

### Issue: "Timeout after 30000ms"
**Cause**: Kaleido API is slow or unreachable

**Solution**:
1. Check internet connection
2. Verify REST Gateway is accessible: `curl https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io`
3. Try again after a few seconds
4. Check Kaleido Console for service status

### Issue: "Binary not found"
**Cause**: Chaincode wasn't built

**Solution**:
```bash
cd chaincode/movie
go build -o movie-chaincode .
cd ../..

# Then try deployment again
npm run deploy:api
```

---

## 🔄 Multiple Deployments

To deploy additional chaincodes:

1. **Add to script**: Edit `scripts/deploy-api.mjs`
   ```javascript
   const chaincodes = [
     { name: 'movie', version: '1.0.0', path: 'chaincode/movie', language: 'golang' },
     { name: 'tvshow', version: '1.0.0', path: 'chaincode/tvshow', language: 'golang' },
     { name: 'games', version: '1.0.0', path: 'chaincode/games', language: 'golang' },
   ];
   ```

2. **Run deployment**:
   ```bash
   npm run deploy:api
   ```

3. **Each chaincode will**:
   - Build if needed
   - Upload to API
   - Install on peers
   - Instantiate on channel
   - Verify deployment

---

## 🎯 Production Workflow

### Development
```bash
# Test locally
npm run cli:test

# Deploy to dev Kaleido
npm run deploy:api
```

### Staging
```bash
# Full test suite
npm run cli:test:live

# Monitor
npm run check:kaleido
```

### Production
```bash
# Same commands, different credentials in .env.local
npm run deploy:api
npm run cli:test:live
```

---

## 📊 What Gets Deployed

| Component | Size | Status |
|-----------|------|--------|
| movie-chaincode | 18.5MB | Ready |
| tvshow-chaincode | - | Optional |
| games-chaincode | - | Optional |
| voting-chaincode | - | Optional |

---

## 🔐 Security Notes

- ✅ API credentials stored locally in `.env.local` (not committed)
- ✅ HTTPS used for all API calls
- ✅ Credentials transmitted securely
- ✅ No secrets in git history
- ✅ Binary data encoded in base64

---

## 📚 API Reference

### Upload Chaincode
```
POST /organizations/{orgId}/environments/{envId}/chaincodes
Body: { name, version, language, chaincode (base64) }
```

### Install Chaincode
```
POST /organizations/{orgId}/environments/{envId}/chaincodes/{name}/install
Body: { peers: [], version }
```

### Instantiate Chaincode
```
POST /organizations/{orgId}/environments/{envId}/channels/{channel}/chaincodes
Body: { chaincode_name, chaincode_version, init_args, init_function }
```

---

## ✨ Next Steps

1. **Get Consortium API Credentials** from Kaleido Console
2. **Add to .env.local** (as shown above)
3. **Run**: `npm run deploy:api:dry` (test)
4. **Run**: `npm run deploy:api` (deploy)
5. **Verify**: `npm run check:kaleido`
6. **Test**: `npm run cli:test:live`

---

**Ready?** 🚀

```bash
npm run deploy:api
```

**All done in 2-3 minutes, no manual Console steps required!**
