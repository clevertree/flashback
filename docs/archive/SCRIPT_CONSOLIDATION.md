# Script Consolidation and Organization Guide

## Overview
This document outlines the consolidation of shell scripts to reduce duplication and improve maintainability.

## Common Utilities Created

### e2e-common.sh
A shared library of common functions used by E2E test scripts.

**Location:** `scripts/e2e-common.sh`

**Exported Functions:**
- `info(msg)` - Print informational messages with [INFO] prefix
- `warn(msg)` - Print warning messages with [WARN] prefix
- `err(msg)` - Print error messages with [ERROR] prefix
- `success(msg)` - Print success messages with [✓] prefix
- `debug(msg)` - Print debug messages if DEBUG=1 is set
- `get_repo_root()` - Get the absolute path to the repository root
- `command_exists(cmd)` - Check if a command exists in PATH
- `wait_for_service(host, port, timeout)` - Wait for a TCP service to be ready
- `cleanup()` - Cleanup handler for temp files (override in calling scripts)
- `setup_cleanup_trap()` - Register cleanup on EXIT/INT/TERM signals

**Usage:**
```bash
#!/usr/bin/env bash
source scripts/e2e-common.sh

info "Starting test..."
if wait_for_service localhost 5000 30; then
  success "Server ready"
else
  err "Server not ready"
  exit 1
fi
```

## Script Organization

### E2E Test Scripts

#### cli-e2e.sh
**Purpose:** Run E2E CLI tests against a local server
**Uses:** e2e-common.sh
**To Update:**
1. Add `source "$(dirname "$0")/e2e-common.sh"` at the top
2. Replace custom logging functions with calls to e2e-common functions
3. Remove duplicate helper function definitions

#### cli-e2e-remote.sh
**Purpose:** Run E2E CLI tests against a remote server
**Uses:** e2e-common.sh
**To Update:**
1. Add `source "$(dirname "$0")/e2e-common.sh"` at the top
2. Replace custom logging with common functions
3. Extract hostname/port validation into a shared function

#### e2e-linux.sh
**Purpose:** Full E2E test suite on Linux
**Uses:** e2e-common.sh
**Current Issues:** Duplicates e2e-macos.sh logic
**To Update:**
1. Extract common test logic into separate functions
2. Add `source "$(dirname "$0")/e2e-common.sh"` at the top
3. Replace logging and helper functions with common ones
4. Create shared `run_e2e_tests()` function that works on both platforms

#### e2e-macos.sh
**Purpose:** Full E2E test suite on macOS
**Uses:** e2e-common.sh
**Current Issues:** Significant code duplication with e2e-linux.sh
**To Update:**
1. Extract common test logic into e2e-common.sh
2. Add `source "$(dirname "$0")/e2e-common.sh"` at the top
3. Keep only platform-specific logic
4. Share the test execution logic

### Setup and Maintenance Scripts

#### bump-versions.sh
**Purpose:** Bump version numbers in config files
**Status:** Legacy - verify if still used
**Recommendation:** Check if automated versioning has replaced this

## Recommended Refactoring Steps

### Phase 1: Create Shared Utilities
- [x] Create `e2e-common.sh` with standard logging and helper functions
- [ ] Create `test-utils.sh` for shared test execution logic (future)

### Phase 2: Update E2E Scripts
- [ ] Update `cli-e2e.sh` to use `e2e-common.sh`
- [ ] Update `cli-e2e-remote.sh` to use `e2e-common.sh`
- [ ] Update `e2e-linux.sh` to use `e2e-common.sh`
- [ ] Update `e2e-macos.sh` to use `e2e-common.sh`

### Phase 3: Extract Common Test Logic
- [ ] Identify test patterns common to linux/macos scripts
- [ ] Create `test-utils.sh` with shared test execution
- [ ] Update e2e-linux.sh and e2e-macos.sh to use shared logic

### Phase 4: Clean Up Legacy Scripts
- [ ] Verify `bump-versions.sh` is still needed
- [ ] Remove scripts that are no longer used
- [ ] Document purpose of remaining legacy scripts

## Before/After Comparison

### Before (Duplicated)
```bash
# e2e-linux.sh
info() { echo -e "\033[36m[INFO]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[31m[ERROR]\033[0m $*"; }

# e2e-macos.sh
info() { echo -e "\033[36m[INFO]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
```

### After (Shared)
```bash
# All scripts
source "$(dirname "$0")/e2e-common.sh"
info "Message"
warn "Message"
```

## Testing the Refactoring

1. Run each script individually to verify output format is preserved
2. Verify error handling still works correctly
3. Check that cleanup handlers are still invoked
4. Verify DEBUG=1 enables debug output
5. Test with remote services to verify wait_for_service works

## Documentation

Each script should have a header comment explaining:
- Purpose of the script
- Usage examples
- Required environment variables
- Exit codes and error handling
