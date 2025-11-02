#!/bin/bash

# E2E Test Execution Guide
# Quick reference for running Cypress E2E tests

# =================================================================
# SETUP: Run this first to prepare your environment
# =================================================================

# 1. Install dependencies (if not already done)
npm install

# 2. Build the project
npm run build

# 3. Start the development server (in background or separate terminal)
npm run dev

# Wait 10 seconds for the server to fully start
sleep 10

# =================================================================
# RUN TESTS: Choose one of the options below
# =================================================================

# Option A: Interactive Mode (Recommended for debugging)
# - Opens Cypress UI where you can watch tests run
# - Allows pausing, inspecting elements, rewinding
echo "Opening Cypress Interactive Mode..."
npx cypress open

# Option B: Run All Tests in Headless Mode
# - Runs all E2E tests without UI
# - Faster, suitable for CI/CD
echo "Running all E2E tests in headless mode..."
npx cypress run

# Option C: Run Individual Test Files
echo "Running Use Case 1: Browse & Search"
npx cypress run --spec "cypress/e2e/use-case-1-browse-search.cy.ts"

echo "Running Use Case 2: Submit Content"
npx cypress run --spec "cypress/e2e/use-case-2-submit-content.cy.ts"

echo "Running Use Case 3: Moderation"
npx cypress run --spec "cypress/e2e/use-case-3-moderation.cy.ts"

# Option D: Run with Video Recording
echo "Running tests with video recording..."
npx cypress run --record

# Option E: Run with Specific Browser
echo "Running tests with Chrome browser..."
npx cypress run --browser chrome

# =================================================================
# USEFUL COMMANDS
# =================================================================

# View test results/reports
open cypress/reports/

# View test videos
open cypress/videos/

# View test screenshots
open cypress/screenshots/

# List all available test files
find cypress/e2e -name "*.cy.ts" -type f

# Count test cases in a file
grep -c "it('should" cypress/e2e/use-case-1-browse-search.cy.ts

# Watch mode (re-run on changes)
npx cypress run --watch

# Debug specific test
npx cypress run --spec "cypress/e2e/use-case-1-browse-search.cy.ts" --headed

# =================================================================
# TROUBLESHOOTING COMMANDS
# =================================================================

# Check if app is running on port 3000
lsof -i :3000

# Kill any process on port 3000
kill -9 $(lsof -t -i :3000)

# Restart everything from scratch
npm run build && npm run dev & sleep 10 && npx cypress run

# Clear Cypress cache
rm -rf ~/.cache/Cypress

# Verify Cypress installation
npx cypress verify

# Check Cypress version
npx cypress --version

# =================================================================
# FULL TEST EXECUTION WORKFLOW
# =================================================================

# Complete automated test run:
#!/bin/bash
set -e

echo "🚀 Starting E2E Test Suite Execution"
echo "===================================="

# 1. Build
echo "📦 Building Next.js application..."
npm run build

# 2. Start server
echo "🌐 Starting development server..."
npm run dev > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 15  # Wait for server to start

# 3. Run tests
echo "🧪 Running E2E tests..."
npx cypress run || TEST_RESULT=$?

# 4. Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

# 5. Report
echo "📊 Test Results"
echo "===================================="
if [ -z "$TEST_RESULT" ]; then
  echo "✅ All tests passed!"
  echo ""
  echo "Test Reports:"
  echo "  Reports: cypress/reports/"
  echo "  Videos: cypress/videos/"
  echo "  Screenshots: cypress/screenshots/"
else
  echo "❌ Some tests failed (exit code: $TEST_RESULT)"
  exit $TEST_RESULT
fi

# =================================================================
# CONTINUOUS INTEGRATION SETUP
# =================================================================

# GitHub Actions workflow example:
# .github/workflows/e2e-tests.yml

name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Run E2E tests
        run: npx cypress run
      
      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: cypress-reports
          path: |
            cypress/videos/
            cypress/screenshots/
            cypress/reports/

# =================================================================
# ENVIRONMENT SETUP FOR CI/CD
# =================================================================

# Create .env.test for test-specific configuration:
cat > .env.test << EOF
# Test Environment Variables
NEXT_PUBLIC_API_URL=https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io
NEXT_PUBLIC_CHANNEL=movies-general
NEXT_PUBLIC_CHAINCODE=flashback_repository
NEXT_PUBLIC_TEST_MODE=true
EOF

# =================================================================
# QUICK START FOR NEW DEVELOPERS
# =================================================================

# For new developers who want to get started quickly:

echo "🎯 Quick Start: Running Tests Locally"
echo "======================================"
echo ""
echo "1. Clone the repository"
echo "   git clone <repo-url>"
echo "   cd rust2"
echo ""
echo "2. Install dependencies"
echo "   npm install"
echo ""
echo "3. Build the project"
echo "   npm run build"
echo ""
echo "4. Start the app"
echo "   npm run dev"
echo ""
echo "5. In another terminal, run tests"
echo "   npm run test:e2e"
echo ""
echo "6. Or run specific test:"
echo "   npx cypress run --spec \"cypress/e2e/use-case-1-browse-search.cy.ts\""
echo ""
echo "Documentation: See cypress/E2E_TEST_GUIDE.md"
echo ""

# =================================================================
# MONITORING LIVE TEST EXECUTION
# =================================================================

# While tests are running, in another terminal:

# Watch the app logs
tail -f /tmp/app.log

# Monitor test progress
watch -n 1 'ls -lt cypress/videos/ | head -5'

# Check network calls to Kaleido
# Use Chrome DevTools Network tab while running in --headed mode

# =================================================================
# POST-TEST ANALYSIS
# =================================================================

# After tests complete:

# View test statistics
echo "Test Statistics:"
grep -c "passing\|failing\|pending" cypress/reports/index.html

# Generate coverage report (if configured)
npm run test:coverage

# Analyze slow tests
grep "duration" cypress/reports/*.json | sort -t: -k3 -rn | head -10

# =================================================================
# NOTES
# =================================================================

# 1. Make sure the app is running before starting tests
# 2. Tests will use the live Kaleido network
# 3. Each test run takes approximately 7-8 minutes
# 4. Tests are independent and can be run in any order
# 5. Test data is appended to the ledger (not deleted)
# 6. For CI/CD, use headless mode and --record for reports
# 7. See E2E_TEST_GUIDE.md for comprehensive documentation

# =================================================================
