#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if command -v python3 >/dev/null 2>&1; then
  exec python3 serve.py --directory . --open
fi

echo "Python 3 was not found. Opening index.html directly."
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open index.html
else
  echo "Open $SCRIPT_DIR/index.html in a browser."
fi

