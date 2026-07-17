#!/usr/bin/env bash
set -e

# Default admin password, overridable via the APP_PASSWORD env var
export APP_PASSWORD="${APP_PASSWORD:-test1234}"

# Disable wrangler telemetry to avoid network calls in --local mode
export WRANGLER_SEND_METRICS=false

# Ensure the data directory exists (no error even without an external volume)
mkdir -p /app/data

echo "=========================================="
echo " serverless-qrcode-hub (local mode)"
echo " D1 data dir : /app/data"
echo " Admin UI    : http://<host>:8787/admin.html"
echo "=========================================="

# Run workerd offline in local mode; D1 data persists to /app/data
exec npx wrangler dev \
  --local \
  --config /app/wrangler.docker.toml \
  --ip 0.0.0.0 \
  --port 8787 \
  --persist-to /app/data \
  --test-scheduled
