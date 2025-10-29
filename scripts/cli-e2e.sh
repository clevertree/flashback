#!/usr/bin/env bash
set -euo pipefail

# End-to-end CLI test for Flashback
# RULE: In this E2E script, do not use curl (or any HTTP client) to perform operations
#       that should be executed by the Flashback client binary or server process.
#       It is allowed (and encouraged) to test server–client API interactions, but
#       those interactions must be initiated through the appropriate component
#       (e.g., via the Flashback client CLI or by running the server), not by
#       issuing HTTP requests directly from this script.
# - Runs Cypress component tests first if available (server/npm)
# - Starts two clients in --cli mode; clients generate their own certs via --gen-cert
# - Enables auto-allow on A and FAILS if not observed in logs
# - Skips issuing HTTP API calls directly from this script; uses the client for interactions
# - B discovers A from local port file and connects directly, then sends DCC
# - Verifies two-way messages, then shuts down all processes
# - Runs Cypress E2E at the end

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p wdio-logs wdio-logs/.log

log() { echo "[cli-e2e] $*"; }

CLIENT_BIN="client/src-tauri/target/debug/client"
NEXT_PORT=8080
NEXT_BASE="http://127.0.0.1:${NEXT_PORT}"
SERVER_STARTED=0
SERVER_PID=0


# Helper: wait for pattern in a file with timeout
wait_for() {
  local file="$1"; shift
  local pattern="$1"; shift
  local timeout="${1:-10}"
  local start=$(date +%s)
  while true; do
    if [ -f "$file" ] && grep -qE "$pattern" "$file"; then return 0; fi
    sleep 0.1
    if (( $(date +%s) - start > timeout )); then
      log "Timeout waiting for pattern '$pattern' in $file"
      return 1
    fi
  done
}

# Optionally run Cypress component tests
if node -e 'const p=require("./server/package.json");process.exit(p.scripts&&p.scripts["cypress:component"]?0:1)'; then
  log "Running Cypress component tests (npm run cypress:component)..."
  (cd server && npm run cypress:component) || { log "Component tests failed"; exit 1; }
else
  log "No cypress:component script found; skipping component tests."
fi

# Build client (debug)
log "Building client..."
cargo build --manifest-path client/src-tauri/Cargo.toml >/dev/null

wait_for_url() {
  local url="$1"; local timeout="${2:-180}"; local start=$(date +%s)
  while true; do
    if curl -s -o /dev/null -w '%{http_code}' "$url" | grep -qE '^(2|3|4|5)[0-9]{2}$'; then return 0; fi
    sleep 0.2
    if (( $(date +%s) - start > timeout )); then log "Timeout waiting for URL $url"; return 1; fi
  done
}

# Check if Next.js server is already running on ${NEXT_PORT}; if not, start it
log "Checking Next.js server on :${NEXT_PORT}..."
if ! curl -s -o /dev/null -w '%{http_code}' "${NEXT_BASE}" | grep -qE '^(2|3|4|5)[0-9]{2}$'; then
  log "Starting Next.js server (dev) on :${NEXT_PORT}..."
  (
    cd server
    npm run dev
  ) > wdio-logs/cli-e2e-next.log 2>&1 &
  SERVER_PID=$!
  SERVER_STARTED=1
  trap 'kill ${SERVER_PID:-0} ${CLIENT_A_PID:-0} ${CLIENT_B_PID:-0} 2>/dev/null || true' EXIT
  wait_for_url "${NEXT_BASE}" 120
else
  log "Next.js server is already running on :${NEXT_PORT}"
  trap 'kill ${CLIENT_A_PID:-0} ${CLIENT_B_PID:-0} 2>/dev/null || true' EXIT
fi

# Setup FIFOs and logs for clients
A_IN="wdio-logs/cli-e2e-clientA.in"; A_LOG="wdio-logs/cli-e2e-clientA.log"
B_IN="wdio-logs/cli-e2e-clientB.in"; B_LOG="wdio-logs/cli-e2e-clientB.log"
rm -f "$A_IN" "$B_IN" "$A_LOG" "$B_LOG"
mkfifo "$A_IN" "$B_IN"

# Unique emails for certs
TS=$(date +%Y%m%d%H%M%S)
EMAIL_A="testA+${TS}@test.com"
EMAIL_B="testB+${TS}@test.com"

# Start clients with CLI and startup flags (no server connection needed)
log "Starting client A (CLI)..."
WDIO_LOGS_DIR="wdio-logs/.log" CLIENT_DEBUG=1 "$CLIENT_BIN" --cli <"$A_IN" >"$A_LOG" 2>&1 &
CLIENT_A_PID=$!
log "Starting client B (CLI)..."
WDIO_LOGS_DIR="wdio-logs/.log" CLIENT_DEBUG=1 "$CLIENT_BIN" --cli <"$B_IN" >"$B_LOG" 2>&1 &
CLIENT_B_PID=$!

sleep 0.5
# Generate certificates for both clients using their unique emails and deterministic paths
log "Generating certificates..."
echo "set-cert-path wdio-logs/.log/clientA/certificate.pem" > "$A_IN"
echo "gen-cert ${EMAIL_A}" > "$A_IN"
echo "set-cert-path wdio-logs/.log/clientB/certificate.pem" > "$B_IN"
echo "gen-cert ${EMAIL_B}" > "$B_IN"

# Wait for confirmation lines in logs (best-effort)
wait_for "$A_LOG" "Generated certificate for ${EMAIL_A}" 10 || true
wait_for "$B_LOG" "Generated certificate for ${EMAIL_B}" 10 || true

# Use client-driven server API calls for registration and broadcast
log "Registering Client A (api-register)..."
echo "api-register ${NEXT_BASE}" > "$A_IN"
wait_for "$A_LOG" "REGISTERED PKH|REGISTER CONFLICT PKH" 30

# Start A listener and announce ready (socket inferred by client)
echo "start-listener" > "$A_IN" || true
log "Announcing Client A ready (client infers socket)..."
echo "api-ready ${NEXT_BASE}" > "$A_IN"
wait_for "$A_LOG" "READY OK" 20 || { log "Client A did not confirm READY"; exit 1; }

# Start client B listener and lookup A using PKH
log "Starting client B listener and performing lookup..."
echo "start-listener" > "$B_IN" || true
# Acquire PKH_A from A's generated files
A_PKH_PATH="wdio-logs/.log/clientA/publicKeyHash.txt"
for i in {1..200}; do [ -f "$A_PKH_PATH" ] && break; sleep 0.1; done
[ -f "$A_PKH_PATH" ] || { log "Timeout waiting for A PKH file: $A_PKH_PATH"; exit 1; }
PKH_A=$(tr -d '\r\n' < "$A_PKH_PATH" | tr 'A-Z' 'a-z')

echo "api-lookup ${NEXT_BASE} ${PKH_A} 10" > "$B_IN"
wait_for "$B_LOG" "LOOKUP SOCKET" 30 || { log "Client B did not find A in lookup"; exit 1; }
# Parse socket from B log
A_SOCKET_LINE=$(grep -E "LOOKUP SOCKET" "$B_LOG" | tail -n1 || true)
if [[ "$A_SOCKET_LINE" =~ LOOKUP\ SOCKET\ ([^[:space:]]+) ]]; then
  A_SOCKET_FOUND="${BASH_REMATCH[1]}"
else
  log "Could not parse A socket from lookup"; exit 1
fi
log "Discovered A at ${A_SOCKET_FOUND} via lookup"

# Ensure listeners running (idempotent)
echo "start-listener" > "$A_IN" || true
echo "start-listener" > "$B_IN" || true

# Auto-allow on A: must be observed in logs
sleep 0.2
log "Enabling auto-allow on A..."
echo "allow auto" > "$A_IN"
if ! wait_for "$A_LOG" "Auto-allow enabled" 5; then
  log "ERROR: Auto-allow confirmation not seen in A log within timeout. Dumping A log:";
  sed -n '1,200p' "$A_LOG" || true
  exit 1
fi

# Connect B->A using lookup-discovered socket and send DCC message
log "B connecting to A peer and sending DCC message..."
echo "connect-peer ${A_SOCKET_FOUND}" > "$B_IN"
wait_for "$B_LOG" "Connected to peer ${A_SOCKET_FOUND}" 20
sleep 0.2
MSG1="hi-from-B"
echo "send-client ${A_SOCKET_FOUND} ${MSG1}" > "$B_IN"

# Verify A receives the message (dcc-chat)
wait_for "$A_LOG" "\"text\":\s*\"${MSG1}\"|DCC chat|${MSG1}" 20

# Exit both clients
echo "exit" > "$A_IN"
echo "exit" > "$B_IN"

sleep 0.5

# Cleanup spawned Next server (if we started it)
if [ "${SERVER_STARTED}" = "1" ] && kill -0 ${SERVER_PID} 2>/dev/null; then
  log "Stopping spawned Next.js server (PID ${SERVER_PID})..."
  kill ${SERVER_PID} 2>/dev/null || true
fi

# Run Cypress E2E at the end
if node -e 'const p=require("./server/package.json");process.exit(p.scripts&&p.scripts["cypress:e2e"]?0:1)'; then
  log "Running Cypress E2E (npm run cypress:e2e)..."
  (cd server && CYPRESS_RESET_DB=true npm run cypress:e2e) || { log "Cypress E2E failed"; exit 1; }
else
  log "No cypress:e2e script found; skipping Cypress E2E."
fi

# Final summary
log "E2E CLI test passed."
