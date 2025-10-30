# Unused Code Inventory

**Last Updated:** October 30, 2025

This document tracks files, components, functions, and source code that appear to be unnecessary, unused, or deprecated in the Flashback codebase.

## React Components

### Components Without Tests

The following React components exist but do not have corresponding Cypress component tests:

| Component | Location | Usage Status | Notes |
|-----------|----------|--------------|-------|
| ErrorBoundary | `client/src/components/ErrorBoundary/` | Used (6 references) | Generic error boundary wrapper; has no dedicated test |
| LogsSection | `client/src/components/LogsSection/` | Minimal usage (2 references) | Displays logs; no dedicated test; appears to be used primarily for debugging |
| InstructionsSection | `client/src/components/InstructionsSection/` | Used in main app | No dedicated test file |

### Test Files Needing Verification

The following test files exist in `client/cypress/test/` but may need to be verified for active maintenance:

- `dcc_chatroom.cy.ts` - Very minimal test (154 lines) for a large component (951 lines)
- `chat_section.cy.ts` - Minimal test (141 lines) for a significant component (123 lines in ChatSection.ts)

## Large Files (Candidates for Decomposition)

Files exceeding 700+ lines that should be considered for decomposition:

| File | Lines | Location | Recommended Action |
|------|-------|----------|-------------------|
| main.rs | 2876 | `client/src-tauri/src/main.rs` | Break into modules: tauri_commands.rs, key_management.rs, cert_operations.rs, ui_handlers.rs |
| DccChatroom | 951 | `client/src/components/DccChatroom/DccChatroom.ts` | Extract file transfer logic, stream handling, and UI into separate components |

## Scripts

### Potential Duplications and Consolidation Opportunities

| Script | Purpose | Related Scripts | Consolidation Notes |
|--------|---------|-----------------|-------------------|
| `cli-e2e.sh` | E2E CLI tests | `cli-e2e-remote.sh` | Both test CLI; could share common utility functions |
| `e2e-linux.sh` | Linux E2E tests | `e2e-macos.sh` | Significant code duplication; both define similar helper functions (info, warn, err) and share test logic; could extract common functions |

### Scripts with Potential Legacy Status

- `bump-versions.sh` - May be superseded by automated versioning; verify if actively maintained

### ✓ RETIRED: Docker and AWS/CDK Infrastructure (Removed)

The following files have been removed as they are no longer used:

**Docker-related:**
- ✓ `docker-build.sh` - REMOVED
- ✓ `docker-test.sh` - REMOVED
- ✓ `docker-utils.sh` - REMOVED
- ✓ `test-server-docker.sh` - REMOVED
- ✓ `client/Dockerfile` - REMOVED

**AWS/CDK Infrastructure:**
- ✓ `cleanup-autoscaling.sh` - REMOVED (ECS/CDK cleanup, no longer needed)
- ✓ AWS CDK infrastructure references from README.md - REMOVED
- ✓ AWS DNS/NLB/Fargate documentation - REMOVED

## Unused Imports and Dependencies

### Potential Unused Files

The following files appear to have minimal or no usage:

- `client/public/` - Next.js public directory may contain unused assets
- `server/public/` - Contains default Next.js assets (file.svg, globe.svg, next.svg, vercel.svg, window.svg) that are likely unused in the application

### Configuration Files

- `server/next.config.ts` - Contains only a comment; minimal configuration
- `client/tailwind.config.js` - Standard Tailwind config; verify if all utilities are used

## Database/Model Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `server/db/models.ts` | 127 | Review needed | Verify all exported models are actively used |
| `server/db/keyUtils.ts` | TBD | Review needed | Crypto utility functions; verify all are used |

## Build and Configuration

### Unused or Minimal Configuration

- `client/src-tauri/Cargo.toml` - Contains dependencies; verify all are used (e.g., all tauri plugins, cryptography libraries)
- `server/cypress.config.ts` - Cypress configuration; verify tests are actively run
- `client/cypress.config.ts` - Cypress configuration; verify component tests are actively run

## API Routes

### Server API Routes

All server API routes appear to be in use:
- `/api/register`
- `/api/broadcast/ready`
- `/api/broadcast/lookup`
- `/api/repository/list`
- `/api/health`
- `/api/test/reset-db` (Test-only route; should be removed from production builds)

## Recommendations

### Priority 1: Immediate Action
1. **✓ COMPLETED: Remove Docker references** - All Docker files and references have been removed
2. **✓ COMPLETED: Remove AWS/CDK infrastructure** - All AWS/CDK files and references have been removed
3. **Create tests for components without tests** - ErrorBoundary, LogsSection, InstructionsSection
4. **Consolidate E2E shell scripts** - Extract common functions from `e2e-linux.sh` and `e2e-macos.sh`
5. **Verify legacy scripts** - Determine if `bump-versions.sh` is still needed

### Priority 2: Medium-term Refactoring
1. **Decompose DccChatroom.tsx** - Split into smaller, focused components (file transfer, stream handling, UI)
2. **Modularize main.rs** - Extract Tauri command handlers into separate modules
3. **Clean up public assets** - Remove unused SVGs and assets from `server/public/` and `client/public/`

### Priority 3: Long-term Maintenance
1. **Audit dependencies** - Verify all Cargo.toml and package.json dependencies are used
2. **Review test coverage** - Expand minimal test files (dcc_chatroom.cy.ts, chat_section.cy.ts)
3. **Document configuration** - Add comments to configuration files explaining their purpose

## Related Documentation

- **LARGE_FILE_DECOMPOSITION.md** - Detailed plan for breaking down DccChatroom (951 lines) and main.rs (2876 lines)
- **SCRIPT_CONSOLIDATION.md** - Plan for consolidating E2E and utility scripts, including new e2e-common.sh shared utilities

## Tracking

- [x] Create unused code inventory file
- [x] Create missing component tests
- [x] Remove Docker files and references
- [x] Remove AWS/CDK infrastructure files and references
- [x] Create common script utilities (e2e-common.sh)
- [x] Document large file decomposition strategies
- [x] Create script consolidation plan
- [ ] Update individual E2E scripts to use e2e-common.sh
- [ ] Verify/retire legacy scripts (bump-versions.sh)
- [ ] Begin DccChatroom decomposition
- [ ] Modularize main.rs
- [ ] Clean up unused public assets
