#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  FieldSync — Demo Launcher  (macOS)
#  Double-click this file in Finder to start the app.
#  Leave this window open while running the demo.
# ══════════════════════════════════════════════════════════════

# Always run from the folder where this script lives
cd "$(dirname "$0")"

# ── Terminal colours ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo ""
echo -e "${BOLD}${BLUE}  ╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}  ║        FieldSync  —  Demo Launcher       ║${NC}"
echo -e "${BOLD}${BLUE}  ║     Remote Expert Platform  v0.1.0       ║${NC}"
echo -e "${BOLD}${BLUE}  ╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1 · Check Node.js ────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗  Node.js is not installed.${NC}"
    echo ""
    echo "     Download the LTS installer from: https://nodejs.org"
    echo "     Install it, then double-click this file again."
    echo ""
    open "https://nodejs.org"
    read -p "  Press Enter to close..."
    exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "${GREEN}  ✓  Node.js${NC} ${NODE_VER}  (npm ${NPM_VER})"

# ── Step 2 · Install dependencies (first run only) ────────────
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}  ⬇  Installing dependencies — first run only (~1 min)…${NC}"
    npm install --silent 2>&1
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}  ✗  npm install failed.${NC}"
        echo "     Check your internet connection and try again."
        read -p "  Press Enter to close..."
        exit 1
    fi
    echo -e "${GREEN}  ✓  Dependencies installed${NC}"
else
    echo -e "${GREEN}  ✓  Dependencies ready${NC}"
fi

# ── Step 3 · Set up database (first run only) ─────────────────
if [ ! -f "prisma/dev.db" ]; then
    echo ""
    echo -e "${YELLOW}  🗄  Setting up database — first run only…${NC}"
    npx prisma migrate dev --name init --skip-generate > /dev/null 2>&1
    npm run db:seed > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}  ✗  Database setup failed.${NC}"
        read -p "  Press Enter to close..."
        exit 1
    fi
    echo -e "${GREEN}  ✓  Database ready${NC}"
else
    echo -e "${GREEN}  ✓  Database ready${NC}"
fi

# ── Step 4 · Launch the app ───────────────────────────────────
echo ""
echo -e "  ${BOLD}🚀  Launching FieldSync…${NC}"
echo ""

npm run dev &
APP_PID=$!

# ── Step 5 · Wait until localhost:3000 responds ───────────────
echo -ne "  ${CYAN}  Waiting for server to start${NC}"
READY=0
for i in $(seq 1 40); do
    sleep 1
    echo -ne "."
    if curl -s --max-time 1 http://localhost:3000 > /dev/null 2>&1; then
        READY=1
        break
    fi
done
echo ""

if [ $READY -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}  ⚠  Server is taking longer than usual.${NC}"
    echo "     Try opening http://localhost:3000 manually in a moment."
fi

# ── Step 6 · Open browser and print demo instructions ─────────
echo ""
echo -e "  ${BOLD}${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${BOLD}${GREEN}║  ✓  FieldSync is running!               ║${NC}"
echo -e "  ${BOLD}${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}  http://localhost:3000"
echo ""
echo -e "  ${BOLD}${CYAN}── Demo tip ──────────────────────────────────────────${NC}"
echo ""
echo "   To run the full demo you need TWO browser windows:"
echo ""
echo -e "   ${BOLD}Window 1${NC}  →  http://localhost:3000             (Worker)"
echo -e "   ${BOLD}Window 2${NC}  →  http://localhost:3000  ${BOLD}Incognito${NC}  (Expert)"
echo ""
echo "   Open Window 2 in Private / Incognito mode so each"
echo "   window has its own separate identity."
echo ""
echo -e "  ${BOLD}${CYAN}──────────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${YELLOW}Leave this window open while using the demo.${NC}"
echo -e "  ${YELLOW}Press Ctrl+C to stop the server.${NC}"
echo ""

open "http://localhost:3000"

# Keep terminal alive so the server keeps running
wait $APP_PID
