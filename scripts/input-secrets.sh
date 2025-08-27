#!/bin/bash

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

# Function to prompt for a secret
prompt_secret() {
    local prompt=$1
    local var_name=$2
    local aws_path=$3
    
    echo -n "$prompt: "
    read -s value
    echo
    
    if [ -n "$value" ]; then
        eval "$var_name=$value"
        store_secret "$aws_path" "$value"
        echo "✓ Stored $aws_path"
    else
        echo "⚠️  No value provided for $aws_path"
    fi
}

echo "Enter Stripe Configuration:"
prompt_secret "Stripe Secret Key (sk_live_...)" "STRIPE_SECRET_KEY" "stripe/secret_key"
prompt_secret "Stripe Webhook Secret (whsec_...)" "STRIPE_WEBHOOK_SECRET" "stripe/webhook_secret"
prompt_secret "Stripe Pro Monthly Price ID" "STRIPE_PRO_MONTHLY_PRICE_ID" "stripe/pro_monthly_price_id"
prompt_secret "Stripe Pro Yearly Price ID" "STRIPE_PRO_YEARLY_PRICE_ID" "stripe/pro_yearly_price_id"
prompt_secret "Stripe Team Monthly Price ID" "STRIPE_TEAM_MONTHLY_PRICE_ID" "stripe/team_monthly_price_id"
prompt_secret "Stripe Team Yearly Price ID" "STRIPE_TEAM_YEARLY_PRICE_ID" "stripe/team_yearly_price_id"

echo -e "\nEnter Groq Configuration:"
prompt_secret "Groq API Key" "GROQ_API_KEY" "ai/groq_api_key"

echo -e "\nEnter Monitoring Configuration:"
prompt_secret "Sentry DSN" "SENTRY_DSN" "monitoring/sentry_dsn"
prompt_secret "Slack Alerts Webhook" "SLACK_ALERTS_WEBHOOK" "monitoring/slack_alerts_webhook"
prompt_secret "Slack Deployments Webhook" "SLACK_DEPLOYMENTS_WEBHOOK" "monitoring/slack_deployments_webhook"

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
