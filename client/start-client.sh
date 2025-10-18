#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Starting Tauri Client with Auto-Port Detection"
echo "=================================================="

# Find an available port starting from 3000
PORT=3000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; do
    echo -e "${YELLOW}⚠️  Port $PORT is in use, trying next port...${NC}"
    PORT=$((PORT + 1))
    
    # Safety limit to avoid infinite loop
    if [ $PORT -gt 3020 ]; then
        echo -e "${YELLOW}❌ All ports from 3000-3020 are in use!${NC}"
        echo "Please free up some ports or kill unused processes:"
        echo "  lsof -i :3000"
        echo "  kill -9 <PID>"
        exit 1
    fi
done

echo -e "${GREEN}✅ Using port $PORT for Next.js dev server${NC}"
echo ""

# Export PORT for Next.js
export PORT=$PORT

# Update Tauri config temporarily
TAURI_CONFIG="src-tauri/tauri.conf.json"
BACKUP_CONFIG="src-tauri/tauri.conf.json.backup"

# Create backup
cp "$TAURI_CONFIG" "$BACKUP_CONFIG"

# Update the devPath in config
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|\"devPath\": \"http://localhost:[0-9]*\"|\"devPath\": \"http://localhost:$PORT\"|" "$TAURI_CONFIG"
else
    # Linux
    sed -i "s|\"devPath\": \"http://localhost:[0-9]*\"|\"devPath\": \"http://localhost:$PORT\"|" "$TAURI_CONFIG"
fi

# Cleanup function to restore config on exit
cleanup() {
    echo ""
    echo "🔄 Restoring original Tauri config..."
    mv "$BACKUP_CONFIG" "$TAURI_CONFIG"
    echo "✅ Config restored"
}

# Set trap to cleanup on exit (Ctrl+C, kill, or normal exit)
trap cleanup EXIT INT TERM

# Start Tauri
echo "🎯 Starting Tauri dev server..."
echo ""
npm run tauri dev
