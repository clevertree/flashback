#!/usr/bin/env bash
set -euo pipefail

# End-to-end CLI test for Flashback
# - starts server on random port
# - starts two clients in --cli mode
# - client A connects to server, sends a #general message, enables allow auto
# - client B connects, parses client list to find A, connects to A and sends DCC message
# - verifies A received the message, then A replies, and verifies B got reply
# - shuts down all processes

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[cli-e2e] $*"; }

# Build server and client (debug)
log "Building server and client..."
cargo build --manifest-path server/Cargo.toml >/dev/null
cargo build --manifest-path client/src-tauri/Cargo.toml >/dev/null

SERVER_BIN="server/target/debug/server"
CLIENT_BIN="client/src-tauri/target/debug/client"

# Start server on random high port
PORT=$(( 20000 + (RANDOM % 20000) ))
log "Starting server on port ${PORT}..."
"$SERVER_BIN" "$PORT" > wdio-logs/cli-e2e-server.log 2>&1 &
SERVER_PID=$!
trap 'kill ${SERVER_PID} ${CLIENT_A_PID:-0} ${CLIENT_B_PID:-0} 2>/dev/null || true' EXIT

# Wait for server to be ready
for i in {1..50}; do
  if grep -q "Server is running" wdio-logs/cli-e2e-server.log 2>/dev/null; then
    break
  fi
  sleep 0.1
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    log "Server process exited unexpectedly"
    exit 1
  fi
  if [ $i -eq 50 ]; then
    log "Server did not start in time"
    exit 1
  fi
done

# Setup FIFOs and logs for clients
A_IN="wdio-logs/cli-e2e-clientA.in"; A_LOG="wdio-logs/cli-e2e-clientA.log"
B_IN="wdio-logs/cli-e2e-clientB.in"; B_LOG="wdio-logs/cli-e2e-clientB.log"
rm -f "$A_IN" "$B_IN" "$A_LOG" "$B_LOG"
mkfifo "$A_IN" "$B_IN"

# Start clients
log "Starting client A (CLI)..."
"$CLIENT_BIN" --cli <"$A_IN" >"$A_LOG" 2>&1 &
CLIENT_A_PID=$!
log "Starting client B (CLI)..."
"$CLIENT_BIN" --cli <"$B_IN" >"$B_LOG" 2>&1 &
CLIENT_B_PID=$!

sleep 0.5

# Helper: wait for pattern in a file with timeout
wait_for() {
  local file="$1"; shift
  local pattern="$1"; shift
  local timeout="${1:-10}"
  local start=$(date +%s)
  while true; do
    if grep -qE "$pattern" "$file"; then return 0; fi
    sleep 0.1
    if (( $(date +%s) - start > timeout )); then
      log "Timeout waiting for pattern '$pattern' in $file"
      return 1
    fi
  done
}

# Connect clients to server
log "Connecting client A to server..."
echo "connect-server 127.0.0.1:${PORT}" > "$A_IN"
wait_for "$A_LOG" "Connected to 127.0.0.1:${PORT}" 10
# Capture A peer listener port
wait_for "$A_LOG" "Peer listener started at 0.0.0.0:[0-9]+" 10
A_PEER_PORT=$(grep -Eo "Peer listener started at 0.0.0.0:[0-9]+" "$A_LOG" | tail -n1 | grep -Eo '[0-9]+$')
log "Client A peer port: $A_PEER_PORT"

# Send a channel message from A and enable auto allow
echo "send-channel general hello-from-A" > "$A_IN"
wait_for "$A_LOG" "Message sent" 10
# Expect potential prompt for allow; respond with allow auto proactively
sleep 0.2
log "Enabling auto-allow on A..."
echo "allow auto" > "$A_IN"
wait_for "$A_LOG" "Auto-allow enabled" 5 || true

# Connect client B
log "Connecting client B to server..."
echo "connect-server 127.0.0.1:${PORT}" > "$B_IN"
wait_for "$B_LOG" "Connected to 127.0.0.1:${PORT}" 10
# Capture B peer port
wait_for "$B_LOG" "Peer listener started at 0.0.0.0:[0-9]+" 10
B_PEER_PORT=$(grep -Eo "Peer listener started at 0.0.0.0:[0-9]+" "$B_LOG" | tail -n1 | grep -Eo '[0-9]+$')
log "Client B peer port: $B_PEER_PORT"

# Proceed to connect B->A directly (A listens on 0.0.0.0)
# From B, connect to A and send DCC message
log "B connecting to A peer and sending DCC message..."
echo "connect-peer 127.0.0.1:${A_PEER_PORT}" > "$B_IN"
wait_for "$B_LOG" "Connected to peer 127.0.0.1:${A_PEER_PORT}" 10
sleep 0.2
MSG1="hi-from-B"
echo "send-client 127.0.0.1:${A_PEER_PORT} ${MSG1}" > "$B_IN"

# Verify A receives the message (dcc-chat)
wait_for "$A_LOG" "\"text\": \"${MSG1}\"|DCC chat" 10 || wait_for "$A_LOG" "${MSG1}" 2

# A replies to B
MSG2="hello-back-from-A"
echo "send-client 127.0.0.1:${B_PEER_PORT} ${MSG2}" > "$A_IN"

# Verify B receives the reply
wait_for "$B_LOG" "\"text\": \"${MSG2}\"|DCC chat|hello-back-from-A" 10

# Exit both clients
echo "exit" > "$A_IN"
echo "exit" > "$B_IN"

sleep 0.5

# Final summary
log "E2E CLI test passed."
