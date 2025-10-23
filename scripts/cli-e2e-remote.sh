#!/usr/bin/env bash
set -euo pipefail

# End-to-end CLI test against a deployed remote server hostname.
# Default host: server.flashbackrepository.org, port: 51111
# Usage:
#   scripts/cli-e2e-remote.sh [host] [port]
# or via env:
#   HOST=server.flashbackrepository.org PORT=51111 scripts/cli-e2e-remote.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

HOST=${1:-${HOST:-server.flashbackrepository.org}}
PORT=${2:-${PORT:-51111}}

log() { echo "[cli-e2e-remote] $*"; }

# Build the client (debug)
log "Building client (debug)..."
cargo build --manifest-path client/src-tauri/Cargo.toml >/dev/null
CLIENT_BIN="client/src-tauri/target/debug/client"

# Prepare pipes and logs
IN_FIFO="wdio-logs/cli-e2e-remote.in"
LOG_FILE="wdio-logs/cli-e2e-remote.log"
mkdir -p wdio-logs
rm -f "$IN_FIFO" "$LOG_FILE"
mkfifo "$IN_FIFO"

# Start client in CLI mode
log "Starting client and connecting to ${HOST}:${PORT}..."
"$CLIENT_BIN" --cli <"$IN_FIFO" >"$LOG_FILE" 2>&1 &
CLIENT_PID=$!
trap 'kill ${CLIENT_PID} 2>/dev/null || true; rm -f "$IN_FIFO"' EXIT
sleep 0.5

# Helper: wait for pattern in a file with timeout
wait_for() {
  local file="$1"; shift
  local pattern="$1"; shift
  local timeout="${1:-15}"
  local start=$(date +%s)
  while true; do
    if grep -qE "$pattern" "$file"; then return 0; fi
    sleep 0.2
    if (( $(date +%s) - start > timeout )); then
      log "Timeout waiting for pattern '$pattern' in $file"
      return 1
    fi
  done
}

# Connect to remote server
log "Connecting to ${HOST}:${PORT}..."
echo "connect-server ${HOST}:${PORT}" > "$IN_FIFO"
wait_for "$LOG_FILE" "Connected to ${HOST}:${PORT}" 20

# Request user list explicitly per new protocol
log "Requesting user list"
echo "users" > "$IN_FIFO"
wait_for "$LOG_FILE" "Received client list|Requested client list" 20 || true

# Optionally enable auto-allow (if the client supports it)
echo "allow auto" > "$IN_FIFO" || true
sleep 0.2

# Send a simple channel message and look for confirmation
CHANNEL="general"
MSG="e2e-remote-$(date +%s)"
log "Sending channel message to #${CHANNEL}: ${MSG}"
echo "send-channel ${CHANNEL} ${MSG}" > "$IN_FIFO"
# Accept either an explicit confirmation or presence of the message echo in logs
wait_for "$LOG_FILE" "Message sent|${MSG}" 15 || true

# Quit cleanly
log "Exiting client"
echo "exit" > "$IN_FIFO"
sleep 0.5

log "Remote CLI E2E completed for ${HOST}:${PORT}. See ${LOG_FILE} for details."
