#!/bin/bash

# Exit on any error
set -e

echo "Starting test deployment..."

# Kill any existing processes
pkill -f "ts-node" || true
pkill -f "stripe listen" || true
lsof -ti:3001 | xargs -r kill -9
sleep 2

# Set test environment
export NODE_ENV=test
export $(cat packages/api/.env.test | sed 's/#.*//g' | xargs)

# Start server in test mode
echo "Starting server in test mode..."
cd packages/api
PORT=3001 NODE_ENV=test npx ts-node src/main.ts &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
for i in {1..10}; do
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "Server is up!"
        break
    fi
    echo "Waiting... ($i/10)"
    sleep 1
done

# Keep the script running
echo "Server is running (PID: $SERVER_PID). Press Ctrl+C to stop."
wait $SERVER_PID
