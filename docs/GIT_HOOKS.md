# Git Pre-Commit Hook Setup

## Overview

This project includes a pre-commit git hook that automatically runs Next.js and Cargo builds before each commit. This ensures that no broken code is ever committed to the repository, maintaining code quality and preventing CI/CD failures.

## Features

✅ **Automated Build Verification**
- Runs `npm run build` for Next.js
- Runs `npm run tauri:build` for Cargo/Rust
- Prevents commit if either build fails

✅ **Clear Feedback**
- Color-coded output for easy reading
- Detailed error messages from failed builds
- Last 30 lines of Next.js errors
- Last 50 lines of Cargo errors

✅ **Bypass Option**
- Can skip checks with `git commit --no-verify` if needed
- Useful for work-in-progress commits
- Still recommended to run builds manually

✅ **Cross-Platform**
- Works on macOS, Linux, and Git Bash on Windows
- Uses standard bash scripting
- No external dependencies beyond npm/cargo

## Installation

### Automatic Installation (Recommended)

After cloning the repository, run:

```bash
cd /Users/ari.asulin/dev/test/rust2
./scripts/setup-git-hooks.sh
```

### Manual Installation

If the script doesn't work, manually copy the hook:

```bash
# Copy the hook to .git/hooks
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit

# Make it executable
chmod +x .git/hooks/pre-commit
```

### Verify Installation

```bash
# Check if hook is installed
ls -la .git/hooks/pre-commit

# Should show:
# -rwxr-xr-x  ... pre-commit
```

## Usage

### Normal Workflow

Just commit as usual:

```bash
git add src/components/MyComponent.tsx
git commit -m "feat: add new component"
```

The pre-commit hook will:
1. Run Next.js build
2. Run Cargo/Tauri build
3. Allow commit if both succeed
4. Reject commit and show errors if either fails

### Example: Successful Commit

```
========================================
  Pre-Commit Build Verification
========================================

[1/2] Building Next.js application...

✓ Next.js build successful

[2/2] Building Rust project...

✓ Cargo build successful

========================================
✓ All builds passed!
✓ Commit allowed
========================================
```

### Example: Failed Commit

```
========================================
  Pre-Commit Build Verification
========================================

[1/2] Building Next.js application...

✗ Next.js build failed!

Build Output:
  Error: Failed to resolve module...
  
========================================
✗ Build verification failed!
✗ Commit rejected
========================================

To commit anyway, use:
  git commit --no-verify
```

## Bypassing the Hook

If you need to commit code that doesn't build (not recommended), use:

```bash
git commit --no-verify
```

**Note**: Use this sparingly! The hook exists to maintain code quality.

### Valid Reasons to Bypass

- Committing work-in-progress code for backup
- Committing documentation-only changes
- Committing configuration changes
- Emergency hotfix that needs immediate push

### Invalid Reasons to Bypass

- "I'll fix the build later" → No, fix it now
- "It's just a typo" → Then fix it before committing
- "CI/CD will catch it" → No, prevent problems proactively

## How It Works

### Build Process

1. **Hook Triggered**: When you run `git commit`, the hook executes
2. **Next.js Build**: Runs `npm run build`
   - Checks TypeScript compilation
   - Verifies React component syntax
   - Ensures no import errors
   - Output redirected to `/tmp/nextjs-build.log`

3. **Cargo Build**: Runs `npm run tauri:build`
   - Compiles Rust code
   - Checks type safety
   - Verifies all dependencies
   - Output redirected to `/tmp/cargo-build.log`

4. **Decision**:
   - **Both succeed**: Commit proceeds normally
   - **Either fails**: Commit is rejected, user sees error details

### Error Output

If a build fails, the hook shows:
- Which build failed (Next.js or Cargo)
- The last 30-50 lines of error output
- Instructions on how to bypass (if needed)

## Configuration

### Temporarily Disable Hook

```bash
# Disable temporarily
chmod -x .git/hooks/pre-commit

# Re-enable
chmod +x .git/hooks/pre-commit
```

### Modify Build Commands

Edit `.git/hooks/pre-commit` and change these lines:

```bash
# Current:
if npm run build > /tmp/nextjs-build.log 2>&1; then

# To use different command:
if npm run build:staging > /tmp/nextjs-build.log 2>&1; then
```

### Add Additional Checks

To add more checks (linting, tests), edit the hook:

```bash
# Step 3: Run Linting
echo -e "${YELLOW}[3/3]${NC} Running ESLint..."
if npm run lint > /tmp/lint.log 2>&1; then
    echo -e "${GREEN}✓${NC} Linting passed"
else
    echo -e "${RED}✗${NC} Linting failed!"
    cat /tmp/lint.log | tail -30
    BUILD_FAILED=1
fi
```

## Troubleshooting

### Hook Not Running

**Problem**: Commits proceed without running builds

**Solutions**:
```bash
# Check if hook exists
ls -la .git/hooks/pre-commit

# Check if executable
test -x .git/hooks/pre-commit && echo "Executable" || echo "Not executable"

# Make executable
chmod +x .git/hooks/pre-commit

# Run setup script
./scripts/setup-git-hooks.sh
```

### Hook Running Too Slowly

**Problem**: Pre-commit hook takes too long

**Reason**: Full builds can take 1-2 minutes

**Solutions**:
1. Optimize individual builds (see DEVELOPMENT.md)
2. Use incremental builds if available
3. Use `git commit --no-verify` for rapid prototyping (then run full build before push)

### Build Fails Locally But Passes in CI

**Problem**: Pre-commit hook rejects commit, but CI passes

**Causes**:
- Different build configuration
- Different Node/Rust versions
- Environment-specific issues

**Solutions**:
1. Check Node version: `node --version` (should be 18+)
2. Check Rust version: `rustc --version`
3. Clear caches: `rm -rf node_modules/.cache target/`
4. Reinstall: `npm ci && cargo update`

### "Command not found" Error

**Problem**: npm or cargo not in PATH

**Solutions**:
```bash
# Ensure Node is installed
which node
node --version

# Ensure Rust is installed
which cargo
cargo --version

# If not found, reinstall or add to PATH
```

## Integration with IDEs

### VS Code

If using VS Code's Git integration:

```json
// .vscode/settings.json
{
  "git.ignoreLimitWarning": true,
  "git.enableSmartCommit": false
}
```

The pre-commit hook still runs even when committing through VS Code UI.

### GitHub Desktop

The hook runs automatically. If a commit fails:
1. See error details in terminal
2. Fix the issues
3. Retry the commit

### Terminal

Works seamlessly with all command-line git clients.

## Best Practices

### 1. Test Before Committing

Run builds before committing to catch errors early:

```bash
# Build Next.js
npm run build

# Build Tauri/Cargo
npm run tauri:build

# Run tests
npm run test

# Then commit
git commit -m "feat: add feature"
```

### 2. Fix Errors Immediately

If pre-commit rejects your commit:
1. Read the error message
2. Fix the issue in your code
3. Commit again

**Don't use `--no-verify` unless absolutely necessary.**

### 3. Large Changes

For large refactors, commit incrementally:

```bash
# Break into logical commits
git add file1.ts file2.ts
git commit -m "refactor: update component A"

git add file3.ts file4.ts
git commit -m "refactor: update component B"
```

Each commit must build successfully.

### 4. WIP Commits (If Needed)

For work-in-progress, consider using WIP prefix:

```bash
git commit --no-verify -m "WIP: working on feature X

This is incomplete and should not be merged."
```

## Documentation

### Files

- `scripts/git-hooks/pre-commit` - The hook implementation
- `scripts/setup-git-hooks.sh` - Setup script for installation
- `.git/hooks/pre-commit` - Installed hook (auto-copied)
- `docs/GIT_HOOKS.md` - This documentation

### Related Documentation

- [BUILD_POLICY.md](BUILD_POLICY.md) - Build policy
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development setup
- [README.md](README.md) - Project overview

## Maintenance

### Updating the Hook

To update the hook for all developers:

1. Edit `scripts/git-hooks/pre-commit`
2. Commit changes: `git add scripts/git-hooks/pre-commit && git commit -m "chore: update pre-commit hook"`
3. Developers run: `./scripts/setup-git-hooks.sh`

### Monitoring Hook Usage

To see if developers are using `--no-verify`:

```bash
# Check recent commits for bypassed checks
git log --oneline -20 | grep "WIP\|--no-verify"
```

## Examples

### Example 1: Normal Commit (Build Passes)

```bash
$ git commit -m "feat: add user authentication"
========================================
  Pre-Commit Build Verification
========================================

[1/2] Building Next.js application...

✓ Next.js build successful

[2/2] Building Rust project...

✓ Cargo build successful

========================================
✓ All builds passed!
✓ Commit allowed
========================================

[main a1b2c3d] feat: add user authentication
 2 files changed, 45 insertions(+)
```

### Example 2: Commit Fails (TypeScript Error)

```bash
$ git commit -m "feat: add new component"
========================================
  Pre-Commit Build Verification
========================================

[1/2] Building Next.js application...

✗ Next.js build failed!

Build Output:
  error TS2322: Type 'string | undefined' is not assignable to type 'string'.
    at src/components/NewComponent/index.tsx:42:10

========================================
✗ Build verification failed!
✗ Commit rejected
========================================

To commit anyway, use:
  git commit --no-verify

# Developer fixes the error and retries
$ git commit -m "feat: add new component"
# (Hook runs again, this time succeeds)
```

### Example 3: Bypass Hook (Emergency)

```bash
$ git commit --no-verify -m "hotfix: emergency fix

This bypasses build checks for critical production fix."

[main x9y8z7w] hotfix: emergency fix
 1 file changed, 2 insertions(+)
```

## FAQ

### Q: Why does the hook run every commit?

**A**: To prevent broken code from being committed. It's better to catch errors early locally than in CI/CD.

### Q: Can I make the hook optional?

**A**: Yes, by not installing it or using `chmod -x .git/hooks/pre-commit`. Not recommended for team projects.

### Q: What if I'm working offline?

**A**: The hook still runs locally. npm and cargo work offline.

### Q: Can the hook check syntax only, not full builds?

**A**: Yes, edit `.git/hooks/pre-commit` to use `npm run type-check` instead of `npm run build`.

### Q: Does the hook affect performance?

**A**: Builds take 1-2 minutes. This is acceptable cost for preventing broken commits.

### Q: What about feature branches?

**A**: The hook runs on all branches. This is intentional to maintain code quality everywhere.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 2025 | Initial implementation |

---

**Status**: ✅ Active and Enforced

**Last Updated**: November 1, 2025

**Owner**: Development Team
