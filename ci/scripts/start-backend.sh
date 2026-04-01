#!/usr/bin/env bash
# ci/scripts/start-backend.sh
# Starts the backend in the background using nohup and writes its PID to
# $BE_PID_FILE. Must be executed from the repo root (Jenkins WORKSPACE).
#
# Uses `node src/index.js` directly (not `npm start`) so the stored PID
# belongs to the node process itself, not npm's wrapper shell — making
# cleanup in post.always reliable.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PID_FILE="${BE_PID_FILE:-$REPO_ROOT/.be.pid}"
LOG_FILE="$REPO_ROOT/.be.log"

# ── Guard: kill any stale backend left by a previously crashed build ────────
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[start-backend] Stale backend PID $OLD_PID still running — killing it"
    kill "$OLD_PID" || true
    sleep 2
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

echo "[start-backend] Starting backend from $REPO_ROOT"
cd "$REPO_ROOT"

nohup node src/index.js > "$LOG_FILE" 2>&1 &
BE_PID=$!

echo "$BE_PID" > "$PID_FILE"
echo "[start-backend] Backend started with PID $BE_PID (log → $LOG_FILE)"
