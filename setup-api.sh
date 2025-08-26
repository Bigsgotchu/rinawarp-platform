#!/bin/bash
set -e

# Environment configuration
NODE_ENV=${NODE_ENV:-development}
API_PORT=${API_PORT:-3000}
API_HOST=${API_HOST:-localhost}
API_HEALTH_URL=${API_HEALTH_URL:-"http://$API_HOST:$API_PORT/health"}
MAX_HEALTH_RETRIES=${MAX_HEALTH_RETRIES:-10}
HEALTH_RETRY_DELAY=${HEALTH_RETRY_DELAY:-3}

# Function for consistent status messages
log_status() {
  local type=$1
  local message=$2
  case $type in
    "info")  echo "ℹ️  $message" ;;
    "step")  echo "👉 $message" ;;
    "error") echo "❌ $message" ;;
    "done")  echo "✅ $message" ;;
    *)       echo "   $message" ;;
  esac
}

# Function for error handling
handle_error() {
  local exit_code=$1
  local error_msg=$2
  
  log_status "error" "$error_msg"
  
  # Stop API if it was started
  if pm2 describe rinawarp-api > /dev/null 2>&1; then
    log_status "info" "Rolling back: stopping API process..."
    pm2 stop rinawarp-api
  fi
  
  exit $exit_code
}

# Clean previous builds
log_status "step" "Cleaning previous build outputs..."
rm -rf packages/shared/dist \
       packages/core/dist \
       packages/terminal/dist \
       packages/api/dist \
       packages/*/tsconfig.tsbuildinfo

# Build packages in correct order
build_package() {
  local pkg=$1
  log_status "info" "Building $pkg..."
  (cd "packages/$pkg" && tsc -b --force) || handle_error 1 "Failed to build $pkg"
}

build_package shared
build_package core
build_package terminal
build_package api

# Verify API entry point
API_ENTRY="packages/api/dist/main.js"
if [ ! -f "$API_ENTRY" ]; then
  handle_error 1 "Could not find API entry point at $API_ENTRY"
fi

# Start/restart API with PM2
log_status "step" "Starting API with PM2..."
if pm2 describe rinawarp-api > /dev/null 2>&1; then
  log_status "info" "Stopping previous PM2 process..."
  pm2 delete rinawarp-api
fi

NODE_PATH=packages pm2 start "$API_ENTRY" \
  --name rinawarp-api \
  --watch \
  --update-env \
  --env $NODE_ENV || handle_error 1 "Failed to start API with PM2"

# Health check
log_status "step" "Checking API health..."
for i in $(seq 1 $MAX_HEALTH_RETRIES); do
  if curl -s "$API_HEALTH_URL" > /dev/null; then
    log_status "done" "API is healthy!"
    break
  else
    if [ $i -eq $MAX_HEALTH_RETRIES ]; then
      handle_error 1 "API failed to respond after $MAX_HEALTH_RETRIES attempts"
    fi
    log_status "info" "Waiting for API to become healthy... ($i/$MAX_HEALTH_RETRIES)"
    sleep $HEALTH_RETRY_DELAY
  fi
done

# Redis connection check
log_status "step" "Checking Redis connection..."
for i in $(seq 1 $MAX_HEALTH_RETRIES); do
  if pm2 logs rinawarp-api --lines 50 --nostream | grep -q "Redis connected"; then
    log_status "done" "Redis connection established!"
    break
  else
    if [ $i -eq $MAX_HEALTH_RETRIES ]; then
      handle_error 1 "Redis failed to connect after $MAX_HEALTH_RETRIES attempts"
    fi
    log_status "info" "Waiting for Redis connection... ($i/$MAX_HEALTH_RETRIES)"
    sleep $HEALTH_RETRY_DELAY
  fi
done

# Show final status
log_status "done" "Rinawarp API setup complete!"
pm2 status rinawarp-api

# Optional: Show logs
if [ "${SHOW_LOGS:-false}" = "true" ]; then
  log_status "info" "Tailing API logs..."
  pm2 logs rinawarp-api
fi
