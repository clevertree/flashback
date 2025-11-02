# Deprecated Docker-Based Deployment Scripts

These scripts have been deprecated in favor of **direct Kaleido Console deployment**.

## Archived Scripts

1. **deploy-docker.sh** - Docker-based chaincode deployment
2. **deploy-with-docker.mjs** - Docker + Fabric CLI deployment wrapper
3. **deploy-direct-cli.sh** - Direct CLI deployment via Docker
4. **deploy-direct.mjs** - Alternative deployment methods (Docker-dependent)

## Why Deprecated?

The new deployment approach uses the **Kaleido Console** web interface to deploy chaincodes directly. This is:
- ✅ More reliable
- ✅ No Docker required
- ✅ No local dependencies
- ✅ Officially supported by Kaleido
- ✅ Better for production deployments

## Current Deployment Method

See: **[DEPLOY_ALL_CHANNELS.md](../../DEPLOY_ALL_CHANNELS.md)** and **[DEPLOY_LIVE_MANUAL.sh](../../DEPLOY_LIVE_MANUAL.sh)**

### Quick Start
1. Visit https://console.kaleido.io
2. Select network: `u0inmt8fjp`
3. Deploy each chaincode binary:
   - `chaincode/movie/movie-chaincode`
   - `chaincode/tvshow/tvshow-chaincode`
   - `chaincode/games/games-chaincode`
   - `chaincode/voting/voting-chaincode`
4. Verify: `npm run check:kaleido`

## If You Need Docker Deployment

If you have a use case that requires Docker-based deployment, these scripts are available here for reference and can be restored if needed.

---

**Status**: Archived on November 1, 2025  
**Reason**: Transition to Kaleido Console-based deployment
