#!/usr/bin/env bash
# ci/scripts/wait-for-backend.sh
# Polls GET /health until the backend responds with HTTP 200 or a timeout
# is reached. On timeout, dumps the last 50 lines of the backend log to aid
# debugging directly from the Jenkins build console.
#
# Tuning via environment variables:
#   BE_HEALTH_URL     — default: http://localhost:4000/health
#   BE_HEALTH_TIMEOUT — default: 60 (seconds)

set -euo pipefail

HEALTH_URL="${BE_HEALTH_URL:-http://localhost:4000/health}"
MAX_WAIT="${BE_HEALTH_TIMEOUT:-60}"
INTERVAL=3

echo "[wait-for-backend] Polling $HEALTH_URL (timeout ${MAX_WAIT}s, interval ${INTERVAL}s)"

elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  # curl: silent, discard body, print only HTTP status code.
  # --max-time 5 prevents a single hung request from eating the whole budget.
  # || echo "000" handles connection-refused before the port is open.
  HTTP_STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" \
    --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "200" ]; then
    echo "[wait-for-backend] Backend is ready (elapsed: ${elapsed}s)"
    exit 0
  fi

  echo "[wait-for-backend] Not ready yet (HTTP $HTTP_STATUS) — ${elapsed}s elapsed..."
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

echo "[wait-for-backend] ERROR: backend did not become healthy within ${MAX_WAIT}s"

LOG_FILE="${WORKSPACE:-$(pwd)}/.be.log"
if [ -f "$LOG_FILE" ]; then
  echo "--- Last 50 lines of backend log ---"
  tail -50 "$LOG_FILE"
fi

exit 1
