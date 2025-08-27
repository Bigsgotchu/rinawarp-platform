#!/bin/bash

# Exit on any error
set -e

# Enable command output tracing
set -x

# Kill any existing processes
pkill -f "ts-node-dev" || true
lsof -ti:3000 | xargs -r kill -9
lsof -ti:3001 | xargs -r kill -9
sleep 2

echo "Starting test deployment..."

# Load environment variables
if [ -f "packages/api/.env.test" ]; then
    export $(cat packages/api/.env.test | sed 's/#.*//g' | xargs)
fi

# Create test directories
mkdir -p backups reports

# 1. Set up test database
echo "Setting up test database..."
dropdb rinawarp_test || true
createdb rinawarp_test

# 2. Run migrations on test database
echo "Running database migrations..."
cd packages/api
NODE_ENV=test npx prisma migrate deploy
cd ../..

# 3. Start server in test mode first
echo "Starting server in test mode..."
cd packages/api
PORT=3001 NODE_ENV=test npx ts-node src/main.ts > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
cd ../..

# Cleanup server on script exit
trap "kill -9 $SERVER_PID" EXIT

# 4. Wait for server to start
echo "Waiting for server to start..."
success=false
for i in {1..30}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "Server is up!"
        success=true
        break
    fi
    echo "Waiting for server... ($i/30)"
    sleep 1
done

if [ "$success" = false ]; then
    echo "Server failed to start"
    exit 1
fi

# 5. Start webhook listener in background after server is up
echo "Starting Stripe webhook listener..."
stripe listen --forward-to localhost:3001/api/webhooks/stripe &
STRIPE_PID=$!

# Cleanup webhook listener on script exit
trap "kill -9 $STRIPE_PID $SERVER_PID" EXIT

# 6. Create test products in Stripe (after server is up)
echo "Creating test products in Stripe..."
PORT=3001 NODE_ENV=test npx ts-node scripts/stripe-sync.ts
if [ $? -ne 0 ]; then
    echo "Failed to sync Stripe products"
    exit 1
fi

# 7. Run test suite
echo "Running test subscription flow..."
PORT=3001 NODE_ENV=test npx ts-node scripts/test-subscription-flow.ts
if [ $? -ne 0 ]; then
    echo "Test subscription flow failed"
    exit 1
fi

echo "Test deployment completed successfully!"

# Keep the script running until user presses CTRL+C
echo "Press CTRL+C to stop the test servers..."
wait $SERVER_PID
