#!/bin/bash

# Check if production-secrets.env exists
if [ ! -f production-secrets.env ]; then
    echo "Error: production-secrets.env file not found"
    exit 1
fi

# Load secrets
source production-secrets.env

# Store in AWS Parameter Store
store_secret() {
    local name=$1
    local value=$2
    aws ssm put-parameter \
        --name "/rinawarp/production/$name" \
        --value "$value" \
        --type "SecureString" \
        --overwrite \
        --region us-west-2
}

echo "Storing secrets in AWS Parameter Store..."

# Store Stripe secrets
store_secret "stripe/secret_key" "$STRIPE_SECRET_KEY"
store_secret "stripe/webhook_secret" "$STRIPE_WEBHOOK_SECRET"
store_secret "stripe/pro_monthly_price_id" "$STRIPE_PRO_MONTHLY_PRICE_ID"
store_secret "stripe/pro_yearly_price_id" "$STRIPE_PRO_YEARLY_PRICE_ID"
store_secret "stripe/team_monthly_price_id" "$STRIPE_TEAM_MONTHLY_PRICE_ID"
store_secret "stripe/team_yearly_price_id" "$STRIPE_TEAM_YEARLY_PRICE_ID"

# Store Groq secret
store_secret "ai/groq_api_key" "$GROQ_API_KEY"

# Store Sentry secret
store_secret "monitoring/sentry_dsn" "$SENTRY_DSN"

# Store Slack webhooks
store_secret "monitoring/slack_alerts_webhook" "$SLACK_ALERTS_WEBHOOK"
store_secret "monitoring/slack_deployments_webhook" "$SLACK_DEPLOYMENTS_WEBHOOK"

# Create Kubernetes secrets
echo "Creating Kubernetes secrets..."
kubectl create namespace rinawarp-production --dry-run=client -o yaml | kubectl apply -f -

cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: stripe-secrets
  namespace: rinawarp-production
type: Opaque
stringData:
  STRIPE_SECRET_KEY: $STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET: $STRIPE_WEBHOOK_SECRET
  STRIPE_PRO_MONTHLY_PRICE_ID: $STRIPE_PRO_MONTHLY_PRICE_ID
  STRIPE_PRO_YEARLY_PRICE_ID: $STRIPE_PRO_YEARLY_PRICE_ID
  STRIPE_TEAM_MONTHLY_PRICE_ID: $STRIPE_TEAM_MONTHLY_PRICE_ID
  STRIPE_TEAM_YEARLY_PRICE_ID: $STRIPE_TEAM_YEARLY_PRICE_ID
---
apiVersion: v1
kind: Secret
metadata:
  name: ai-secrets
  namespace: rinawarp-production
type: Opaque
stringData:
  GROQ_API_KEY: $GROQ_API_KEY
---
apiVersion: v1
kind: Secret
metadata:
  name: monitoring-secrets
  namespace: rinawarp-production
type: Opaque
stringData:
  SENTRY_DSN: $SENTRY_DSN
  SLACK_ALERTS_WEBHOOK: $SLACK_ALERTS_WEBHOOK
  SLACK_DEPLOYMENTS_WEBHOOK: $SLACK_DEPLOYMENTS_WEBHOOK
EOF

# Update .env.production
echo "Updating .env.production..."
cat > .env.production << EOF
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
API_URL=https://api.rinawarptech.com
WEBSITE_URL=https://rinawarptech.com

# Stripe
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
STRIPE_PRO_MONTHLY_PRICE_ID=$STRIPE_PRO_MONTHLY_PRICE_ID
STRIPE_PRO_YEARLY_PRICE_ID=$STRIPE_PRO_YEARLY_PRICE_ID
STRIPE_TEAM_MONTHLY_PRICE_ID=$STRIPE_TEAM_MONTHLY_PRICE_ID
STRIPE_TEAM_YEARLY_PRICE_ID=$STRIPE_TEAM_YEARLY_PRICE_ID

# AI Service
AI_SERVICE_URL=https://api.groq.com/v1
AI_API_KEY=$GROQ_API_KEY

# Monitoring
SENTRY_DSN=$SENTRY_DSN
METRICS_INTERVAL=60000
METRICS_RETENTION=86400

# Slack Webhooks
SLACK_ALERTS_WEBHOOK=$SLACK_ALERTS_WEBHOOK
SLACK_DEPLOYMENTS_WEBHOOK=$SLACK_DEPLOYMENTS_WEBHOOK
EOF

echo "Cleaning up..."
rm production-secrets.env

echo "Done! All secrets have been securely stored."
