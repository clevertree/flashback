#!/bin/bash

# Kaleido Chaincode Deployment & Live Testing Quick Start
# This script provides the commands to deploy and test chaincodes on Kaleido

echo "🚀 Kaleido Live Deployment Quick Start"
echo "========================================"
echo ""

echo "STEP 1: Check Current Status"
echo "---"
echo "npm run check:kaleido"
echo ""

echo "STEP 2: Deploy Chaincodes (Manual)"
echo "---"
echo "Since REST API deployment requires pre-installation:"
echo ""
echo "A) Go to Kaleido Console: https://console.kaleido.io"
echo "B) Select network: u0inmt8fjp"
echo "C) Click 'Deploy Chaincode'"
echo "D) For each chaincode:"
echo "   - Upload binary from chaincode/{name}/{name}-chaincode"
echo "   - Set version: 1.0.0"
echo "   - Select channel: default-channel"
echo "   - Deploy"
echo ""

echo "STEP 3: Verify Deployment"
echo "---"
echo "npm run check:kaleido"
echo ""

echo "STEP 4: Run CLI Tests (Mock Mode - Works Now)"
echo "---"
echo "npm run cli:test"
echo ""

echo "STEP 5: Run CLI Tests (Live Mode - After Deployment)"
echo "---"
echo "npm run cli:test:live"
echo ""

echo "STEP 6: Run Cypress E2E Tests (Live Mode)"
echo "---"
echo "npm run test:e2e:live"
echo ""

echo "STEP 7: Test CLI Manually"
echo "---"
echo "npm run cli:dev -- health"
echo "npm run cli:dev -- query-all --format table"
echo "npm run cli:dev -- search-title 'Inception'"
echo ""

echo "========================================"
echo "All systems ready for Kaleido deployment!"
echo "========================================"
