#!/bin/bash

# Exit on any error
set -e

# Load environment variables from .env.production
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Validate required environment variables
required_vars=(
    "STRIPE_SECRET_KEY"
    "STRIPE_PUBLIC_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "DATABASE_URL"
    "JWT_SECRET"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Check that we're using live Stripe keys, not test keys
if [[ $STRIPE_SECRET_KEY != sk_live_* ]]; then
    echo "Error: STRIPE_SECRET_KEY must be a live key (sk_live_*)"
    exit 1
fi

if [[ $STRIPE_PUBLIC_KEY != pk_live_* ]]; then
    echo "Error: STRIPE_PUBLIC_KEY must be a live key (pk_live_*)"
    exit 1
fi

echo "Building packages..."
npm run build

echo "Running database migrations..."
cd packages/api && npx prisma migrate deploy

echo "Syncing Stripe products..."
npm run stripe:sync

echo "Restarting services..."
pm2 reload ecosystem.config.js --env production

echo "Verifying deployment..."
# Wait for services to start
sleep 5

# Check API health
health_check=$(curl -s http://localhost:3000/health)
if [[ $health_check != *"healthy"* ]]; then
    echo "Error: Health check failed"
    exit 1
fi

# Check Stripe webhook
webhook_check=$(curl -s http://localhost:3000/api/webhooks/stripe/test)
if [[ $webhook_check != *"ok"* ]]; then
    echo "Warning: Stripe webhook check failed"
    echo "Please verify webhook configuration manually"
fi

echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Verify Stripe Dashboard configuration"
echo "2. Test a subscription with a real card"
echo "3. Monitor logs: pm2 logs"
echo ""
echo "To rollback deployment:"
echo "./scripts/rollback.sh"
