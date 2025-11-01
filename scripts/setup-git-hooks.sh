#!/bin/bash

# Git Hooks Setup Script
# Installs pre-commit hooks for the project
# Run this after cloning the repository

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Git Hooks Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SOURCE="$PROJECT_ROOT/scripts/git-hooks"
HOOKS_DEST="$PROJECT_ROOT/.git/hooks"

echo -e "${YELLOW}Installing git hooks...${NC}"
echo ""

# Check if hooks directory exists
if [ ! -d "$HOOKS_DEST" ]; then
    echo -e "${YELLOW}Creating .git/hooks directory...${NC}"
    mkdir -p "$HOOKS_DEST"
fi

# Copy pre-commit hook
if [ -f "$HOOKS_SOURCE/pre-commit" ]; then
    echo -e "${YELLOW}Installing pre-commit hook...${NC}"
    cp "$HOOKS_SOURCE/pre-commit" "$HOOKS_DEST/pre-commit"
    chmod +x "$HOOKS_DEST/pre-commit"
    echo -e "${GREEN}✓${NC} pre-commit hook installed"
else
    echo -e "${YELLOW}Note: pre-commit hook source not found at $HOOKS_SOURCE/pre-commit${NC}"
fi

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✓ Git hooks setup complete!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "${YELLOW}Your pre-commit hook is now active!${NC}"
echo ""
echo "The following checks will run before each commit:"
echo "  1. Next.js build verification"
echo "  2. Cargo/Tauri build verification"
echo ""
echo "If builds fail, the commit will be rejected."
echo ""
echo -e "${YELLOW}To skip checks and commit anyway:${NC}"
echo "  git commit --no-verify"
echo ""
