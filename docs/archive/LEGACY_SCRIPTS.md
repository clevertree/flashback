# Legacy Scripts Reference

This document lists scripts that are no longer in active use or have been superseded.

## Deprecated Scripts

### bump-versions.sh
**Status:** ⚠️ DEPRECATED (not removed, but no longer used)
**Purpose:** Manually bump version numbers in package.json and Cargo.toml
**Why Deprecated:** 
- AWS/CDK infrastructure removed (was used in deploy workflow)
- Manual versioning is not preferred in modern development
- Consider using automated semantic versioning tools if needed

**If you need to restore this:**
- The script is still available at `scripts/bump-versions.sh`
- It bumps patch versions in both client and server files
- Usage: `scripts/bump-versions.sh`

### generate_keys_from_client.sh
**Status:** ⏸️ POTENTIALLY NEEDED (verify usage)
**Purpose:** Generate test fixtures (certificates) from client CLI
**When to Use:** During test setup if you need to generate fresh certificates
**Verification Needed:** Confirm if this is still used in Cypress tests or E2E tests

**Usage:** `scripts/generate_keys_from_client.sh`

## Removed Infrastructure

The following infrastructure-specific scripts have been removed as AWS/CDK infrastructure is no longer used:

- ✓ `docker-build.sh` - REMOVED
- ✓ `docker-test.sh` - REMOVED  
- ✓ `docker-utils.sh` - REMOVED
- ✓ `test-server-docker.sh` - REMOVED
- ✓ `cleanup-autoscaling.sh` - REMOVED
- ✓ `client/Dockerfile` - REMOVED

## Still Active Scripts

### E2E Testing Scripts
- `scripts/cli-e2e.sh` - Local E2E testing (macOS/Linux)
- `scripts/cli-e2e-remote.sh` - Remote server testing
- `scripts/e2e-linux.sh` - Full E2E suite on Linux
- `scripts/e2e-macos.sh` - Full E2E suite on macOS
- `scripts/e2e-win.ps1` - Full E2E suite on Windows
- `scripts/e2e-common.sh` - Shared utilities (NEW)

### Build & Setup
- `scripts/setup.sh` - Initial project setup
- `scripts/run.sh` - Build status report

## CI/CD Updates

### Updated: deploy-server.yml
The GitHub Actions workflow has been updated to:
- Remove AWS/CDK deployment steps
- Remove Docker build and push steps
- Focus on building and testing Rust server and client
- Use standard Rust toolchain

**New Workflow Steps:**
1. Install Rust toolchain
2. Build server (release mode)
3. Run server tests
4. Build client
5. Run client tests
6. Build Tauri binary

## Recommendations

1. **For Version Management:** Consider using automated tools like:
   - `cargo-release` for Rust projects
   - GitHub Actions Release automation
   - Semantic versioning standards

2. **For Test Key Generation:** Decide whether `generate_keys_from_client.sh` is still needed:
   - Check if Cypress tests reference it
   - If needed, document its usage
   - If not needed, mark it as REMOVED

3. **For Build/Release:** Use the updated GitHub Actions workflow instead of manual scripts
