#!/usr/bin/env bash
# Start the Social Security claiming page for everyone on the LAN.
#   ./start-server.sh            run it
#   ./start-server.sh --open     run it and open the page in your browser
#   PORT=48000 ./start-server.sh use a different port (default 47821)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed or not on PATH. Get it from https://nodejs.org" >&2
  exit 1
fi

exec node server.js "$@"
