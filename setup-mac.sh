#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  FieldSync — One-time Mac Setup
#
#  Run this ONCE if macOS says "launch-mac.command is damaged"
#  or blocks you from opening it.
#
#  HOW TO RUN:
#    1. Open Terminal  (Spotlight → type "Terminal" → Enter)
#    2. Type:  bash  (with a space after)
#    3. Drag this file (setup-mac.sh) into the Terminal window
#    4. Press Enter
#
#  After this runs once, launch-mac.command works with a normal
#  double-click — you never need to run this again.
# ══════════════════════════════════════════════════════════════

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  FieldSync — Removing macOS security quarantine..."
echo ""

# Remove quarantine flag from all files in the project folder
xattr -cr "$DIR" 2>/dev/null

# Ensure the launcher is executable
chmod +x "$DIR/launch-mac.command"

echo "  Done! Launching FieldSync now..."
echo ""

# Open the launcher
open "$DIR/launch-mac.command"
