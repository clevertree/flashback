#!/bin/bash

set -e

echo "=================================================="
echo "Client-Server Application Setup"
echo "=================================================="
echo ""

# Detect sudo if needed
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
fi

# On Debian/Ubuntu, install required system packages (idempotent)
if command -v apt-get >/dev/null 2>&1; then
  echo "🛠  Detected Debian/Ubuntu. Installing system dependencies (requires sudo)..."
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -y
  $SUDO apt-get install -y \
    build-essential \
    curl \
    wget \
    file \
    pkg-config \
    libssl-dev \
    lsof \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup2.4-dev \
    patchelf
  # Prefer WebKitGTK 4.0 (Tauri Linux builds commonly expect 4.0); fallback to 4.1 if 4.0 is unavailable
  if $SUDO apt-get install -y libwebkit2gtk-4.0-dev; then
    echo "✅ Installed libwebkit2gtk-4.0-dev"
  else
    echo "ℹ️  libwebkit2gtk-4.0-dev not available, trying libwebkit2gtk-4.1-dev"
    $SUDO apt-get install -y libwebkit2gtk-4.1-dev && echo "✅ Installed libwebkit2gtk-4.1-dev"

    # Create pkg-config compatibility aliases for Ubuntu 24.04 (4.1 -> 4.0)
    echo "🔧 Creating pkg-config compatibility aliases for WebKitGTK..."
    PC_DIR="/usr/local/lib/pkgconfig"
    $SUDO mkdir -p "$PC_DIR"

    # Alias javascriptcoregtk-4.0.pc to require 4.1
    $SUDO bash -c 'cat > '"$PC_DIR"'/javascriptcoregtk-4.0.pc <<"EOF"
# Compatibility wrapper to let builds that request javascriptcoregtk-4.0 use 4.1 instead
Name: JavaScriptCoreGTK-4.0-compat
Description: Compatibility for JavaScriptCoreGTK 4.0 using 4.1
Version: 9999
Requires: javascriptcoregtk-4.1
EOF'

    # Alias webkit2gtk-4.0.pc to require 4.1
    $SUDO bash -c 'cat > '"$PC_DIR"'/webkit2gtk-4.0.pc <<"EOF"
# Compatibility wrapper to let builds that request webkit2gtk-4.0 use 4.1 instead
Name: WebKit2GTK-4.0-compat
Description: Compatibility for WebKit2GTK 4.0 using 4.1
Version: 9999
Requires: webkit2gtk-4.1
EOF'

    echo "✅ Created compatibility pkg-config files in $PC_DIR"

    # Create linker compatibility symlinks for 4.0 -> 4.1
    echo "🔧 Creating linker symlinks for WebKitGTK (4.0 -> 4.1)..."
    # Determine library directories
    PKG_LIBDIR=$(pkg-config --variable=libdir webkit2gtk-4.1 2>/dev/null || true)
    [ -z "$PKG_LIBDIR" ] && PKG_LIBDIR="/usr/lib/x86_64-linux-gnu"
    LIBDIR_SYSTEM="$PKG_LIBDIR"
    LIBDIR_LOCAL="/usr/local/lib"

    echo "   • Using system libdir: $LIBDIR_SYSTEM"
    echo "   • Using local libdir:  $LIBDIR_LOCAL"

    $SUDO mkdir -p "$LIBDIR_LOCAL"

    # Create symlinks in both system libdir and /usr/local/lib
    if [ -f "$LIBDIR_SYSTEM/libwebkit2gtk-4.1.so" ]; then
      $SUDO ln -sf "$LIBDIR_SYSTEM/libwebkit2gtk-4.1.so" "$LIBDIR_SYSTEM/libwebkit2gtk-4.0.so" || true
      $SUDO ln -sf "$LIBDIR_SYSTEM/libwebkit2gtk-4.1.so" "$LIBDIR_LOCAL/libwebkit2gtk-4.0.so" || true
    fi
    if [ -f "$LIBDIR_SYSTEM/libjavascriptcoregtk-4.1.so" ]; then
      $SUDO ln -sf "$LIBDIR_SYSTEM/libjavascriptcoregtk-4.1.so" "$LIBDIR_SYSTEM/libjavascriptcoregtk-4.0.so" || true
      $SUDO ln -sf "$LIBDIR_SYSTEM/libjavascriptcoregtk-4.1.so" "$LIBDIR_LOCAL/libjavascriptcoregtk-4.0.so" || true
    fi

    # Refresh dynamic linker cache
    if command -v ldconfig >/dev/null 2>&1; then
      $SUDO ldconfig
    fi

    echo "✅ Linker symlinks created (system and local lib dirs)"
  fi
fi

# Ensure Rust toolchain (rustup, rustc, cargo)
if ! command -v rustc >/dev/null 2>&1 || ! command -v cargo >/dev/null 2>&1; then
  echo "🦀 Installing Rust toolchain via rustup (non-interactive)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # Load cargo into current shell
  if [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
  fi
  # Ensure stable toolchain installed and set as default
  if command -v rustup >/dev/null 2>&1; then
    rustup toolchain install stable
    rustup default stable
  fi
fi

if command -v rustc >/dev/null 2>&1; then
  echo "✅ Rust is installed: $(rustc --version)"
else
  echo "❌ Rust installation failed (rustc not found)"; exit 1
fi

if command -v cargo >/dev/null 2>&1; then
  echo "✅ Cargo is installed: $(cargo --version)"
else
  echo "❌ Cargo installation failed (cargo not found)"; exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo ""
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
else
    echo "✅ Node.js is installed: $(node --version)"
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
else
    echo "✅ npm is installed: $(npm --version)"
fi

echo ""
echo "=================================================="
echo "Installing Dependencies"
echo "=================================================="
echo ""

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install client dependencies"
    exit 1
fi

echo "✅ Client dependencies installed"
echo ""

# Check if tauri-cli is installed
if ! command -v tauri &> /dev/null && ! npx tauri --version &> /dev/null; then
    echo "📦 Installing Tauri CLI via npm..."
    npm install -g @tauri-apps/cli
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Tauri CLI"
        exit 1
    fi
    
    echo "✅ Tauri CLI installed"
else
    echo "✅ Tauri CLI already installed"
fi

cd ..

echo ""
echo "=================================================="
echo "Setup Complete!"
echo "=================================================="
echo ""
echo "To run the application:"
echo ""
echo "1. Start the server (in one terminal):"
echo "   cd server"
echo "   cargo run"
echo ""
echo "2. Start the client (in another terminal):"
echo "   cd client"
echo "   npm run tauri:dev  # or: npx tauri dev"
echo ""
echo "You can start multiple client instances to see them"
echo "all appear in the connected clients list!"
echo ""
