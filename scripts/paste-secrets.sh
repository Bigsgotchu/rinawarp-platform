#!/bin/bash

# Store in AWS Parameter Store
store_secret() {
    local name=$1
    local value=$2
    echo "Storing $name..."
    aws ssm put-parameter \
        --name "/rinawarp/production/$name" \
        --value "$value" \
        --type "SecureString" \
        --overwrite \
        --region us-west-2
}

echo "Paste your Stripe secret key (sk_live_...):"
read STRIPE_SECRET_KEY
store_secret "stripe/secret_key" "$STRIPE_SECRET_KEY"

echo -e "\nPaste your Stripe webhook secret (whsec_...):"
read STRIPE_WEBHOOK_SECRET
store_secret "stripe/webhook_secret" "$STRIPE_WEBHOOK_SECRET"

echo -e "\nPaste your Stripe Pro Monthly Price ID:"
read STRIPE_PRO_MONTHLY_PRICE_ID
store_secret "stripe/pro_monthly_price_id" "$STRIPE_PRO_MONTHLY_PRICE_ID"

echo -e "\nPaste your Stripe Pro Yearly Price ID:"
read STRIPE_PRO_YEARLY_PRICE_ID
store_secret "stripe/pro_yearly_price_id" "$STRIPE_PRO_YEARLY_PRICE_ID"

echo -e "\nPaste your Stripe Team Monthly Price ID:"
read STRIPE_TEAM_MONTHLY_PRICE_ID
store_secret "stripe/team_monthly_price_id" "$STRIPE_TEAM_MONTHLY_PRICE_ID"

echo -e "\nPaste your Stripe Team Yearly Price ID:"
read STRIPE_TEAM_YEARLY_PRICE_ID
store_secret "stripe/team_yearly_price_id" "$STRIPE_TEAM_YEARLY_PRICE_ID"

echo -e "\nPaste your Groq API Key:"
read GROQ_API_KEY
store_secret "ai/groq_api_key" "$GROQ_API_KEY"

echo -e "\nPaste your Sentry DSN:"
read SENTRY_DSN
store_secret "monitoring/sentry_dsn" "$SENTRY_DSN"

echo -e "\nPaste your Slack Alerts Webhook URL:"
read SLACK_ALERTS_WEBHOOK
store_secret "monitoring/slack_alerts_webhook" "$SLACK_ALERTS_WEBHOOK"

echo -e "\nPaste your Slack Deployments Webhook URL:"
read SLACK_DEPLOYMENTS_WEBHOOK
store_secret "monitoring/slack_deployments_webhook" "$SLACK_DEPLOYMENTS_WEBHOOK"

# Create Kubernetes secrets
echo -e "\nCreating Kubernetes secrets..."
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
echo -e "\nUpdating .env.production..."
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

echo -e "\n✅ All secrets have been stored securely!"
echo "   - AWS Parameter Store"
echo "   - Kubernetes Secrets"
echo "   - .env.production"
