#!/usr/bin/env bash
set -euo pipefail

# Build the server docker image locally and run a quick smoke test
# Usage: scripts/test-server-docker.sh [tag]

TAG=${1:-local}
IMAGE=flashback-server:${TAG}
PORT=${SERVER_PORT:-51111}

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR/server"

echo "[+] Building image $IMAGE"
docker build -t "$IMAGE" .

# Run container in background
CID=$(docker run -d --rm -p ${PORT}:${PORT} "$IMAGE")
trap 'docker kill "$CID" >/dev/null 2>&1 || true' EXIT

echo "[+] Container $CID started, waiting for port $PORT"
for i in $(seq 1 20); do
  if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
    echo "[✓] Port $PORT is open. Server container smoke test passed."
    exit 0
  fi
  sleep 1
  echo "[.] waiting ($i) ..."
 done

echo "[x] Timed out waiting for server to open port $PORT"
exit 1
