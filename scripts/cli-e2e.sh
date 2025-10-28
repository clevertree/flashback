#!/usr/bin/env bash
set -euo pipefail

# End-to-end CLI test for Flashback (Next.js server)
# - Runs Cypress component tests first if available (server/npm)
# - Ensures Next.js server is available on :8080 (spawns if missing)
# - Starts two clients in --cli mode; clients generate their own certs via --gen-cert
# - Enables auto-allow on A and FAILS if not observed in logs
# - Registers clients via /api/register using their generated certs (no fixtures)
# - Client A announces its peer socket via /api/broadcast/ready
# - Client B looks up A via /api/broadcast/lookup, connects to A and sends DCC
# - Verifies two-way messages, then shuts down all processes
# - Runs Cypress E2E at the end

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p wdio-logs

log() { echo "[cli-e2e] $*"; }

CLIENT_BIN="client/src-tauri/target/debug/client"
NEXT_PORT=8080
NEXT_BASE="http://127.0.0.1:${NEXT_PORT}"
SERVER_STARTED=0
SERVER_PID=0

# Helper: wait for URL to return 200-399
wait_for_url() {
  local url="$1"; shift
  local timeout="${1:-30}"
  local start=$(date +%s)
  while true; do
    if curl -s -o /dev/null -w '%{http_code}' "$url" | grep -qE '^(2|3)[0-9]{2}$'; then
      return 0
    fi
    sleep 0.2
    if (( $(date +%s) - start > timeout )); then
      log "Timeout waiting for URL: $url"
      return 1
    fi
  done
}

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

# Check if Next.js server is already running on 8080; if not, start it
log "Checking Next.js server on :${NEXT_PORT}..."
if ! curl -s -o /dev/null -w '%{http_code}' "${NEXT_BASE}" | grep -qE '^(2|3|4|5)[0-9]{2}$'; then
  log "Spawning Next.js server on :${NEXT_PORT}..."
  (
    cd server
    npm run dev:8080
  ) > wdio-logs/cli-e2e-next.log 2>&1 &
  SERVER_PID=$!
  SERVER_STARTED=1
  trap 'kill ${SERVER_PID:-0} ${CLIENT_A_PID:-0} ${CLIENT_B_PID:-0} 2>/dev/null || true' EXIT
  wait_for_url "${NEXT_BASE}" 60
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
"$CLIENT_BIN" --cli --start-listener --auto-allow --gen-cert="${EMAIL_A}" <"$A_IN" >"$A_LOG" 2>&1 &
CLIENT_A_PID=$!
log "Starting client B (CLI)..."
"$CLIENT_BIN" --cli --start-listener --gen-cert="${EMAIL_B}" <"$B_IN" >"$B_LOG" 2>&1 &
CLIENT_B_PID=$!

sleep 0.5

# Ensure listeners are started (send explicit command too)
echo "start-listener" > "$A_IN" || true
echo "start-listener" > "$B_IN" || true

# Capture peer listener ports via files written by client
A_PORT_FILE="peer-port-${CLIENT_A_PID}.txt"
B_PORT_FILE="peer-port-${CLIENT_B_PID}.txt"

for i in {1..200}; do [ -f "$A_PORT_FILE" ] && break; sleep 0.1; done
[ -f "$A_PORT_FILE" ] || { log "Timeout waiting for A port file: $A_PORT_FILE"; exit 1; }
A_PEER_PORT=$(cat "$A_PORT_FILE" | tr -d '\r\n')
log "Client A peer port: $A_PEER_PORT"

for i in {1..200}; do [ -f "$B_PORT_FILE" ] && break; sleep 0.1; done
[ -f "$B_PORT_FILE" ] || { log "Timeout waiting for B port file: $B_PORT_FILE"; exit 1; }
B_PEER_PORT=$(cat "$B_PORT_FILE" | tr -d '\r\n')
log "Client B peer port: $B_PEER_PORT"

# Auto-allow on A: must be observed in logs
sleep 0.2
log "Enabling auto-allow on A..."
echo "allow auto" > "$A_IN"
if ! wait_for "$A_LOG" "Auto-allow enabled" 5; then
  log "ERROR: Auto-allow confirmation not seen in A log within timeout. Dumping A log:";
  sed -n '1,200p' "$A_LOG" || true
  exit 1
fi

# Wait for PEM and PKH files written by clients
A_CERT_PATH="cert-${CLIENT_A_PID}.pem"
B_CERT_PATH="cert-${CLIENT_B_PID}.pem"
A_PKH_PATH="pkh-${CLIENT_A_PID}.txt"
B_PKH_PATH="pkh-${CLIENT_B_PID}.txt"

for i in {1..200}; do [ -f "$A_CERT_PATH" ] && break; sleep 0.1; done
[ -f "$A_CERT_PATH" ] || { log "Timeout waiting for A cert file: $A_CERT_PATH"; exit 1; }
for i in {1..200}; do [ -f "$B_CERT_PATH" ] && break; sleep 0.1; done
[ -f "$B_CERT_PATH" ] || { log "Timeout waiting for B cert file: $B_CERT_PATH"; exit 1; }
for i in {1..200}; do [ -f "$A_PKH_PATH" ] && break; sleep 0.1; done
[ -f "$A_PKH_PATH" ] || { log "Timeout waiting for A PKH file: $A_PKH_PATH"; exit 1; }
for i in {1..200}; do [ -f "$B_PKH_PATH" ] && break; sleep 0.1; done
[ -f "$B_PKH_PATH" ] || { log "Timeout waiting for B PKH file: $B_PKH_PATH"; exit 1; }

CERT_A=$(cat "$A_CERT_PATH")
CERT_B=$(cat "$B_CERT_PATH")
PKH_A=$(tr -d '\r\n' < "$A_PKH_PATH" | tr 'A-Z' 'a-z')
PKH_B=$(tr -d '\r\n' < "$B_PKH_PATH" | tr 'A-Z' 'a-z')
log "PKH_A=$PKH_A PKH_B=$PKH_B"

# Register both clients with the server
log 'Registering Client A via /api/register...'
STATUS_A=$(curl -s -o wdio-logs/registerA.json -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "{\"certificate\":$(node -e "console.log(JSON.stringify(process.argv[1]))" "$CERT_A")}" "${NEXT_BASE}/api/register")
if ! echo "$STATUS_A" | grep -qE '^(201|409)$'; then
  log "Register A failed: HTTP $STATUS_A Body=$(cat wdio-logs/registerA.json)"; exit 1; fi
log "Register A status: $STATUS_A"

log 'Registering Client B via /api/register...'
STATUS_B=$(curl -s -o wdio-logs/registerB.json -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "{\"certificate\":$(node -e "console.log(JSON.stringify(process.argv[1]))" "$CERT_B")}" "${NEXT_BASE}/api/register")
if ! echo "$STATUS_B" | grep -qE '^(201|409)$'; then
  log "Register B failed: HTTP $STATUS_B Body=$(cat wdio-logs/registerB.json)"; exit 1; fi
log "Register B status: $STATUS_B"

# Announce A via broadcast/ready
SOCKET_A="127.0.0.1:${A_PEER_PORT}"
log "Announcing A via /api/broadcast/ready as $SOCKET_A..."
READY_STATUS=$(curl -s -o wdio-logs/ready.json -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "{\"publicKeyHash\":\"${PKH_A}\",\"socket_address\":\"${SOCKET_A}\"}" "${NEXT_BASE}/api/broadcast/ready")
if ! echo "$READY_STATUS" | grep -qE '^(200|201)$'; then
  log "broadcast/ready failed with status $READY_STATUS; response: $(cat wdio-logs/ready.json)"; exit 1; fi

# Lookup A from B's perspective
log "Looking up A via /api/broadcast/lookup..."
LOOKUP_URL="${NEXT_BASE}/api/broadcast/lookup?publicKeyHash=${PKH_A}&minutes=10"
for i in {1..150}; do
  curl -s "$LOOKUP_URL" > wdio-logs/lookup.json || true
  if grep -q 'socket_address' wdio-logs/lookup.json; then break; fi
  sleep 0.2
  if [ $i -eq 150 ]; then log "A not found in broadcast lookup in time. Response: $(cat wdio-logs/lookup.json)"; exit 1; fi
done
A_SOCKET=$(node -e "const fs=require('fs');const t=fs.readFileSync('wdio-logs/lookup.json','utf8');try{const r=JSON.parse(t);const i=(r.items||[])[0];if(!i){process.exit(2)};console.log(i.socket_address)}catch(e){process.exit(3)}" || true)
[ -n "$A_SOCKET" ] || { log "Failed to parse A socket from lookup.json"; exit 1; }
log "Discovered A at ${A_SOCKET}"

# Connect B->A using discovered socket and send DCC message
log "B connecting to A peer and sending DCC message..."
echo "connect-peer ${A_SOCKET}" > "$B_IN"
wait_for "$B_LOG" "Connected to peer ${A_SOCKET}" 20
sleep 0.2
MSG1="hi-from-B"
echo "send-client ${A_SOCKET} ${MSG1}" > "$B_IN"

# Verify A receives the message (dcc-chat)
wait_for "$A_LOG" "\"text\":\s*\"${MSG1}\"|DCC chat|${MSG1}" 20

# A replies to B
MSG2="hello-back-from-A"
echo "send-client 127.0.0.1:${B_PEER_PORT} ${MSG2}" > "$A_IN"

# Verify B receives the reply
wait_for "$B_LOG" "\"text\":\s*\"${MSG2}\"|DCC chat|hello-back-from-A" 20

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
