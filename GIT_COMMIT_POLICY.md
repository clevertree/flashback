# Git Commit Policy - NO --no-verify Allowed

## Policy Statement

**ALL commits MUST pass pre-commit verification checks. The use of `--no-verify` flag is STRICTLY PROHIBITED.**

This policy ensures code quality, build integrity, and test coverage for all commits pushed to the repository.

---

## Enforcement Rules

### ❌ Prohibited
```bash
# NEVER use --no-verify
git commit --no-verify -m "message"
git commit -n -m "message"  # Short form also prohibited
```

### ✅ Allowed
```bash
# Always use standard commit
git commit -m "message"

# With signing (encouraged)
git commit -S -m "message"

# Interactive mode
git commit -i
```

---

## Pre-Commit Verification Checks

Before any commit is allowed, the following MUST pass:

### 1. Unit Tests
- **Command**: `npm run test -- --passWithNoTests`
- **Requirement**: All Jest tests must pass
- **Failure Impact**: Commit blocked until tests pass

### 2. Next.js Build
- **Command**: `npm run build`
- **Requirement**: Next.js must compile without errors
- **Failure Impact**: Commit blocked until build succeeds

### 3. Rust Build
- **Command**: `npm run tauri:build`
- **Requirement**: Cargo must build successfully
- **Failure Impact**: Commit blocked until build succeeds

### 4. Rust Tests
- **Command**: `cargo test --lib`
- **Requirement**: All Rust unit tests must pass
- **Failure Impact**: Commit blocked until tests pass

---

## What to Do When Commit is Rejected

### Step 1: Understand Why
The pre-commit hook will show detailed error messages:
```
✗ Build verification failed!
✗ Commit rejected

[Shows which step failed and error details]
```

### Step 2: Fix the Issues
- **Unit test failures**: Debug and fix the failing tests
- **TypeScript errors**: Fix compilation errors in Next.js
- **Rust build errors**: Fix compilation errors in Rust code
- **Rust test failures**: Debug and fix failing Rust tests

### Step 3: Verify Fixes Locally
```bash
# Run each check individually to verify:
npm run test -- --passWithNoTests
npm run build
npm run tauri:build
cargo test --lib
```

### Step 4: Stage Changes and Retry
```bash
git add -A
git commit -m "Your message"
```

---

## Common Issues and Solutions

### Issue: "Unit tests failed"
```bash
# View test output
npm run test -- --verbose

# Run tests in watch mode to debug
npm run test -- --watch

# Fix failing tests, then retry commit
```

### Issue: "Next.js build failed"
```bash
# Check for TypeScript errors
npm run build

# Review error messages in output
# Fix TypeScript errors in source files
# Retry commit
```

### Issue: "Cargo build failed"
```bash
# Check Rust build errors
cargo build

# View detailed error messages
cargo build --verbose

# Fix compilation errors
# Retry commit
```

### Issue: "Cargo tests failed"
```bash
# Run Rust tests to debug
cargo test --lib

# Fix test failures
# Retry commit
```

---

## Why This Policy?

### Code Quality
- Ensures all code compiles without errors
- Validates TypeScript type safety
- Prevents broken builds from reaching main branch

### Test Coverage
- Requires unit tests to pass before committing
- Maintains test suite integrity
- Catches regressions early

### Build Integrity
- Both Node.js and Rust builds must succeed
- Prevents compilation errors from being committed
- Ensures CI/CD pipeline success

### Project Health
- Maintains a clean git history
- Reduces debugging time
- Improves team productivity

---

## For Project Maintainers

### Updating Pre-Commit Hook

The pre-commit hook is located at:
```
.git/hooks/pre-commit
```

### Key Features
1. ✅ Shows progress (1/4, 2/4, etc.)
2. ✅ Color-coded output (green for pass, red for fail)
3. ✅ Shows detailed error output
4. ✅ Provides actionable next steps
5. ❌ Does NOT offer `--no-verify` workaround

### Modifying the Hook
To update checks, edit `.git/hooks/pre-commit` and ensure:
- All critical checks are included
- Error messages are clear and actionable
- Never suggest `--no-verify` as solution

---

## CI/CD Integration

### GitHub Actions
The same checks run in CI/CD:
```yaml
- name: Run Tests
  run: npm run test -- --passWithNoTests

- name: Build Next.js
  run: npm run build

- name: Build Rust
  run: npm run tauri:build

- name: Test Rust
  run: cargo test --lib
```

### Consistency
Local checks (pre-commit) match CI/CD checks to ensure:
- No surprises after pushing
- Failures caught early locally
- Same standards everywhere

---

## Exceptions - NONE

**There are NO exceptions to this policy.**

If you believe an exception is necessary, you must:
1. Create a GitHub issue explaining why
2. Get approval from project maintainers
3. Have the policy officially amended
4. Update all related documentation

**Temporary workarounds are not permitted.**

---

## Compliance Checklist

- [ ] I understand this policy
- [ ] I will NEVER use `--no-verify`
- [ ] I will fix build/test failures before committing
- [ ] I will use standard `git commit -m "message"`
- [ ] I will verify checks pass locally first
- [ ] I accept this as binding policy

---

## Questions?

If you have questions about this policy or need help with build failures:

1. **Check error messages**: Pre-commit hook provides detailed output
2. **Review this document**: Common issues section above
3. **Ask maintainers**: Create an issue or contact the team

---

## Policy Enforcement

- **Automated**: Pre-commit hook prevents violations
- **Manual**: Code review checks for `--no-verify` usage
- **CI/CD**: Same checks run, will fail if local checks were bypassed

---

**Last Updated**: November 1, 2025
**Status**: ACTIVE - Enforced for all commits
**Violations**: Will be reverted and require remediation
