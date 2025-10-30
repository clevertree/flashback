#!/usr/bin/env bash
# scripts/e2e-common.sh
# Common utilities and functions shared by E2E scripts
# Usage: source scripts/e2e-common.sh

set -euo pipefail

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions - standardized across all E2E scripts
info() {
  # Prints informational message
  echo -e "${CYAN}[INFO]${NC} $*"
}

warn() {
  # Prints warning message
  echo -e "${YELLOW}[WARN]${NC} $*"
}

err() {
  # Prints error message
  echo -e "${RED}[ERROR]${NC} $*"
}

success() {
  # Prints success message with checkmark
  echo -e "${GREEN}[✓]${NC} $*"
}

debug() {
  # Prints debug message if DEBUG=1 environment variable is set
  if [[ "${DEBUG:-}" == "1" ]]; then
    echo -e "${BLUE}[DEBUG]${NC} $*"
  fi
}

# Get the repository root directory
get_repo_root() {
  # Resolves and returns the absolute path to the repository root
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/.." && pwd
}

# Check if a command exists
command_exists() {
  # Returns 0 if command exists, 1 otherwise
  command -v "$1" >/dev/null 2>&1
}

# Wait for a service to be ready (TCP port accessible)
wait_for_service() {
  # Usage: wait_for_service <host> <port> [timeout_seconds]
  # Polls the service until it's reachable or timeout is exceeded
  local host=$1
  local port=$2
  local timeout=${3:-30}
  local elapsed=0

  info "Waiting for service at $host:$port (timeout: ${timeout}s)..."
  while ! nc -z "$host" "$port" 2>/dev/null; do
    if [[ $elapsed -ge $timeout ]]; then
      err "Service at $host:$port did not become ready within ${timeout}s"
      return 1
    fi
    sleep 1
    ((elapsed++))
  done
  success "Service at $host:$port is ready"
  return 0
}

# Clean up temporary files and processes
cleanup() {
  # Cleanup handler - override in calling script if needed
  debug "Cleaning up..."
}

# Set up trap to cleanup on exit
setup_cleanup_trap() {
  # Registers cleanup function to run on EXIT, INT, and TERM signals
  trap cleanup EXIT INT TERM
}

# Export functions so they're available in subshells
export -f info warn err success debug get_repo_root command_exists wait_for_service cleanup setup_cleanup_trap
