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
  ├─ Builds Next.js app
  └─ Builds Rust/Tauri project
  ↓
If both succeed → Commit allowed ✓
If either fails → Commit rejected ✗
```

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
