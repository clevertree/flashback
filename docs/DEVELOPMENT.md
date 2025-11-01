# Development Setup Guide

## Quick Start

### 0. Setup Git Hooks (First Time Only)

```bash
# After cloning, install git hooks
./scripts/setup-git-hooks.sh

# This ensures all commits pass build verification
# See docs/GIT_HOOKS.md for details
```

### 1. Setup Rust Backend

```bash
# Install dependencies
cargo build

# Run library tests
cargo test -p fabric-core

# Run CLI tests
cargo test -p fabric-cli
```

### 2. Setup Frontend

```bash
cd src-tauri
npm install
npm run build
```

### 3. Run Development Server

```bash
# Terminal 1: Start Next.js dev server
cd src-tauri
npm run dev

# Terminal 2: Start Tauri development
npm run tauri:dev
```

### 4. Run Tests

```bash
# Component tests
npm run test

# E2E tests
npm run cypress:open

# Rust tests
cargo test
```

## Project Dependencies

### Rust (Backend)

- **tokio**: Async runtime
- **tauri**: Desktop framework
- **serde**: Serialization
- **fabric-client**: Hyperledger Fabric bindings
- **openssl**: Cryptography
- **ring**: Modern cryptography library
- **webtorrent**: Torrent protocol
- **thiserror**: Error handling

### Node.js (Frontend)

- **next**: React framework
- **react**: UI library
- **typescript**: Type safety
- **tailwindcss**: Styling
- **zustand**: State management
- **axios**: HTTP client
- **jest**: Testing
- **cypress**: E2E testing

## Common Tasks

### Building for Production

```bash
# Build Tauri app (creates installers)
npm run tauri:build

# Build CLI binary only
cargo build --release -p fabric-cli
```

### Running Specific Tests

```bash
# Run single test file
npm run test -- KeyManagement.test.tsx

# Run Cypress with specific spec
npx cypress run --spec "cypress/e2e/app.cy.ts"

# Run Rust tests with output
cargo test -p fabric-core -- --nocapture
```

### Debugging

```bash
# Enable Rust debug logging
RUST_LOG=debug npm run tauri:dev

# Inspect Tauri webview
npm run tauri:dev  # Press F12 in window

# Node debug mode
NODE_DEBUG=* npm run dev
```

## Troubleshooting

### Tauri Build Issues

```bash
# Clear Tauri cache
cargo clean
rm -rf src-tauri/src-tauri/target

# Rebuild from scratch
npm run tauri:build
```

### Port Conflicts

```bash
# Change Next.js port
PORT=3001 npm run dev

# Change Tauri dev port in tauri.conf.json
```

### Missing Dependencies

```bash
# Update Rust dependencies
cargo update

# Update Node dependencies
npm update

# Clean install
npm ci
```

## Performance Tips

- Use `cargo build --release` for optimized binaries
- Enable incremental compilation: `CARGO_INCREMENTAL=1`
- Use `cargo-flamegraph` for profiling: `cargo install flamegraph`
- Profile Tauri app with DevTools: Right-click → Inspect

## VS Code Extensions (Recommended)

- Rust-analyzer
- Prettier
- ESLint
- Tailwind CSS IntelliSense
- Thunder Client (API testing)
