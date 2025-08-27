#!/bin/bash

# Function to store a secret in AWS Parameter Store
store_secret() {
    local name=$1
    local value=$2
    local description=$3

    aws ssm put-parameter \
        --name "/rinawarp/production/$name" \
        --value "$value" \
        --type "SecureString" \
        --description "$description" \
        --overwrite \
        --region us-west-2
}

# Function to read a secret from AWS Parameter Store
read_secret() {
    local name=$1
    aws ssm get-parameter \
        --name "/rinawarp/production/$name" \
        --with-decryption \
        --region us-west-2 \
        --query 'Parameter.Value' \
        --output text
}

# Store Stripe secrets
store_stripe_secrets() {
    echo "Enter Stripe Secret Key (sk_live_...):"
    read -s STRIPE_SECRET_KEY
    store_secret "stripe/secret_key" "$STRIPE_SECRET_KEY" "Stripe API Secret Key"

    echo -e "\nEnter Stripe Webhook Secret (whsec_...):"
    read -s STRIPE_WEBHOOK_SECRET
    store_secret "stripe/webhook_secret" "$STRIPE_WEBHOOK_SECRET" "Stripe Webhook Secret"

    echo -e "\nEnter Stripe Pro Monthly Price ID:"
    read -s STRIPE_PRO_MONTHLY_PRICE_ID
    store_secret "stripe/pro_monthly_price_id" "$STRIPE_PRO_MONTHLY_PRICE_ID" "Stripe Pro Monthly Price ID"

    echo -e "\nEnter Stripe Pro Yearly Price ID:"
    read -s STRIPE_PRO_YEARLY_PRICE_ID
    store_secret "stripe/pro_yearly_price_id" "$STRIPE_PRO_YEARLY_PRICE_ID" "Stripe Pro Yearly Price ID"

    echo -e "\nEnter Stripe Team Monthly Price ID:"
    read -s STRIPE_TEAM_MONTHLY_PRICE_ID
    store_secret "stripe/team_monthly_price_id" "$STRIPE_TEAM_MONTHLY_PRICE_ID" "Stripe Team Monthly Price ID"

    echo -e "\nEnter Stripe Team Yearly Price ID:"
    read -s STRIPE_TEAM_YEARLY_PRICE_ID
    store_secret "stripe/team_yearly_price_id" "$STRIPE_TEAM_YEARLY_PRICE_ID" "Stripe Team Yearly Price ID"
}

# Store AI Service secrets
store_ai_secrets() {
    echo "Enter Groq API Key:"
    read -s GROQ_API_KEY
    store_secret "ai/groq_api_key" "$GROQ_API_KEY" "Groq API Key"
}

# Store monitoring secrets
store_monitoring_secrets() {
    echo "Enter Sentry DSN:"
    read -s SENTRY_DSN
    store_secret "monitoring/sentry_dsn" "$SENTRY_DSN" "Sentry DSN"

    echo -e "\nEnter Slack Alerts Webhook URL:"
    read -s SLACK_ALERTS_WEBHOOK
    store_secret "monitoring/slack_alerts_webhook" "$SLACK_ALERTS_WEBHOOK" "Slack Alerts Webhook URL"

    echo -e "\nEnter Slack Deployments Webhook URL:"
    read -s SLACK_DEPLOYMENTS_WEBHOOK
    store_secret "monitoring/slack_deployments_webhook" "$SLACK_DEPLOYMENTS_WEBHOOK" "Slack Deployments Webhook URL"
}

# Generate Kubernetes secrets
generate_k8s_secrets() {
    # Create namespace if it doesn't exist
    kubectl create namespace rinawarp-production --dry-run=client -o yaml | kubectl apply -f -

    # Fetch secrets from Parameter Store and create Kubernetes secrets
    cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: stripe-secrets
  namespace: rinawarp-production
type: Opaque
stringData:
  STRIPE_SECRET_KEY: $(read_secret "stripe/secret_key")
  STRIPE_WEBHOOK_SECRET: $(read_secret "stripe/webhook_secret")
  STRIPE_PRO_MONTHLY_PRICE_ID: $(read_secret "stripe/pro_monthly_price_id")
  STRIPE_PRO_YEARLY_PRICE_ID: $(read_secret "stripe/pro_yearly_price_id")
  STRIPE_TEAM_MONTHLY_PRICE_ID: $(read_secret "stripe/team_monthly_price_id")
  STRIPE_TEAM_YEARLY_PRICE_ID: $(read_secret "stripe/team_yearly_price_id")
---
apiVersion: v1
kind: Secret
metadata:
  name: ai-secrets
  namespace: rinawarp-production
type: Opaque
stringData:
  GROQ_API_KEY: $(read_secret "ai/groq_api_key")
---
apiVersion: v1
kind: Secret
metadata:
  name: monitoring-secrets
  namespace: rinawarp-production
type: Opaque
stringData:
  SENTRY_DSN: $(read_secret "monitoring/sentry_dsn")
  SLACK_ALERTS_WEBHOOK: $(read_secret "monitoring/slack_alerts_webhook")
  SLACK_DEPLOYMENTS_WEBHOOK: $(read_secret "monitoring/slack_deployments_webhook")
EOF

    echo "Kubernetes secrets generated successfully"
}

# Update .env.production file
update_env_production() {
    # Backup existing file
    if [ -f .env.production ]; then
        cp .env.production .env.production.backup
    fi

    # Update .env.production with secrets
    cat > .env.production << EOF
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
API_URL=https://api.rinawarptech.com
WEBSITE_URL=https://rinawarptech.com

# Authentication
JWT_SECRET=$(read_secret "auth/jwt_secret")
JWT_EXPIRATION=24h
SESSION_SECRET=$(read_secret "auth/session_secret")

# Database
DATABASE_URL=$(read_secret "database/url")
REDIS_URL=$(read_secret "database/redis_url")

# Stripe
STRIPE_SECRET_KEY=$(read_secret "stripe/secret_key")
STRIPE_WEBHOOK_SECRET=$(read_secret "stripe/webhook_secret")
STRIPE_PRO_MONTHLY_PRICE_ID=$(read_secret "stripe/pro_monthly_price_id")
STRIPE_PRO_YEARLY_PRICE_ID=$(read_secret "stripe/pro_yearly_price_id")
STRIPE_TEAM_MONTHLY_PRICE_ID=$(read_secret "stripe/team_monthly_price_id")
STRIPE_TEAM_YEARLY_PRICE_ID=$(read_secret "stripe/team_yearly_price_id")

# AI Service
AI_SERVICE_URL=https://api.groq.com/v1
AI_API_KEY=$(read_secret "ai/groq_api_key")

# Monitoring
SENTRY_DSN=$(read_secret "monitoring/sentry_dsn")
METRICS_INTERVAL=60000
METRICS_RETENTION=86400

# Slack Webhooks
SLACK_ALERTS_WEBHOOK=$(read_secret "monitoring/slack_alerts_webhook")
SLACK_DEPLOYMENTS_WEBHOOK=$(read_secret "monitoring/slack_deployments_webhook")
EOF

    echo ".env.production updated successfully"
}

# Main menu
main_menu() {
    while true; do
        echo -e "\nRinaWarp Production Secrets Management"
        echo "1. Store Stripe secrets"
        echo "2. Store AI service secrets"
        echo "3. Store monitoring secrets"
        echo "4. Generate Kubernetes secrets"
        echo "5. Update .env.production"
        echo "6. Exit"
        echo -n "Select an option: "
        read option

        case $option in
            1) store_stripe_secrets ;;
            2) store_ai_secrets ;;
            3) store_monitoring_secrets ;;
            4) generate_k8s_secrets ;;
            5) update_env_production ;;
            6) exit 0 ;;
            *) echo "Invalid option" ;;
        esac
    done
}

# Run the script
main_menu
