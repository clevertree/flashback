#!/usr/bin/env bash
set -euo pipefail
# Bump patch versions for client/package.json and server/Cargo.toml
# Usage: scripts/bump-versions.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure jq available for package.json manipulation
if ! command -v jq >/dev/null 2>&1; then
  echo "[!] jq not found; skipping client package.json version bump" >&2
else
  PKG_JSON="client/package.json"
  if [[ -f "$PKG_JSON" ]]; then
    CUR_VER=$(jq -r .version "$PKG_JSON")
    IFS='.' read -r MAJ MIN PAT <<<"$CUR_VER"
    if [[ -z "$MAJ" || -z "$MIN" || -z "$PAT" ]]; then
      echo "[!] Could not parse version in $PKG_JSON: $CUR_VER" >&2
    else
      NEW_VER="$MAJ.$MIN.$((PAT+1))"
      TMP=$(mktemp)
      jq ".version=\"$NEW_VER\"" "$PKG_JSON" > "$TMP" && mv "$TMP" "$PKG_JSON"
      echo "[+] client/package.json version: $CUR_VER -> $NEW_VER"
    fi
  fi
fi

# Bump server Cargo.toml version patch
CARGO_TOML="server/Cargo.toml"
if [[ -f "$CARGO_TOML" ]]; then
  CUR_LINE=$(grep -E '^version\s*=\s*"[0-9]+\.[0-9]+\.[0-9]+"' "$CARGO_TOML" || true)
  if [[ -n "$CUR_LINE" ]]; then
    CUR_VER=$(echo "$CUR_LINE" | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
    IFS='.' read -r MAJ MIN PAT <<<"$CUR_VER"
    NEW_VER="$MAJ.$MIN.$((PAT+1))"
    # Replace only the exact version line under [package]
    awk -v newver="$NEW_VER" '
      BEGIN{in_pkg=0}
      /^
\[package\]/{in_pkg=1; print; next}
      /^\[/{in_pkg=0}
      { if(in_pkg && $0 ~ /^version\s*=\s*"[0-9]+\.[0-9]+\.[0-9]+"/){ sub(/"[0-9]+\.[0-9]+\.[0-9]+"/,"\"" newver "\"", $0); print; next } }
      { print }
    ' "$CARGO_TOML" > "$CARGO_TOML.tmp" && mv "$CARGO_TOML.tmp" "$CARGO_TOML"
    echo "[+] server/Cargo.toml version: $CUR_VER -> $NEW_VER"
  else
    echo "[!] Could not find version line in $CARGO_TOML" >&2
  fi
fi

echo "[✓] Version bump complete"