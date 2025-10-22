#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

info() { echo -e "\033[36m[INFO]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[31m[ERROR]\033[0m $*"; }

BUILD=false
if [[ "${1:-}" == "--build" ]]; then BUILD=true; fi

info "Checking prerequisites (Rust/cargo, Node/npm)"
if ! command -v cargo >/dev/null 2>&1; then
  warn "cargo not found. Install Rust toolchain: https://rustup.rs"
fi
if ! command -v node >/dev/null 2>&1; then
  err "node not found. Install from your distro or https://nodejs.org/"; exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  err "npm not found. Install Node.js which includes npm"; exit 1
fi

info "Installing client dependencies if needed"
pushd "$REPO_ROOT/client" >/dev/null
if [[ -d node_modules ]]; then
  info "node_modules present — running npm install (fast)"
  npm install --no-audit --no-fund
else
  info "node_modules missing — running npm ci"
  npm ci --no-audit --no-fund
fi
popd >/dev/null

DRIVER_PORT=4551
export TAURI_DRIVER_PORT="$DRIVER_PORT"

if ! command -v tauri-driver >/dev/null 2>&1; then
  if command -v cargo >/dev/null 2>&1; then
    info "Installing tauri-driver via cargo"
    cargo install tauri-driver
  else
    err "tauri-driver not found and cargo missing. Install binary: https://github.com/tauri-apps/tauri-driver/releases or install Rust/cargo."; exit 1
  fi
fi

info "Starting tauri-driver on port $DRIVER_PORT"
(tauri-driver --port "$DRIVER_PORT" >/tmp/tauri-driver.log 2>&1 &) 
DRIVER_PID=$!
sleep 1
cleanup() {
  info "Stopping tauri-driver (PID=$DRIVER_PID)"
  kill "$DRIVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

if $BUILD; then
  info "Building Tauri app (debug)"
  pushd "$REPO_ROOT/client" >/dev/null
  npx tauri build --debug
  popd >/dev/null
  APP_PATH="$REPO_ROOT/client/src-tauri/target/debug/client"
  if [[ ! -f "$APP_PATH" ]]; then err "Built app not found at $APP_PATH"; exit 1; fi
  export APP_PATH
  unset TAURI_RUNNER TAURI_RUNNER_ARGS
  info "Using APP_PATH=$APP_PATH"
else
  export TAURI_RUNNER=npm
  export TAURI_RUNNER_ARGS='["run","tauri:dev"]'
  unset APP_PATH
  info "Using runner: TAURI_RUNNER=$TAURI_RUNNER TAURI_RUNNER_ARGS=$TAURI_RUNNER_ARGS"
fi

info "Running WebdriverIO E2E"
pushd "$REPO_ROOT/client" >/dev/null
npm run e2e
popd >/dev/null
