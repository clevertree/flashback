# Git Hooks Setup Guide

## Quick Start

After cloning the repository, set up git hooks:

```bash
cd /Users/ari.asulin/dev/test/rust2
./scripts/setup-git-hooks.sh
```

That's it! The pre-commit hook is now active.

## What This Does

The pre-commit hook will run before each commit:

```
git commit -m "your message"
  ↓
[Pre-commit hook runs]
  ├─ Runs Jest unit tests (React components)
  ├─ Builds Next.js app
  ├─ Builds Rust/Tauri project
  └─ Runs Cargo tests (Rust library)
  ↓
If all pass → Commit allowed ✓
If any fail → Commit rejected ✗
```

## What Gets Checked

### Unit Tests (Jest)
- React component tests from `src/__tests__/`
- Must pass before commit allowed
- Run with: `npm run test`

### Next.js Build
- Compiles React/TypeScript code
- Optimizes static content
- Must succeed before commit allowed
- Run with: `npm run build`

### Rust Build (Cargo)
- Compiles all Rust crates (fabric-core, fabric-cli, src-tauri)
- Links dependencies
- Must succeed before commit allowed
- Run with: `npm run tauri:build`

### Cargo Tests
- Unit tests for Rust code
- Tests in `crates/fabric-core/src/`
- Must pass before commit allowed
- Run with: `cargo test --lib`

## Verify Installation

```bash
ls -la .git/hooks/pre-commit
```

Should show: `-rwxr-xr-x ... pre-commit`

## Skip Checks (If Needed)

```bash
git commit --no-verify  # Skip build checks
```

## More Information

See [docs/GIT_HOOKS.md](../docs/GIT_HOOKS.md) for complete documentation.
