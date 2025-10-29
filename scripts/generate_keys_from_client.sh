#!/usr/bin/env bash
set -euo pipefail

# Generate two certificates via the Flashback client CLI and write
# server/cypress/fixtures/keys.json with certPem/certPem2 and
# publicKeyHash/publicKeyHash2 (PKH as lowercase hex strings).
#
# This script launches two client instances in CLI mode, uses the
# built-in `gen-cert <email> [path]` command to create deterministic
# PEM files, reads the PKH files that the client writes to the logs dir,
# and then writes the fixture JSON.
#
# Output file:
#   server/cypress/fixtures/keys.json
#
# Notes:
# - No raw HTTP requests are made here; this purely uses client CLI.
# - All artifacts are written inside wdio-logs/.log as per project rules.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CLIENT_BIN="client/src-tauri/target/debug/client"
OUT_JSON="server/cypress/fixtures/keys.json"
LOGS_DIR="wdio-logs/.log"
A_DIR="${LOGS_DIR}/clientA"
B_DIR="${LOGS_DIR}/clientB"
A_CERT_PATH="${A_DIR}/certificate.pem"
B_CERT_PATH="${B_DIR}/certificate.pem"
A_IN="wdio-logs/genkeys-clientA.in"
B_IN="wdio-logs/genkeys-clientB.in"
A_LOG="wdio-logs/genkeys-clientA.log"
B_LOG="wdio-logs/genkeys-clientB.log"

log() { echo "[gen-keys] $*"; }

mkdir -p "$(dirname "$OUT_JSON")" wdio-logs "$LOGS_DIR"
rm -f "$A_IN" "$B_IN" "$A_LOG" "$B_LOG" "$A_CERT_PATH" "$B_CERT_PATH"
mkfifo "$A_IN" "$B_IN"

# Build the client (debug)
log "Building client..."
cargo build --manifest-path client/src-tauri/Cargo.toml >/dev/null

# Start two client processes in CLI mode
log "Starting client A..."
WDIO_LOGS_DIR="$LOGS_DIR" CLIENT_DEBUG=1 "$CLIENT_BIN" --cli <"$A_IN" >"$A_LOG" 2>&1 &
A_PID=$!
log "Starting client B..."
WDIO_LOGS_DIR="$LOGS_DIR" CLIENT_DEBUG=1 "$CLIENT_BIN" --cli <"$B_IN" >"$B_LOG" 2>&1 &
B_PID=$!

cleanup() {
  kill ${A_PID:-0} ${B_PID:-0} 2>/dev/null || true
  rm -f "$A_IN" "$B_IN" || true
}
trap cleanup EXIT

# Helper: wait for a file to appear
wait_for_file() { local f=$1 t=${2:-10}; local s=$(date +%s); while [ ! -f "$f" ]; do sleep 0.1; if (( $(date +%s) - s > t )); then return 1; fi; done; }

# Helper: wait for regex in file
wait_for() { local f=$1 p=$2 t=${3:-10}; local s=$(date +%s); while true; do [ -f "$f" ] && grep -qE "$p" "$f" && return 0; sleep 0.1; if (( $(date +%s) - s > t )); then return 1; fi; done; }

# Generate deterministic emails and certs
TS=$(date +%Y%m%d%H%M%S)
EMAIL_A="clientA+${TS}@example.com"
EMAIL_B="clientB+${TS}@example.com"

log "Generating certificates..."
# Set per-client certificate paths then generate
echo "set-cert-path ${A_DIR}/certificate.pem" > "$A_IN"
echo "gen-cert ${EMAIL_A}" > "$A_IN"
echo "set-cert-path ${B_DIR}/certificate.pem" > "$B_IN"
echo "gen-cert ${EMAIL_B}" > "$B_IN"

# Wait for confirmation (best-effort)
wait_for "$A_LOG" "Generated certificate for ${EMAIL_A}" 15 || true
wait_for "$B_LOG" "Generated certificate for ${EMAIL_B}" 15 || true

# PKH files are now written to the provided directories as publicKeyHash.txt
A_PKH_FILE="${A_DIR}/publicKeyHash.txt"
B_PKH_FILE="${B_DIR}/publicKeyHash.txt"

log "Waiting for PKH files: $A_PKH_FILE, $B_PKH_FILE"
wait_for_file "$A_PKH_FILE" 20 || { log "Timed out waiting for $A_PKH_FILE"; exit 1; }
wait_for_file "$B_PKH_FILE" 20 || { log "Timed out waiting for $B_PKH_FILE"; exit 1; }

# Read PEMs and PKHs
if [ ! -f "$A_CERT_PATH" ] || [ ! -f "$B_CERT_PATH" ]; then
  log "Certificate PEM files were not created: $A_CERT_PATH | $B_CERT_PATH"
  exit 1
fi
A_CERT_PEM=$(cat "$A_CERT_PATH")
B_CERT_PEM=$(cat "$B_CERT_PATH")
A_PKH=$(tr -d '\r\n' < "$A_PKH_FILE" | tr 'A-Z' 'a-z')
B_PKH=$(tr -d '\r\n' < "$B_PKH_FILE" | tr 'A-Z' 'a-z')

# Basic sanity
[ -n "$A_PKH" ] || { log "Empty PKH for A"; exit 1; }
[ -n "$B_PKH" ] || { log "Empty PKH for B"; exit 1; }

# Write JSON fixture using Node.js to avoid requiring jq
log "Writing ${OUT_JSON}"
export OUT_JSON A_CERT_PEM B_CERT_PEM A_PKH B_PKH
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const out = process.env.OUT_JSON;
const data = {
  certPem: process.env.A_CERT_PEM,
  certPem2: process.env.B_CERT_PEM,
  publicKeyHash: process.env.A_PKH,
  publicKeyHash2: process.env.B_PKH,
};
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
console.log(`wrote ${out}`);
NODE

log "Fixture generated: $OUT_JSON"

# Exit clients
echo "exit" > "$A_IN" || true
echo "exit" > "$B_IN" || true
sleep 0.5

log "Done."
