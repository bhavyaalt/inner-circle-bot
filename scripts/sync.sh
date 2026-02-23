#!/bin/bash
# Wrapper script to run sync-members.py with the correct venv

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source venv/bin/activate
python sync-members.py "$@"
