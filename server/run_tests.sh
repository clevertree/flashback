#!/bin/bash
set -e

# Kill any existing Next.js server processes
pkill -f "next dev -p 8080" || true

# Generate keys fixture
npm run keys:generate

# Start Next.js dev server in background with test environment
NODE_ENV=test PORT=8080 npm run dev:8080 &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Run Cypress tests
NODE_ENV=test npm run cypress:run

# Kill the server
kill $SERVER_PID
