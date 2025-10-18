#!/bin/bash

echo "=================================================="
echo "Client-Server Application Setup"
echo "=================================================="
echo ""

# Check for Rust
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust is not installed"
    echo ""
    echo "Install Rust by running:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    echo "Then restart your terminal and run this script again."
    exit 1
else
    echo "✅ Rust is installed: $(rustc --version)"
fi

# Check for Cargo
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo is not installed"
    exit 1
else
    echo "✅ Cargo is installed: $(cargo --version)"
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
if ! command -v cargo-tauri &> /dev/null; then
    echo "📦 Installing Tauri CLI..."
    cargo install tauri-cli
    
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
echo "   npm run tauri:dev"
echo ""
echo "You can start multiple client instances to see them"
echo "all appear in the connected clients list!"
echo ""
